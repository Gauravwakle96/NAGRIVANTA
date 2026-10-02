"""Notification service + provider boundary (§8, §22).

Phase 1 ships the in-app provider only. Email/SMS/WhatsApp providers are
interfaces with NO implementation — deliberately not faked as integrated.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.entities import Notification


class NotificationProvider:
    """Future-ready interface (§8)."""

    name: str = "base"

    def send(self, notification: Notification) -> None:
        raise NotImplementedError


class InAppNotificationProvider(NotificationProvider):
    """Phase 1 provider — the row IS the delivery (read in the notification center)."""

    name = "in_app"

    def send(self, notification: Notification) -> None:
        # Persistence happens in the service layer before send(); nothing else
        # is required for the in-app channel.
        return None


class FutureEmailProvider(NotificationProvider):
    name = "email"

    def send(self, notification: Notification) -> None:
        raise NotImplementedError("Email delivery is not integrated in Phase 1.")


class FutureSMSProvider(NotificationProvider):
    name = "sms"

    def send(self, notification: Notification) -> None:
        raise NotImplementedError("SMS delivery is not integrated in Phase 1.")


class FutureWhatsAppProvider(NotificationProvider):
    name = "whatsapp"

    def send(self, notification: Notification) -> None:
        raise NotImplementedError("WhatsApp delivery is not integrated in Phase 1.")


PROVIDERS: dict[str, NotificationProvider] = {
    "in_app": InAppNotificationProvider(),
    "email": FutureEmailProvider(),
    "sms": FutureSMSProvider(),
    "whatsapp": FutureWhatsAppProvider(),
}


def get_provider(name: str = "in_app") -> NotificationProvider:
    return PROVIDERS.get(name, PROVIDERS["in_app"])


def _next_notif_id(db: Session) -> str:
    db.flush()  # autoflush is off — make pending rows visible to the query
    rows = [r.id for r in db.query(Notification.id).all() if r.id.startswith("NTF-")]
    n = 1
    for rid in rows:
        tail = rid.split("-")[-1]
        if tail.isdigit():
            n = max(n, int(tail) + 1)
    return f"NTF-{n:05d}"


def notify(
    db: Session,
    *,
    user_id: str,
    role: str,
    title: str,
    body: str,
    issue_id: str | None,
    provider: str = "in_app",
) -> Notification:
    row = Notification(
        id=_next_notif_id(db),
        user_id=user_id,
        role=role,
        title=title,
        body=body,
        issue_id=issue_id,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    get_provider(provider).send(row)
    return row
