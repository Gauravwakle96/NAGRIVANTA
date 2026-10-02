"""ORM models for the §31 table list.

PostGIS migration path: every `lat`/`lng` float pair can be replaced by
`geoalchemy2.types.Geography("Point", srid=4326)` with a GIST index; query
builders in services read `.lat`/`.lng` properties so call sites do not change.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    CITIZEN = "CITIZEN"
    FIELD_CREW = "FIELD_CREW"
    INSPECTOR = "INSPECTOR"
    DEPARTMENT_OFFICER = "DEPARTMENT_OFFICER"
    SUPERVISOR = "SUPERVISOR"
    CITY_ADMIN = "CITY_ADMIN"
    CITY_LEADERSHIP = "CITY_LEADERSHIP"


ROLE_VALUES = [r.value for r in Role]


class IssueStatus(str, enum.Enum):
    REPORTED = "REPORTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    TRIAGED = "TRIAGED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    AWAITING_VERIFICATION = "AWAITING_VERIFICATION"
    RESOLVED = "RESOLVED"
    REINSPECTION_REQUIRED = "REINSPECTION_REQUIRED"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"


class WorkOrderStatus(str, enum.Enum):
    NEW = "NEW"
    ASSIGNED = "ASSIGNED"
    ACCEPTED = "ACCEPTED"
    DISPATCHED = "DISPATCHED"
    IN_PROGRESS = "IN_PROGRESS"
    REPAIR_SUBMITTED = "REPAIR_SUBMITTED"
    VERIFICATION = "VERIFICATION"
    RESOLVED = "RESOLVED"
    REINSPECTION_REQUIRED = "REINSPECTION_REQUIRED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class Priority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IssueCategory(str, enum.Enum):
    POTHOLE = "POTHOLE"
    WATER_LEAK = "WATER_LEAK"
    GARBAGE = "GARBAGE"
    STREETLIGHT = "STREETLIGHT"
    DRAINAGE = "DRAINAGE"
    ROAD_DAMAGE = "ROAD_DAMAGE"


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    short_name: Mapped[str] = mapped_column(String(16))
    color: Mapped[str] = mapped_column(String(32))
    categories: Mapped[list] = mapped_column(JSON)
    description: Mapped[str] = mapped_column(Text)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    label: Mapped[str] = mapped_column(String(80))
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"))
    keywords: Mapped[list] = mapped_column(JSON)
    sla_hours: Mapped[int] = mapped_column(Integer)


class Crew(Base):
    __tablename__ = "crews"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"))
    member_count: Mapped[int] = mapped_column(Integer)
    lead_name: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(24))
    base_lat: Mapped[float] = mapped_column(Float)
    base_lng: Mapped[float] = mapped_column(Float)


class CrewMember(Base):
    __tablename__ = "crew_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crew_id: Mapped[str] = mapped_column(ForeignKey("crews.id"))
    user_id: Mapped[str] = mapped_column(String(48))
    display_name: Mapped[str] = mapped_column(String(120))


class UserProfile(Base):
    """profiles table — role assignment per user (§31)."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(48), unique=True)
    display_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(Enum(Role))
    department_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    crew_id: Mapped[str | None] = mapped_column(String(32), nullable=True)


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[IssueCategory] = mapped_column(Enum(IssueCategory))
    department_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    crew_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    priority: Mapped[Priority] = mapped_column(Enum(Priority))
    status: Mapped[IssueStatus] = mapped_column(Enum(IssueStatus))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String(240))
    report_ids: Mapped[list] = mapped_column(JSON)
    unique_photo_count: Mapped[int] = mapped_column(Integer, default=0)
    work_order_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synthetic: Mapped[bool] = mapped_column(default=False)

    reports: Mapped[list["Report"]] = relationship(back_populates="issue")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    issue_id: Mapped[str | None] = mapped_column(ForeignKey("issues.id"), nullable=True, index=True)
    category: Mapped[IssueCategory | None] = mapped_column(Enum(IssueCategory), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String(240))
    evidence_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    submitted_by: Mapped[str] = mapped_column(String(48))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    synthetic: Mapped[bool] = mapped_column(default=False)

    issue: Mapped[Issue | None] = relationship(back_populates="reports")


class Evidence(Base):
    """report_evidence — image/file records (§31)."""

    __tablename__ = "report_evidence"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))
    url: Mapped[str] = mapped_column(Text)
    caption: Mapped[str | None] = mapped_column(String(240), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    uploaded_by: Mapped[str] = mapped_column(String(48))
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)


class DuplicateCluster(Base):
    __tablename__ = "duplicate_clusters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id"), unique=True)
    report_count: Mapped[int] = mapped_column(Integer)
    photo_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TrustScore(Base):
    __tablename__ = "trust_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id"))
    issue_id: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    score: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(32))
    factors: Mapped[list] = mapped_column(JSON)
    engine: Mapped[str] = mapped_column(String(48))
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PriorityScore(Base):
    __tablename__ = "priority_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id"), index=True)
    score: Mapped[int] = mapped_column(Integer)
    level: Mapped[Priority] = mapped_column(Enum(Priority))
    factors: Mapped[list] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(Text)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id"), index=True)
    category: Mapped[IssueCategory] = mapped_column(Enum(IssueCategory))
    priority: Mapped[Priority] = mapped_column(Enum(Priority))
    department_id: Mapped[str] = mapped_column(String(32))
    crew_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text)
    instructions: Mapped[str] = mapped_column(Text)
    status: Mapped[WorkOrderStatus] = mapped_column(Enum(WorkOrderStatus))
    sla_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    before_evidence_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    after_evidence_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    repair_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    repaired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkOrderEvent(Base):
    __tablename__ = "work_order_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    work_order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32))
    actor_id: Mapped[str] = mapped_column(String(48))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    work_order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), index=True)
    issue_id: Mapped[str] = mapped_column(String(16), index=True)
    result: Mapped[str | None] = mapped_column(String(32), nullable=True)
    checks: Mapped[list] = mapped_column(JSON)
    notes: Mapped[str] = mapped_column(Text, default="")
    inspector_id: Mapped[str | None] = mapped_column(String(48), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RiskZone(Base):
    __tablename__ = "risk_zones"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    radius_m: Mapped[int] = mapped_column(Integer)


class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    category: Mapped[IssueCategory] = mapped_column(Enum(IssueCategory))
    zone_id: Mapped[str] = mapped_column(ForeignKey("risk_zones.id"))
    horizon_days: Mapped[int] = mapped_column(Integer)
    current_risk: Mapped[int] = mapped_column(Integer)
    predicted_risk: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(16))
    factors: Mapped[list] = mapped_column(JSON)
    recommended_action: Mapped[str] = mapped_column(Text)
    trend: Mapped[list] = mapped_column(JSON)
    synthetic: Mapped[bool] = mapped_column(default=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(48), index=True)
    role: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    issue_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    """Append-only by convention: no update/delete paths exist in services."""

    __tablename__ = "audit_logs"
    __table_args__ = (UniqueConstraint("id", name="uq_audit_id"),)

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(24), index=True)
    entity_id: Mapped[str] = mapped_column(String(24), index=True)
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(Text)
    actor_id: Mapped[str] = mapped_column(String(48))
    actor_role: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
