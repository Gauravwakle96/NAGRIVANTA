"""Analytics + shared resource API — stats, departments, crews, evidence, audit (§15, §21)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.serializers import audit_out, crew_out, department_out, evidence_out
from app.core.database import get_db
from app.core.security import require_any
from app.models.entities import AuditLog, Crew, Department, Evidence, Issue, IssueStatus, TrustScore, WorkOrder, WorkOrderStatus

router = APIRouter(tags=["analytics"])


@router.get("/stats")
def stats(db: Session = Depends(get_db), _=Depends(require_any)):
    issues = db.query(Issue).all()
    reports = db.query(Evidence).filter(Evidence.kind == "REPORT").count()
    active = [i for i in issues if i.status not in (IssueStatus.CLOSED, IssueStatus.REJECTED, IssueStatus.RESOLVED)]
    now = datetime.now(timezone.utc)
    breached = [
        w for w in db.query(WorkOrder).all()
        if (w.sla_due_at if w.sla_due_at.tzinfo else w.sla_due_at.replace(tzinfo=timezone.utc)) < now
        and w.status not in (WorkOrderStatus.RESOLVED, WorkOrderStatus.CLOSED, WorkOrderStatus.CANCELLED)
    ]
    trusts = [t.score for t in db.query(TrustScore).all()]
    # total reports = all report rows (evidence table holds photos, reports table holds submissions)
    from app.models.entities import Report

    total_reports = db.query(Report).count()
    _ = reports
    return {
        "totalReports": total_reports,
        "activeIssues": len(active),
        "highPriority": len([i for i in issues if i.priority.value in ("HIGH", "CRITICAL")]),
        "underReview": len([i for i in issues if i.status in (IssueStatus.REPORTED, IssueStatus.UNDER_REVIEW, IssueStatus.TRIAGED)]),
        "resolved": len([i for i in issues if i.status in (IssueStatus.RESOLVED, IssueStatus.CLOSED)]),
        "slaBreached": len(breached),
        "duplicateClusters": len([i for i in issues if len(i.report_ids or []) > 1]),
        "avgTrustScore": round(sum(trusts) / len(trusts)) if trusts else 0,
        "synthetic": True,
    }


@router.get("/departments")
def departments(db: Session = Depends(get_db), _=Depends(require_any)):
    return [department_out(d) for d in db.query(Department).all()]


@router.get("/crews")
def crews(db: Session = Depends(get_db), _=Depends(require_any)):
    return [crew_out(c) for c in db.query(Crew).all()]


@router.get("/evidence")
def evidence_list(ids: str = Query(...), db: Session = Depends(get_db), _=Depends(require_any)):
    id_list = [i for i in ids.split(",") if i]
    rows = db.query(Evidence).filter(Evidence.id.in_(id_list)).all()
    return [evidence_out(r) for r in rows]


@router.get("/evidence/{evidence_id}")
def evidence_get(evidence_id: str, db: Session = Depends(get_db), _=Depends(require_any)):
    row = db.get(Evidence, evidence_id)
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence_out(row)


@router.get("/audit")
def audit_list(entityId: str | None = Query(default=None), db: Session = Depends(get_db), _=Depends(require_any)):
    q = db.query(AuditLog)
    if entityId:
        q = q.filter(AuditLog.entity_id == entityId)
    rows = q.order_by(AuditLog.created_at.desc()).all()
    return [audit_out(r) for r in rows]
