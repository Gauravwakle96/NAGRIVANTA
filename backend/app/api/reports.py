"""Reports API — submission pipeline (§11) with thin handlers (§27)."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_any, require_any as _any
from app.models.entities import (
    AuditLog,
    DuplicateCluster,
    Evidence,
    Issue,
    IssueCategory,
    IssueStatus,
    PriorityScore,
    Report,
    Role,
    TrustScore,
)
from app.api.serializers import evidence_out, report_out
from app.schemas import ClassifyIn, DuplicatesIn, SubmitReportIn
from app.services.audit import append_audit
from app.services.classifier import classifier
from app.services.duplicate import duplicate_engine, haversine_m
from app.services.notifications import notify
from app.services.priority import priorityEngine
from app.services.routing import instructions_for, route_to_department
from app.services.trust import trust_engine

router = APIRouter(tags=["reports"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024


def _next_issue_id(db: Session) -> str:
    existing = [int(r.id.split("-")[1]) for r in db.query(Issue.id).all() if r.id.startswith("NGV-") and r.id.split("-")[1].isdigit()]
    return f"NGV-{(max(existing) + 1) if existing else 1001}"


def _next_id(db: Session, prefix: str, model, width: int = 4) -> str:
    rows = [r.id for r in db.query(model.id).all() if isinstance(r.id, str) and r.id.startswith(prefix)]
    n = 1
    for rid in rows:
        tail = rid.split("-")[-1]
        if tail.isdigit():
            n = max(n, int(tail) + 1)
    return f"{prefix}-{n:0{width}d}"


@router.get("/reports")
def list_reports(issue_id: str | None = Query(default=None, alias="issueId"), db: Session = Depends(get_db), _=Depends(require_any)):
    q = db.query(Report)
    if issue_id is not None:
        q = q.filter(Report.issue_id == issue_id)
    rows = q.order_by(Report.created_at.desc()).all()
    return [report_out(r) for r in rows]


@router.get("/reports/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_db), _=Depends(require_any)):
    row = db.get(Report, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return report_out(row)


@router.post("/services/classify")
def classify_endpoint(body: ClassifyIn, db: Session = Depends(get_db), _=Depends(require_any)):
    return classifier.classify(body.description, body.seed_category).model_dump(mode="json", by_alias=True)


@router.post("/services/duplicates")
def duplicates_endpoint(body: DuplicatesIn, db: Session = Depends(get_db), _=Depends(require_any)):
    cand = body.candidate
    required = {"id", "description", "createdAt"}
    if not required.issubset(cand.keys()):
        raise HTTPException(status_code=422, detail="candidate missing fields")
    others = [
        {
            "id": r.id,
            "issue_id": r.issue_id,
            "lat": r.lat,
            "lng": r.lng,
            "description": r.description,
            "category": r.category.value if r.category else None,
        }
        for r in db.query(Report).filter(Report.id != cand["id"]).all()
    ]
    candidate_row = {
        "id": cand["id"],
        "lat": cand["point"]["lat"],
        "lng": cand["point"]["lng"],
        "description": cand["description"],
        "category": cand.get("category"),
    }
    return duplicate_engine.analyze(candidate_row, others).model_dump(mode="json", by_alias=True)


@router.post("/reports", status_code=201)
def submit_report(body: SubmitReportIn, db: Session = Depends(get_db), _=Depends(require_any)):
    """Citizen submission: classify → trust → duplicates → merge/create → priority."""
    now = datetime.now(timezone.utc)

    image_id = None
    if body.image_data_url:
        # size guard (§32): reject clearly oversized payloads
        approx_bytes = len(body.image_data_url) * 3 // 4
        if approx_bytes > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image exceeds 8 MB limit")
        if not body.image_data_url.startswith("data:image/"):
            raise HTTPException(status_code=422, detail="Image must be a data URL of an image MIME type")
        image_id = _next_id(db, "EV", Evidence, 5)
        db.add(Evidence(
            id=image_id, kind="REPORT", url=body.image_data_url,
            caption="Citizen photo — compressed for upload", uploaded_at=now,
            uploaded_by=body.submitted_by, lat=body.point.lat, lng=body.point.lng,
        ))

    classification = classifier.classify(body.description, body.override_category)

    report_id = _next_id(db, "RPT", Report)
    report = Report(
        id=report_id, issue_id=None, category=classification.category,
        description=body.description, lat=body.point.lat, lng=body.point.lng,
        address=body.address, evidence_id=image_id, submitted_by=body.submitted_by,
        created_at=now, synthetic=False,
    )
    db.add(report)
    db.flush()

    others = [
        {
            "id": r.id, "issue_id": r.issue_id, "lat": r.lat, "lng": r.lng,
            "description": r.description, "category": r.category.value if r.category else None,
        }
        for r in db.query(Report).filter(Report.id != report_id).all()
    ]
    duplicates = duplicate_engine.analyze(
        {
            "id": report_id, "lat": body.point.lat, "lng": body.point.lng,
            "description": body.description, "category": classification.category.value,
        },
        others,
    )

    trust = trust_engine.evaluate(
        report_id=report_id,
        description=body.description,
        has_image=image_id is not None,
        has_location=True,
        known_reporter=True,
        nearby_existing_count=duplicates.matched_count,
    )

    matched_issues: dict[str, int] = {}
    for m in duplicates.matches:
        if m.issue_id:
            matched_issues[m.issue_id] = matched_issues.get(m.issue_id, 0) + 1
    dominant = max(matched_issues, key=matched_issues.get) if matched_issues else None  # type: ignore[arg-type]

    merged_into_existing = False

    if dominant and db.get(Issue, dominant):
        merged_into_existing = True
        issue = db.get(Issue, dominant)
        assert issue is not None
        report.issue_id = issue.id
        issue.report_ids = list(issue.report_ids or []) + [report_id]
        if image_id:
            issue.unique_photo_count = (issue.unique_photo_count or 0) + 1
        issue.updated_at = now
        for m in duplicates.matches:
            if m.issue_id:
                continue
            pending = db.get(Report, m.report_id)
            if pending and not pending.issue_id:
                pending.issue_id = issue.id
                issue.report_ids = list(issue.report_ids or []) + [pending.id]
                if pending.evidence_id:
                    issue.unique_photo_count = (issue.unique_photo_count or 0) + 1
    else:
        issue_id = _next_issue_id(db)
        report.issue_id = issue_id
        absorbed = [m.report_id for m in duplicates.matches]
        matched_rows = [db.get(Report, rid) for rid in absorbed]
        photo_count = (1 if image_id else 0) + sum(1 for r in matched_rows if r and r.evidence_id)
        candidates = [r.created_at for r in matched_rows if r] + [now]

        def _as_aware(dt: datetime) -> datetime:
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

        issue = Issue(
            id=issue_id,
            title=f"{classification.category_label} — {body.address.split('·')[-1].strip() if '·' in body.address else body.address}",
            category=classification.category,
            department_id=None,
            crew_id=None,
            priority=IssueStatus.REPORTED and "LOW",  # placeholder; recomputed below
            status=IssueStatus.REPORTED,
            lat=body.point.lat, lng=body.point.lng, address=body.address,
            report_ids=[report_id] + absorbed,
            unique_photo_count=photo_count,
            work_order_id=None,
            opened_at=min((_as_aware(c) for c in candidates)),
            updated_at=now,
            closed_at=None,
            synthetic=False,
        )
        db.add(issue)
        db.flush()  # issue must exist before the cluster FK references it
        for rid in absorbed:
            row = db.get(Report, rid)
            if row:
                row.issue_id = issue.id
        db.add(DuplicateCluster(
            issue_id=issue.id, report_count=len(issue.report_ids), photo_count=photo_count, created_at=now,
        ))

    # trust row
    db.add(TrustScore(
        report_id=report_id, issue_id=issue.id, score=trust.score, label=trust.label,
        factors=[{"label": f.label, "detail": f.detail, "impact": f.impact} for f in trust.factors],
        engine=trust.engine, evaluated_at=now,
    ))

    # priority
    days_open = (now - (issue.opened_at if issue.opened_at.tzinfo else issue.opened_at.replace(tzinfo=timezone.utc))).total_seconds() / 86400
    zone = _traffic_for(body.point.lat, body.point.lng, db)
    priority = priorityEngine.calculate(
        report_count=len(issue.report_ids),
        severity=classification.severity,
        category=classification.category,
        traffic_class=zone,
        days_open=max(0.0, days_open),
        prior_work_orders=0,
    )
    issue.priority = priority.level
    db.add(PriorityScore(
        issue_id=issue.id, score=priority.score, level=priority.level,
        factors=[{"label": f.label, "detail": f.detail, "weight": f.weight, "points": f.points} for f in priority.factors],
        explanation=priority.explanation, calculated_at=now,
    ))

    # audit + notifications
    append_audit(db, entity_type="ISSUE", entity_id=issue.id, action="Citizen submitted report",
                 detail=f"Report {report_id} received at {body.address}.", actor_id=body.submitted_by, actor_role="CITIZEN")
    append_audit(db, entity_type="ISSUE", entity_id=issue.id, action="AI analysis completed",
                 detail=f"Classified as {classification.category_label} ({classification.confidence}% demo confidence).",
                 actor_id="system", actor_role="SYSTEM")
    append_audit(db, entity_type="ISSUE", entity_id=issue.id, action="Trust evaluated",
                 detail=f"Trust score {trust.score} — {trust.label.replace('_', ' ')}.", actor_id="system", actor_role="SYSTEM")
    if duplicates.matched_count:
        append_audit(db, entity_type="ISSUE", entity_id=issue.id, action="Duplicate cluster updated",
                     detail=f"{duplicates.matched_count + 1} similar reports clustered → 1 master issue {issue.id}.",
                     actor_id="system", actor_role="SYSTEM")
    append_audit(db, entity_type="ISSUE", entity_id=issue.id, action="Priority calculated",
                 detail=f"{priority.level.value} ({priority.score}/100): {priority.explanation}",
                 actor_id="system", actor_role="SYSTEM")
    notify(db, user_id=body.submitted_by, role="CITIZEN", title="Your report has been received",
           body=f"{issue.id} — {classification.category_label} near {body.address}.", issue_id=issue.id)
    if duplicates.matched_count:
        notify(db, user_id=body.submitted_by, role="CITIZEN", title="Similar reports merged",
               body=f"{duplicates.matched_count} nearby report(s) grouped into {issue.id}.", issue_id=issue.id)

    db.commit()
    db.refresh(issue)
    db.refresh(report)

    trust_row = db.query(TrustScore).filter(TrustScore.report_id == report_id).first()
    prio_row = db.query(PriorityScore).filter(PriorityScore.issue_id == issue.id).first()

    from app.api.serializers import issue_out

    return {
        "report": report_out(report),
        "issue": issue_out(issue, trust_row, prio_row),
        "classification": classification.model_dump(mode="json", by_alias=True),
        "trust": trust.model_dump(mode="json", by_alias=True),
        "duplicates": duplicates.model_dump(mode="json", by_alias=True),
        "priority": priority.model_dump(mode="json", by_alias=True),
        "mergedIntoExisting": merged_into_existing,
    }


def _traffic_for(lat: float, lng: float, db: Session) -> str:
    """Nearest risk zone's corridor class drives traffic weighting."""
    from app.models.entities import RiskZone

    zones = db.query(RiskZone).all()
    if not zones:
        return "ARTERIAL"
    best = min(zones, key=lambda z: haversine_m(lat, lng, z.lat, z.lng))
    # corridor classes are a static property of the demo zone set
    classes = {"z-mg": "ARTERIAL", "z-stn": "ARTERIAL", "z-air": "ARTERIAL",
               "z-civ": "COLLECTOR", "z-mkt": "COLLECTOR", "z-old": "COLLECTOR", "z-grn": "COLLECTOR"}
    return classes.get(best.id, "LOCAL")
