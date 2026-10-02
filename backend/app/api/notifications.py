"""Notifications API — in-app channel (§22)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.serializers import notification_out
from app.core.database import get_db
from app.core.security import require_any
from app.models.entities import Notification

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
def list_notifications(
    userId: str = Query(...),
    role: str = Query(default="CITIZEN"),
    db: Session = Depends(get_db),
    _=Depends(require_any),
):
    rows = (
        db.query(Notification)
        .filter((Notification.user_id == userId) | (Notification.role == role) | (Notification.role == "ALL"))
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [notification_out(r) for r in rows]


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db), _=Depends(require_any)):
    row = db.get(Notification, notification_id)
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.read = True
    db.commit()
    return {"ok": True}
