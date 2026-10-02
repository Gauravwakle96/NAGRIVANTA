"""Pydantic schemas — request/response contracts (§27 schemas layer)."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.entities import IssueCategory, IssueStatus, Priority, Role, WorkOrderStatus


# ---------------- shared fragments ----------------

class GeoPoint(BaseModel):
    lat: float
    lng: float


class TrustFactor(BaseModel):
    label: str
    detail: str
    impact: str


class TrustScoreOut(BaseModel):
    report_id: str = Field(alias="reportId")
    score: int
    label: str
    factors: list[TrustFactor]
    engine: str
    evaluated_at: datetime = Field(alias="evaluatedAt")

    model_config = {"populate_by_name": True}


class PriorityFactor(BaseModel):
    label: str
    detail: str
    weight: int
    points: int


class PriorityScoreOut(BaseModel):
    score: int
    level: Priority
    factors: list[PriorityFactor]
    explanation: str
    simulated: bool = True
    calculated_at: datetime = Field(alias="calculatedAt")

    model_config = {"populate_by_name": True}


class ClassificationOut(BaseModel):
    category: IssueCategory
    category_label: str = Field(alias="categoryLabel")
    department_id: str = Field(alias="departmentId")
    department_name: str = Field(alias="departmentName")
    severity: str
    confidence: int
    matched_keywords: list[str] = Field(alias="matchedKeywords")
    summary: str
    simulated: bool = True

    model_config = {"populate_by_name": True}


class DuplicateMatch(BaseModel):
    report_id: str = Field(alias="reportId")
    issue_id: str = Field(alias="issueId")
    distance_meters: int = Field(alias="distanceMeters")
    category_agree: bool = Field(alias="categoryAgree")
    description_similarity: float = Field(alias="descriptionSimilarity")

    model_config = {"populate_by_name": True}


class DuplicateAnalysisOut(BaseModel):
    candidate_report_id: str = Field(alias="candidateReportId")
    matches: list[DuplicateMatch]
    matched_count: int = Field(alias="matchedCount")
    nearest_distance_meters: int | None = Field(alias="nearestDistanceMeters")
    suggested_master_issue_id: str | None = Field(alias="suggestedMasterIssueId")
    threshold: float
    simulated: bool = True

    model_config = {"populate_by_name": True}


# ---------------- entities ----------------

class IssueOut(BaseModel):
    id: str
    title: str
    category: IssueCategory
    department_id: str | None
    crew_id: str | None
    priority: Priority
    priority_score: PriorityScoreOut | None
    trust: TrustScoreOut | None
    status: IssueStatus
    point: GeoPoint
    address: str
    report_ids: list[str]
    unique_photo_count: int
    work_order_id: str | None
    opened_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    synthetic: bool

    model_config = {"from_attributes": True}


class ReportOut(BaseModel):
    id: str
    issue_id: str | None
    category: IssueCategory | None
    description: str
    point: GeoPoint
    address: str
    evidence_id: str | None
    submitted_by: str
    created_at: datetime
    synthetic: bool


class EvidenceOut(BaseModel):
    id: str
    kind: str
    url: str
    caption: str | None
    uploaded_at: datetime
    uploaded_by: str
    point: GeoPoint | None = None


class WorkOrderOut(BaseModel):
    id: str
    issue_id: str
    category: IssueCategory
    priority: Priority
    department_id: str
    crew_id: str | None
    point: GeoPoint
    address: str
    description: str
    instructions: str
    status: WorkOrderStatus
    sla_due_at: datetime
    created_at: datetime
    updated_at: datetime
    before_evidence_id: str | None
    after_evidence_id: str | None
    repair_note: str | None = None
    repaired_at: datetime | None = None


class VerificationCheck(BaseModel):
    key: str
    label: str
    pass_: bool = Field(alias="pass")
    detail: str

    model_config = {"populate_by_name": True}


class VerificationOut(BaseModel):
    id: str
    work_order_id: str
    issue_id: str
    result: str | None
    checks: list[VerificationCheck]
    notes: str
    inspector_id: str | None
    created_at: datetime


class AuditEventOut(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    action: str
    detail: str
    actor_id: str
    actor_role: str
    created_at: datetime


class NotificationOut(BaseModel):
    id: str
    user_id: str
    role: str
    title: str
    body: str
    issue_id: str | None
    read: bool
    created_at: datetime


class DepartmentOut(BaseModel):
    id: str
    name: str
    short_name: str = Field(alias="shortName")
    color: str
    categories: list[str]
    description: str

    model_config = {"populate_by_name": True, "from_attributes": True}


class CrewOut(BaseModel):
    id: str
    name: str
    department_id: str = Field(alias="departmentId")
    member_count: int = Field(alias="memberCount")
    lead_name: str = Field(alias="leadName")
    status: str
    base_point: GeoPoint = Field(alias="basePoint")

    model_config = {"populate_by_name": True}


class CityStatsOut(BaseModel):
    total_reports: int = Field(alias="totalReports")
    active_issues: int = Field(alias="activeIssues")
    high_priority: int = Field(alias="highPriority")
    under_review: int = Field(alias="underReview")
    resolved: int
    sla_breached: int = Field(alias="slaBreached")
    duplicate_clusters: int = Field(alias="duplicateClusters")
    avg_trust_score: int = Field(alias="avgTrustScore")
    synthetic: bool = True

    model_config = {"populate_by_name": True}


class MasterSummaryOut(BaseModel):
    issue_id: str = Field(alias="issueId")
    report_count: int = Field(alias="reportCount")
    photo_count: int = Field(alias="photoCount")
    days_active: int = Field(alias="daysActive")
    first_report_at: datetime = Field(alias="firstReportAt")
    last_report_at: datetime = Field(alias="lastReportAt")

    model_config = {"populate_by_name": True}


class RiskFactorOut(BaseModel):
    label: str
    detail: str
    contribution: int


class RiskTrendPoint(BaseModel):
    t: str
    value: int


class RiskPredictionOut(BaseModel):
    id: str
    category: IssueCategory
    zone_name: str = Field(alias="zoneName")
    point: GeoPoint
    radius_meters: int = Field(alias="radiusMeters")
    current_risk: int = Field(alias="currentRisk")
    predicted_risk: int = Field(alias="predictedRisk")
    horizon_days: int = Field(alias="horizonDays")
    trend: list[RiskTrendPoint]
    factors: list[RiskFactorOut]
    recommended_action: str = Field(alias="recommendedAction")
    label: str
    synthetic: bool = True

    model_config = {"populate_by_name": True}


# ---------------- requests ----------------

class SubmitReportIn(BaseModel):
    description: str = Field(min_length=1, max_length=600)
    point: GeoPoint
    address: str = Field(min_length=1, max_length=240)
    image_data_url: str | None = Field(default=None, alias="imageDataUrl")
    submitted_by: str = Field(default="u-citizen-1", alias="submittedBy")
    override_category: IssueCategory | None = Field(default=None, alias="overrideCategory")

    model_config = {"populate_by_name": True}


class ClassifyIn(BaseModel):
    description: str
    seed_category: IssueCategory | None = Field(default=None, alias="seedCategory")

    model_config = {"populate_by_name": True}


class DuplicatesIn(BaseModel):
    candidate: dict


class AssignDepartmentIn(BaseModel):
    department_id: str = Field(alias="departmentId")
    actor_id: str = Field(default="u-officer-road", alias="actorId")
    actor_role: Role = Field(default=Role.DEPARTMENT_OFFICER, alias="actorRole")

    model_config = {"populate_by_name": True}


class CreateWorkOrderIn(BaseModel):
    crew_id: str = Field(alias="crewId")
    instructions: str = ""
    actor_id: str = Field(default="u-officer-road", alias="actorId")
    actor_role: Role = Field(default=Role.DEPARTMENT_OFFICER, alias="actorRole")

    model_config = {"populate_by_name": True}


class TransitionIn(BaseModel):
    status: WorkOrderStatus
    note: str = ""
    actor_id: str = Field(alias="actorId")
    actor_role: Role = Field(alias="actorRole")

    model_config = {"populate_by_name": True}


class EvidenceIn(BaseModel):
    kind: str
    data_url: str = Field(alias="dataUrl")
    actor_id: str = Field(alias="actorId")
    actor_role: Role = Field(alias="actorRole")

    model_config = {"populate_by_name": True}


class MarkRepairedIn(BaseModel):
    note: str = ""
    actor_id: str = Field(alias="actorId")
    actor_role: Role = Field(alias="actorRole")

    model_config = {"populate_by_name": True}


class RepairSubmissionModel(BaseModel):
    before_image: str | None = Field(default=None, alias="beforeImage")
    after_image: str | None = Field(default=None, alias="afterImage")
    repaired_flag: bool = Field(default=False, alias="repairedFlag")
    note: str = ""

    model_config = {"populate_by_name": True}


class SubmitRepairIn(BaseModel):
    submission: RepairSubmissionModel
    actor_id: str = Field(alias="actorId")
    actor_role: Role = Field(alias="actorRole")

    model_config = {"populate_by_name": True}


class AssignInspectorIn(BaseModel):
    inspector_id: str = Field(alias="inspectorId")
    actor_id: str = Field(alias="actorId")
    actor_role: Role = Field(alias="actorRole")

    model_config = {"populate_by_name": True}


class VerifyIn(BaseModel):
    decision: dict
    actor_id: str = Field(alias="actorId")
    actor_role: Role = Field(alias="actorRole")

    model_config = {"populate_by_name": True}
