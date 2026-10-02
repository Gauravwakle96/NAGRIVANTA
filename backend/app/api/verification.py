"""Verification API — before/after decision (§20)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.serializers import issue_out, verification_out, work_order_out
from app.api.work_orders import _transition
from app.core.database import get_db
from app.core.security import INSPECTOR_ACCESS_ROLES, ensure_actor_role, require_any, require_inspector
from app.models.entities import (
    Evidence,
    Issue,
    PriorityScore,
    TrustScore,
    VerificationRecord,
    WorkOrder,
    WorkOrderStatus,
)
from app.schemas import VerifyIn
from app.services.audit import append_audit
from app.services.verification import verification_engine

router = APIRouter(tags=["verification"])


def _next_ver_id(db: Session) -> str:
    rows = [r.id for r in db.query(VerificationRecord.id).all() if r.id.startswith("VER-")]
    n = 1
    for rid in rows:
        tail = rid.split("-")[-1]
        if tail.isdigit():
            n = max(n, int(tail) + 1)
    return f"VER-{n:04d}"


@router.get("/verifications")
def list_verifications(db: Session = Depends(get_db), _=Depends(require_any)):
    rows = db.query(VerificationRecord).order_by(VerificationRecord.created_at.desc()).all()
    return [verification_out(r) for r in rows]


@router.post("/work-orders/{wo_id}/verify")
def verify_work_order(wo_id: str, body: VerifyIn, db: Session = Depends(get_db), user=Depends(require_inspector)):
    ensure_actor_role(body.actor_role, INSPECTOR_ACCESS_ROLES)
    wo = db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    before = db.get(Evidence, wo.before_evidence_id) if wo.before_evidence_id else None
    after = db.get(Evidence, wo.after_evidence_id) if wo.after_evidence_id else None

    hours_since = 999.0
    if wo.repaired_at:
        rep = wo.repaired_at if wo.repaired_at.tzinfo else wo.repaired_at.replace(tzinfo=timezone.utc)
        hours_since = (datetime.now(timezone.utc) - rep).total_seconds() / 3600

    engine_result, checks = verification_engine.verify(
        has_before=before is not None,
        has_after=after is not None,
        before_point=(before.lat, before.lng) if before and before.lat is not None else None,
        after_point=(after.lat, after.lng) if after and after.lat is not None else None,
        repaired_flag=wo.repaired_at is not None,
        hours_since_repair=hours_since,
        citizen_reopened=False,
    )

    decision = body.decision or {}
    result = decision.get("result")
    if result not in ("RESOLVED", "REINSPECTION_REQUIRED"):
        raise HTTPException(status_code=422, detail="decision.result must be RESOLVED or REINSPECTION_REQUIRED")
    notes = decision.get("notes", "")

    now = datetime.now(timezone.utc)
    ver = VerificationRecord(
        id=_next_ver_id(db), work_order_id=wo.id, issue_id=wo.issue_id, result=result,
        checks=checks, notes=notes, inspector_id=body.actor_id, created_at=now,
    )
    db.add(ver)
    append_audit(db, entity_type="VERIFICATION", entity_id=ver.id, action="Verification completed",
                 detail=f"Result: {result.replace('_', ' ')} (engine said {engine_result.replace('_', ' ')}).",
                 actor_id=body.actor_id, actor_role=body.actor_role.value)

    target = WorkOrderStatus.RESOLVED if result == "RESOLVED" else WorkOrderStatus.REINSPECTION_REQUIRED
    _transition(db, wo, target, body.actor_id, body.actor_role.value, notes)
    db.commit()
    db.refresh(wo)
    db.refresh(ver)

    issue = db.get(Issue, wo.issue_id)
    trust = db.query(TrustScore).filter(TrustScore.issue_id == wo.issue_id).first()
    prio = db.query(PriorityScore).filter(PriorityScore.issue_id == wo.issue_id).first()
    assert issue is not None
    return {
        "issue": issue_out(issue, trust, prio),
        "workOrder": work_order_out(wo),
        "verification": verification_out(ver),
    }
