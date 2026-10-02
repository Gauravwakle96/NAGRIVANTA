"""ORM → API serializers (camelCase matching the frontend contract).

Every key emitted here must match `frontend/src/types/domain.ts` exactly —
the ApiProvider passes these payloads straight into typed service methods.
"""

from datetime import datetime, timezone

from app.models.entities import (
    AuditLog,
    Crew,
    Department,
    Evidence,
    Issue,
    Notification,
    PriorityScore,
    Report,
    TrustScore,
    VerificationRecord,
    WorkOrder,
)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _val(x):
    """Enum → plain value (works for str-enums and raw strings alike)."""
    return x.value if hasattr(x, "value") else x


def trust_out(row: TrustScore | None) -> dict | None:
    if not row:
        return None
    return {
        "reportId": row.report_id,
        "score": row.score,
        "label": row.label,
        "factors": row.factors,
        "engine": row.engine,
        "evaluatedAt": _iso(row.evaluated_at),
    }


def priority_out(row: PriorityScore | None) -> dict | None:
    if not row:
        return None
    return {
        "score": row.score,
        "level": _val(row.level),
        "factors": row.factors,
        "explanation": row.explanation,
        "simulated": True,
        "calculatedAt": _iso(row.calculated_at),
    }


def issue_out(issue: Issue, trust: TrustScore | None = None, priority: PriorityScore | None = None) -> dict:
    return {
        "id": issue.id,
        "title": issue.title,
        "category": _val(issue.category),
        "departmentId": issue.department_id,
        "crewId": issue.crew_id,
        "priority": _val(issue.priority),
        "priorityScore": priority_out(priority),
        "trust": trust_out(trust),
        "status": _val(issue.status),
        "point": {"lat": issue.lat, "lng": issue.lng},
        "address": issue.address,
        "reportIds": issue.report_ids or [],
        "uniquePhotoCount": issue.unique_photo_count,
        "workOrderId": issue.work_order_id,
        "openedAt": _iso(issue.opened_at),
        "updatedAt": _iso(issue.updated_at),
        "closedAt": _iso(issue.closed_at),
        "synthetic": bool(issue.synthetic),
    }


def report_out(row: Report) -> dict:
    return {
        "id": row.id,
        "issueId": row.issue_id,
        "category": _val(row.category) if row.category else None,
        "description": row.description,
        "point": {"lat": row.lat, "lng": row.lng},
        "address": row.address,
        "evidenceId": row.evidence_id,
        "submittedBy": row.submitted_by,
        "createdAt": _iso(row.created_at),
        "synthetic": bool(row.synthetic),
    }


def evidence_out(row: Evidence) -> dict:
    return {
        "id": row.id,
        "kind": row.kind,
        "url": row.url,
        "caption": row.caption,
        "uploadedAt": _iso(row.uploaded_at),
        "uploadedBy": row.uploaded_by,
        "point": {"lat": row.lat, "lng": row.lng} if row.lat is not None and row.lng is not None else None,
    }


def work_order_out(row: WorkOrder) -> dict:
    return {
        "id": row.id,
        "issueId": row.issue_id,
        "category": _val(row.category),
        "priority": _val(row.priority),
        "departmentId": row.department_id,
        "crewId": row.crew_id,
        "point": {"lat": row.lat, "lng": row.lng},
        "address": row.address,
        "description": row.description,
        "instructions": row.instructions,
        "status": _val(row.status),
        "slaDueAt": _iso(row.sla_due_at),
        "createdAt": _iso(row.created_at),
        "updatedAt": _iso(row.updated_at),
        "beforeEvidenceId": row.before_evidence_id,
        "afterEvidenceId": row.after_evidence_id,
        "repairNote": row.repair_note,
        "repairedAt": _iso(row.repaired_at),
    }


def verification_out(row: VerificationRecord) -> dict:
    return {
        "id": row.id,
        "workOrderId": row.work_order_id,
        "issueId": row.issue_id,
        "result": row.result,
        "checks": row.checks,
        "notes": row.notes,
        "inspectorId": row.inspector_id,
        "createdAt": _iso(row.created_at),
    }


def audit_out(row: AuditLog) -> dict:
    return {
        "id": row.id,
        "entityType": row.entity_type,
        "entityId": row.entity_id,
        "action": row.action,
        "detail": row.detail,
        "actorId": row.actor_id,
        "actorRole": row.actor_role,
        "createdAt": _iso(row.created_at),
    }


def notification_out(row: Notification) -> dict:
    return {
        "id": row.id,
        "userId": row.user_id,
        "role": row.role,
        "title": row.title,
        "body": row.body,
        "issueId": row.issue_id,
        "read": bool(row.read),
        "createdAt": _iso(row.created_at),
    }


def department_out(row: Department) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "shortName": row.short_name,
        "color": row.color,
        "categories": row.categories or [],
        "description": row.description,
    }


def crew_out(row: Crew) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "departmentId": row.department_id,
        "memberCount": row.member_count,
        "leadName": row.lead_name,
        "status": row.status,
        "basePoint": {"lat": row.base_lat, "lng": row.base_lng},
    }
