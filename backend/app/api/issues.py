"""Issues API — list/detail, department assignment, master summary (§12)."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.serializers import issue_out, priority_out, trust_out
from app.core.database import get_db
from app.core.security import STAFF_ROLES, ensure_actor_role, require_any, require_staff
from app.models.entities import Department, Issue, IssueStatus, PriorityScore, Report, TrustScore
from app.schemas import AssignDepartmentIn
from app.services.audit import append_audit
from app.services.notifications import notify

router = APIRouter(tags=["issues"])


@router.get("/issues")
def list_issues(
    status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    department: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_any),
):
    q = db.query(Issue)
    if status:
        vals = [s.strip() for s in status.split(",") if s.strip()]
        q = q.filter(Issue.status.in_(vals))
    if category:
        vals = [s.strip() for s in category.split(",") if s.strip()]
        q = q.filter(Issue.category.in_(vals))
    if department:
        vals = [s.strip() for s in department.split(",") if s.strip()]
        q = q.filter(Issue.department_id.in_(vals))
    if priority:
        vals = [s.strip() for s in priority.split(",") if s.strip()]
        q = q.filter(Issue.priority.in_(vals))
    if search:
        like = f"%{search}%"
        q = q.filter((Issue.id.ilike(like)) | (Issue.title.ilike(like)) | (Issue.address.ilike(like)))
    q = q.order_by(Issue.updated_at.desc())
    if limit:
        q = q.limit(limit)

    out = []
    for issue in q.all():
        trust = db.query(TrustScore).filter(TrustScore.issue_id == issue.id).first()
        prio = db.query(PriorityScore).filter(PriorityScore.issue_id == issue.id).first()
        out.append(issue_out(issue, trust, prio))
    return out


@router.get("/issues/{issue_id}")
def get_issue(issue_id: str, db: Session = Depends(get_db), _=Depends(require_any)):
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    trust = db.query(TrustScore).filter(TrustScore.issue_id == issue.id).first()
    prio = db.query(PriorityScore).filter(PriorityScore.issue_id == issue.id).first()
    return issue_out(issue, trust, prio)


@router.get("/issues/{issue_id}/master-summary")
def master_summary(issue_id: str, db: Session = Depends(get_db), _=Depends(require_any)):
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    reports = db.query(Report).filter(Report.id.in_(issue.report_ids or [])).order_by(Report.created_at).all()
    if not reports:
        return {
            "issueId": issue.id, "reportCount": len(issue.report_ids or []),
            "photoCount": issue.unique_photo_count, "daysActive": 1,
            "firstReportAt": issue.opened_at.isoformat(), "lastReportAt": issue.updated_at.isoformat(),
        }
    first = reports[0].created_at
    last = reports[-1].created_at
    end = issue.closed_at or datetime.now(timezone.utc)
    if first.tzinfo is None:
        first = first.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return {
        "issueId": issue.id,
        "reportCount": len(reports),
        "photoCount": sum(1 for r in reports if r.evidence_id),
        "daysActive": max(1, (end - first).days),
        "firstReportAt": first.isoformat(),
        "lastReportAt": last.isoformat(),
    }


@router.post("/issues/{issue_id}/assign-department")
def assign_department(issue_id: str, body: AssignDepartmentIn, db: Session = Depends(get_db), user=Depends(require_staff)):
    ensure_actor_role(body.actor_role, STAFF_ROLES)
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    dept = db.get(Department, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    issue.department_id = dept.id
    if issue.status in (IssueStatus.REPORTED, IssueStatus.UNDER_REVIEW):
        issue.status = IssueStatus.TRIAGED
    issue.updated_at = datetime.now(timezone.utc)

    append_audit(db, entity_type="ISSUE", entity_id=issue.id, action="Department assigned",
                 detail=f"Routed to {dept.name}.", actor_id=body.actor_id, actor_role=body.actor_role.value)
    notify(db, user_id="u-citizen-1", role="CITIZEN", title="Your issue has been assigned",
           body=f"{issue.id} → {dept.name}.", issue_id=issue.id)
    db.commit()
    db.refresh(issue)

    trust = db.query(TrustScore).filter(TrustScore.issue_id == issue.id).first()
    prio = db.query(PriorityScore).filter(PriorityScore.issue_id == issue.id).first()
    return issue_out(issue, trust, prio)
