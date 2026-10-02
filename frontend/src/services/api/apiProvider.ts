/**
 * ApiProvider — talks to the FastAPI backend (§27).
 *
 * Thin fetch wrappers over the REST contract. Every method can throw; the
 * registry catches failures and falls back to the demo provider (§25).
 */

import { API_BASE_URL } from '@/config/app'
import type {
  AppNotification,
  AuditEvent,
  CityStats,
  ClassificationResult,
  Crew,
  Department,
  DuplicateAnalysis,
  Evidence,
  GeoPoint,
  Issue,
  IssueCategory,
  MasterIssueSummary,
  RiskPrediction,
  User,
  Verification,
  WorkOrder,
  WorkOrderStatus,
} from '@/types/domain'
import type {
  IssueFilter,
  NagrivantaService,
  RepairSubmission,
  SubmitReportInput,
  SubmitReportResult,
  VerificationDecision,
} from '@/services/types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}`)
  }
  return (await res.json()) as T
}

/** Flatten the acting user into the schema fields (actorId/actorRole). */
function actorBody(actor: User): { actorId: string; actorRole: string } {
  return { actorId: actor.id, actorRole: actor.role }
}

function toQuery(filter?: IssueFilter): string {
  const params = new URLSearchParams()
  if (filter?.status?.length) params.set('status', filter.status.join(','))
  if (filter?.category?.length) params.set('category', filter.category.join(','))
  if (filter?.departmentId?.length) params.set('department', filter.departmentId.join(','))
  if (filter?.priority?.length) params.set('priority', filter.priority.join(','))
  if (filter?.search) params.set('search', filter.search)
  if (filter?.limit) params.set('limit', String(filter.limit))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export class ApiProvider implements NagrivantaService {
  readonly mode = 'API' as const

  async healthCheck(): Promise<boolean> {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 1500)
      const res = await fetch(`${API_BASE_URL}/api/health`, { signal: ctrl.signal })
      clearTimeout(timer)
      return res.ok
    } catch {
      return false
    }
  }

  async listIssues(filter?: IssueFilter): Promise<Issue[]> {
    return request<Issue[]>(`/api/issues${toQuery(filter)}`)
  }
  async getIssue(id: string): Promise<Issue | null> {
    return request<Issue | null>(`/api/issues/${id}`)
  }
  async listReports(issueId?: string): Promise<Report[]> {
    return request<Report[]>(`/api/reports${issueId ? `?issueId=${issueId}` : ''}`)
  }
  async getReport(id: string): Promise<Report | null> {
    return request<Report | null>(`/api/reports/${id}`)
  }
  async listWorkOrders(filter?: { status?: WorkOrderStatus[]; crewId?: string }): Promise<WorkOrder[]> {
    const params = new URLSearchParams()
    if (filter?.status?.length) params.set('status', filter.status.join(','))
    if (filter?.crewId) params.set('crewId', filter.crewId)
    const qs = params.toString()
    return request<WorkOrder[]>(`/api/work-orders${qs ? `?${qs}` : ''}`)
  }
  async getWorkOrder(id: string): Promise<WorkOrder | null> {
    return request<WorkOrder | null>(`/api/work-orders/${id}`)
  }
  async listEvidence(ids: string[]): Promise<Evidence[]> {
    if (ids.length === 0) return []
    return request<Evidence[]>(`/api/evidence?ids=${ids.join(',')}`)
  }
  async getEvidence(id: string): Promise<Evidence | null> {
    return request<Evidence | null>(`/api/evidence/${id}`)
  }
  async listAudit(entityId?: string): Promise<AuditEvent[]> {
    return request<AuditEvent[]>(`/api/audit${entityId ? `?entityId=${entityId}` : ''}`)
  }
  async listNotifications(userId: string, role: string): Promise<AppNotification[]> {
    return request<AppNotification[]>(`/api/notifications?userId=${userId}&role=${role}`)
  }
  async listDepartments(): Promise<Department[]> {
    return request<Department[]>('/api/departments')
  }
  async listCrews(): Promise<Crew[]> {
    return request<Crew[]>('/api/crews')
  }
  async listVerifications(): Promise<Verification[]> {
    return request<Verification[]>('/api/verifications')
  }
  async getStats(): Promise<CityStats> {
    return request<CityStats>('/api/stats')
  }
  async listRiskPredictions(horizon: 7 | 30 | 90): Promise<RiskPrediction[]> {
    return request<RiskPrediction[]>(`/api/risk?horizon=${horizon}`)
  }
  async getMasterSummary(issueId: string): Promise<MasterIssueSummary | null> {
    return request<MasterIssueSummary | null>(`/api/issues/${issueId}/master-summary`)
  }

  async classify(input: { description: string; seedCategory?: IssueCategory | null }): Promise<ClassificationResult> {
    return request<ClassificationResult>('/api/services/classify', { method: 'POST', body: JSON.stringify(input) })
  }
  async checkDuplicates(candidate: {
    id: string
    point: GeoPoint
    description: string
    category: IssueCategory | null
    createdAt: string
  }): Promise<DuplicateAnalysis> {
    return request<DuplicateAnalysis>('/api/services/duplicates', { method: 'POST', body: JSON.stringify({ candidate }) })
  }

  async submitReport(input: SubmitReportInput): Promise<SubmitReportResult> {
    return request<SubmitReportResult>('/api/reports', { method: 'POST', body: JSON.stringify(input) })
  }
  async assignDepartment(issueId: string, departmentId: string, actor: User): Promise<Issue> {
    return request<Issue>(`/api/issues/${issueId}/assign-department`, {
      method: 'POST',
      body: JSON.stringify({ departmentId, ...actorBody(actor) }),
    })
  }
  async createWorkOrder(
    issueId: string,
    crewId: string,
    instructions: string,
    actor: User,
  ): Promise<{ issue: Issue; workOrder: WorkOrder }> {
    return request<{ issue: Issue; workOrder: WorkOrder }>(`/api/issues/${issueId}/work-orders`, {
      method: 'POST',
      body: JSON.stringify({ crewId, instructions, ...actorBody(actor) }),
    })
  }
  async transitionWorkOrder(workOrderId: string, status: WorkOrderStatus, actor: User, note = ''): Promise<WorkOrder> {
    return request<WorkOrder>(`/api/work-orders/${workOrderId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status, note, ...actorBody(actor) }),
    })
  }
  async uploadEvidence(workOrderId: string, kind: 'BEFORE' | 'AFTER', dataUrl: string, actor: User): Promise<WorkOrder> {
    return request<WorkOrder>(`/api/work-orders/${workOrderId}/evidence`, {
      method: 'POST',
      body: JSON.stringify({ kind, dataUrl, ...actorBody(actor) }),
    })
  }
  async markRepaired(workOrderId: string, note: string, actor: User): Promise<WorkOrder> {
    return request<WorkOrder>(`/api/work-orders/${workOrderId}/mark-repaired`, {
      method: 'POST',
      body: JSON.stringify({ note, ...actorBody(actor) }),
    })
  }
  async submitRepair(workOrderId: string, submission: RepairSubmission, actor: User): Promise<WorkOrder> {
    return request<WorkOrder>(`/api/work-orders/${workOrderId}/submit-repair`, {
      method: 'POST',
      body: JSON.stringify({ submission, ...actorBody(actor) }),
    })
  }
  async assignInspector(workOrderId: string, inspectorId: string, actor: User): Promise<WorkOrder> {
    return request<WorkOrder>(`/api/work-orders/${workOrderId}/assign-inspector`, {
      method: 'POST',
      body: JSON.stringify({ inspectorId, ...actorBody(actor) }),
    })
  }
  async recordVerification(
    workOrderId: string,
    decision: VerificationDecision,
    actor: User,
  ): Promise<{ issue: Issue; workOrder: WorkOrder; verification: Verification }> {
    return request<{ issue: Issue; workOrder: WorkOrder; verification: Verification }>(
      `/api/work-orders/${workOrderId}/verify`,
      { method: 'POST', body: JSON.stringify({ decision, ...actorBody(actor) }) },
    )
  }
  async markNotificationRead(id: string): Promise<void> {
    await request<void>(`/api/notifications/${id}/read`, { method: 'POST' })
  }
  async resetDemoData(): Promise<void> {
    await request<void>('/api/reset', { method: 'POST' })
  }
}

// late import to avoid circular type issues
import type { Report } from '@/types/domain'
