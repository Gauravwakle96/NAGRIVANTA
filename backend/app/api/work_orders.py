"""Work orders API — creation, transitions, evidence, repair (§18, §19)."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.serializers import evidence_out, issue_out, work_order_out
from app.core.database import get_db
from app.core.security import (
    CREW_ACCESS_ROLES,
    STAFF_ROLES,
    ensure_actor_role,
    require_any,
    require_crew,
    require_staff,
)
from app.models.entities import (
    Category,
    Crew,
    Evidence,
    Issue,
    IssueStatus,
    PriorityScore,
    TrustScore,
    WorkOrder,
    WorkOrderEvent,
    WorkOrderStatus,
)
from app.schemas import AssignInspectorIn, CreateWorkOrderIn, EvidenceIn, MarkRepairedIn, SubmitRepairIn, TransitionIn
from app.services.audit import append_audit
from app.services.notifications import notify
from app.services.routing import instructions_for

router = APIRouter(tags=["work-orders"])

STATUS_TO_ISSUE = {
    WorkOrderStatus.ACCEPTED: IssueStatus.ASSIGNED,
    WorkOrderStatus.DISPATCHED: IssueStatus.IN_PROGRESS,
    WorkOrderStatus.IN_PROGRESS: IssueStatus.IN_PROGRESS,
    WorkOrderStatus.REPAIR_SUBMITTED: IssueStatus.AWAITING_VERIFICATION,
    WorkOrderStatus.VERIFICATION: IssueStatus.AWAITING_VERIFICATION,
    WorkOrderStatus.RESOLVED: IssueStatus.RESOLVED,
    WorkOrderStatus.REINSPECTION_REQUIRED: IssueStatus.REINSPECTION_REQUIRED,
    WorkOrderStatus.CLOSED: IssueStatus.CLOSED,
    WorkOrderStatus.CANCELLED: IssueStatus.REJECTED,
}


def _next_wo_id(db: Session) -> str:
    tails = [int(r.id.split("-")[-1]) for r in db.query(WorkOrder.id).all() if r.id.startswith("WO-") and r.id.split("-")[-1].isdigit()]
    return f"WO-{(max(tails) + 1) if tails else 1:04d}"


def _next_ev_id(db: Session) -> str:
    tails = [int(r.id.split("-")[-1]) for r in db.query(Evidence.id).all() if r.id.startswith("EV-") and r.id.split("-")[-1].isdigit()]
    return f"EV-{(max(tails) + 1) if tails else 1:05d}"


def _transition(db: Session, wo: WorkOrder, to: WorkOrderStatus, actor_id: str, actor_role: str, note: str = "") -> WorkOrder:
    frm = wo.status
    wo.status = to
    wo.updated_at = datetime.now(timezone.utc)
    db.add(WorkOrderEvent(work_order_id=wo.id, from_status=frm.value, to_status=to.value,
                          actor_id=actor_id, note=note, created_at=wo.updated_at))
    append_audit(db, entity_type="WORK_ORDER", entity_id=wo.id, action="Status transition",
                 detail=f"{frm.value} → {to.value}" + (f" ({note})" if note else ""),
                 actor_id=actor_id, actor_role=actor_role)

    issue = db.get(Issue, wo.issue_id)
    if issue:
        nxt = STATUS_TO_ISSUE.get(to)
        if nxt:
            issue.status = nxt
            if nxt in (IssueStatus.RESOLVED, IssueStatus.CLOSED) and not issue.closed_at:
                issue.closed_at = wo.updated_at
            issue.updated_at = wo.updated_at
        if to in (WorkOrderStatus.RESOLVED, WorkOrderStatus.CLOSED):
            append_audit(db, entity_type="ISSUE", entity_id=issue.id, action="Issue resolved",
                         detail="Verification passed — issue resolved.", actor_id=actor_id, actor_role=actor_role)
            notify(db, user_id="u-citizen-1", role="CITIZEN", title="Your issue has been resolved",
                   body=f"{issue.id} passed verification.", issue_id=issue.id)
    return wo


@router.get("/work-orders")
def list_work_orders(
    status: str | None = Query(default=None),
    crewId: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_any),
):
    q = db.query(WorkOrder)
    if status:
        vals = [s.strip() for s in status.split(",") if s.strip()]
        q = q.filter(WorkOrder.status.in_(vals))
    if crewId:
        q = q.filter(WorkOrder.crew_id == crewId)
    rows = q.order_by(WorkOrder.updated_at.desc()).all()
    return [work_order_out(r) for r in rows]


@router.get("/work-orders/{wo_id}")
def get_work_order(wo_id: str, db: Session = Depends(get_db), _=Depends(require_any)):
    row = db.get(WorkOrder, wo_id)
    if not row:
        raise HTTPException(status_code=404, detail="Work order not found")
    return work_order_out(row)


@router.post("/issues/{issue_id}/work-orders", status_code=201)
def create_work_order(issue_id: str, body: CreateWorkOrderIn, db: Session = Depends(get_db), user=Depends(require_staff)):
    ensure_actor_role(body.actor_role, STAFF_ROLES)
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    crew = db.get(Crew, body.crew_id)
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    if not issue.department_id:
        raise HTTPException(status_code=409, detail="Assign a department before creating a work order")

    sla_hours = 72
    cat = db.query(Category).filter(Category.id == issue.category.value).first()
    if cat:
        sla_hours = cat.sla_hours

    now = datetime.now(timezone.utc)
    wo = WorkOrder(
        id=_next_wo_id(db), issue_id=issue.id, category=issue.category, priority=issue.priority,
        department_id=issue.department_id, crew_id=crew.id, lat=issue.lat, lng=issue.lng,
        address=issue.address, description=issue.title,
        instructions=body.instructions or instructions_for(issue.category),
        status=WorkOrderStatus.ASSIGNED,
        sla_due_at=issue.opened_at.replace(tzinfo=timezone.utc) + timedelta(hours=sla_hours)
        if issue.opened_at.tzinfo is None else issue.opened_at + timedelta(hours=sla_hours),
        created_at=now, updated_at=now,
    )
    db.add(wo)
    issue.crew_id = crew.id
    issue.work_order_id = wo.id
    issue.status = IssueStatus.ASSIGNED
    issue.updated_at = now

    db.add(WorkOrderEvent(work_order_id=wo.id, from_status=None, to_status=WorkOrderStatus.NEW.value,
                          actor_id=body.actor_id, note="created", created_at=now))
    db.add(WorkOrderEvent(work_order_id=wo.id, from_status=WorkOrderStatus.NEW.value, to_status=WorkOrderStatus.ASSIGNED.value,
                          actor_id=body.actor_id, note="crew assigned", created_at=now))

    append_audit(db, entity_type="WORK_ORDER", entity_id=wo.id, action="Work order created",
                 detail=f"{wo.id} created for {issue.id}.", actor_id=body.actor_id, actor_role=body.actor_role.value)
    append_audit(db, entity_type="WORK_ORDER", entity_id=wo.id, action="Crew assigned",
                 detail=f"Crew {crew.id} dispatched.", actor_id=body.actor_id, actor_role=body.actor_role.value)
    append_audit(db, entity_type="ISSUE", entity_id=issue.id, action="Crew assigned",
                 detail=f"Crew {crew.id} dispatched.", actor_id=body.actor_id, actor_role=body.actor_role.value)
    notify(db, user_id="u-citizen-1", role="CITIZEN", title="A crew has been dispatched",
           body=f"{issue.id} — crew {crew.id} is on the way.", issue_id=issue.id)
    notify(db, user_id="u-crew-road-a", role="FIELD_CREW", title="New work order assigned",
           body=f"{wo.id} — {issue.title}.", issue_id=issue.id)

    db.commit()
    db.refresh(wo)
    db.refresh(issue)
    trust = db.query(TrustScore).filter(TrustScore.issue_id == issue.id).first()
    prio = db.query(PriorityScore).filter(PriorityScore.issue_id == issue.id).first()
    return {"issue": issue_out(issue, trust, prio), "workOrder": work_order_out(wo)}


@router.post("/work-orders/{wo_id}/transition")
def transition_work_order(wo_id: str, body: TransitionIn, db: Session = Depends(get_db), user=Depends(require_crew)):
    ensure_actor_role(body.actor_role, CREW_ACCESS_ROLES)
    wo = db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    _transition(db, wo, body.status, body.actor_id, body.actor_role.value, body.note)
    db.commit()
    db.refresh(wo)
    return work_order_out(wo)


@router.post("/work-orders/{wo_id}/evidence")
def upload_evidence(wo_id: str, body: EvidenceIn, db: Session = Depends(get_db), user=Depends(require_crew)):
    ensure_actor_role(body.actor_role, CREW_ACCESS_ROLES)
    if body.kind not in ("BEFORE", "AFTER"):
        raise HTTPException(status_code=422, detail="kind must be BEFORE or AFTER")
    wo = db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="dataUrl must be an image data URL")

    now = datetime.now(timezone.utc)
    ev = Evidence(
        id=_next_ev_id(db), kind=body.kind, url=body.data_url,
        caption=f"{body.kind} evidence uploaded by {body.actor_id}",
        uploaded_at=now, uploaded_by=body.actor_id, lat=wo.lat, lng=wo.lng,
    )
    db.add(ev)
    if body.kind == "BEFORE":
        wo.before_evidence_id = ev.id
    else:
        wo.after_evidence_id = ev.id
    wo.updated_at = now
    append_audit(db, entity_type="WORK_ORDER", entity_id=wo.id, action=f"{body.kind} evidence uploaded",
                 detail=f"Crew uploaded {body.kind} photo.", actor_id=body.actor_id, actor_role=body.actor_role.value)
    db.commit()
    db.refresh(wo)
    return work_order_out(wo)


@router.post("/work-orders/{wo_id}/mark-repaired")
def mark_repaired(wo_id: str, body: MarkRepairedIn, db: Session = Depends(get_db), user=Depends(require_crew)):
    ensure_actor_role(body.actor_role, CREW_ACCESS_ROLES)
    wo = db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    now = datetime.now(timezone.utc)
    wo.repair_note = body.note or "Crew marked repair done."
    wo.repaired_at = now
    wo.updated_at = now
    if wo.status in (WorkOrderStatus.ASSIGNED, WorkOrderStatus.ACCEPTED, WorkOrderStatus.DISPATCHED):
        wo.status = WorkOrderStatus.IN_PROGRESS
    append_audit(db, entity_type="WORK_ORDER", entity_id=wo.id, action="Repair marked complete",
                 detail=wo.repair_note, actor_id=body.actor_id, actor_role=body.actor_role.value)
    db.commit()
    db.refresh(wo)
    return work_order_out(wo)


@router.post("/work-orders/{wo_id}/submit-repair")
def submit_repair(wo_id: str, body: SubmitRepairIn, db: Session = Depends(get_db), user=Depends(require_crew)):
    ensure_actor_role(body.actor_role, CREW_ACCESS_ROLES)
    wo = db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    sub = body.submission
    if sub.before_image and not wo.before_evidence_id:
        db.add(Evidence(id=_next_ev_id(db), kind="BEFORE", url=sub.before_image, caption="before evidence",
                        uploaded_at=datetime.now(timezone.utc), uploaded_by=body.actor_id, lat=wo.lat, lng=wo.lng))
        db.flush()
        wo.before_evidence_id = db.query(Evidence.id).order_by(Evidence.id.desc()).first()[0]
    if sub.after_image and not wo.after_evidence_id:
        db.add(Evidence(id=_next_ev_id(db), kind="AFTER", url=sub.after_image, caption="after evidence",
                        uploaded_at=datetime.now(timezone.utc), uploaded_by=body.actor_id, lat=wo.lat, lng=wo.lng))
        db.flush()
        wo.after_evidence_id = db.query(Evidence.id).order_by(Evidence.id.desc()).first()[0]
    if sub.repaired_flag and not wo.repaired_at:
        wo.repaired_at = datetime.now(timezone.utc)
        wo.repair_note = sub.note or "Repair complete"

    _transition(db, wo, WorkOrderStatus.REPAIR_SUBMITTED, body.actor_id, body.actor_role.value, sub.note)
    db.commit()
    db.refresh(wo)
    return work_order_out(wo)


@router.post("/work-orders/{wo_id}/assign-inspector")
def assign_inspector(wo_id: str, body: AssignInspectorIn, db: Session = Depends(get_db), user=Depends(require_staff)):
    ensure_actor_role(body.actor_role, STAFF_ROLES)
    wo = db.get(WorkOrder, wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    now = datetime.now(timezone.utc)
    wo.status = WorkOrderStatus.VERIFICATION
    wo.updated_at = now
    append_audit(db, entity_type="WORK_ORDER", entity_id=wo.id, action="Inspector assigned",
                 detail=f"Inspector {body.inspector_id} assigned for reinspection.",
                 actor_id=body.actor_id, actor_role=body.actor_role.value)
    issue = db.get(Issue, wo.issue_id)
    if issue:
        issue.status = IssueStatus.AWAITING_VERIFICATION
        issue.updated_at = now
    db.commit()
    db.refresh(wo)
    return work_order_out(wo)
