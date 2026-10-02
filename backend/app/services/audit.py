"""Shared audit helper — append-only events (§21)."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.entities import AuditLog

_lock_hint = {"last": None}


def _next_audit_id(db: Session) -> str:
    """Derive next id from the table so seed + runtime never collide."""
    db.flush()  # session has autoflush disabled — make pending rows visible
    rows = [r.id for r in db.query(AuditLog.id).all() if r.id.startswith("AUD-")]
    n = 1
    for rid in rows:
        tail = rid.split("-")[-1]
        if tail.isdigit():
            n = max(n, int(tail) + 1)
    return f"AUD-{n:05d}"


def append_audit(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    action: str,
    detail: str,
    actor_id: str,
    actor_role: str,
) -> AuditLog:
    row = AuditLog(
        id=_next_audit_id(db),
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        detail=detail,
        actor_id=actor_id,
        actor_role=actor_role,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    return row
