/**
 * Service interfaces (§26). The UI only ever talks to these —
 * DemoDataProvider and ApiProvider are interchangeable, and any API failure
 * falls back to the demo provider instead of crashing (§25).
 */

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
  IssueStatus,
  MasterIssueSummary,
  PriorityScore,
  Report,
  RiskPrediction,
  ServiceMode,
  TrustScore,
  User,
  Verification,
  VerificationResult,
  WorkOrder,
  WorkOrderStatus,
} from '@/types/domain'

export interface IssueFilter {
  status?: IssueStatus[]
  category?: IssueCategory[]
  departmentId?: string[]
  priority?: string[]
  search?: string
  boundingBox?: { minLat: number; maxLat: number; minLng: number; maxLng: number }
  limit?: number
}

export interface SubmitReportInput {
  description: string
  point: GeoPoint
  address: string
  /** data URL of the compressed photo, or null if the citizen skipped it */
  imageDataUrl: string | null
  submittedBy: string
  /** forced category override from the citizen, when they disagree with AI */
  overrideCategory?: IssueCategory | null
}

export interface SubmitReportResult {
  report: Report
  issue: Issue
  classification: ClassificationResult
  trust: TrustScore
  duplicates: DuplicateAnalysis
  priority: PriorityScore
  /** set when the report merged into an existing master issue */
  mergedIntoExisting: boolean
}

export interface RepairSubmission {
  beforeImage: string | null
  afterImage: string | null
  repairedFlag: boolean
  note: string
}

export interface VerificationDecision {
  result: VerificationResult
  notes: string
}

/** The single contract the whole UI depends on. */
export interface NagrivantaService {
  readonly mode: ServiceMode
  healthCheck(): Promise<boolean>

  // reads
  listIssues(filter?: IssueFilter): Promise<Issue[]>
  getIssue(id: string): Promise<Issue | null>
  listReports(issueId?: string): Promise<Report[]>
  getReport(id: string): Promise<Report | null>
  listWorkOrders(filter?: { status?: WorkOrderStatus[]; crewId?: string }): Promise<WorkOrder[]>
  getWorkOrder(id: string): Promise<WorkOrder | null>
  listEvidence(ids: string[]): Promise<Evidence[]>
  getEvidence(id: string): Promise<Evidence | null>
  listAudit(entityId?: string): Promise<AuditEvent[]>
  listNotifications(userId: string, role: string): Promise<AppNotification[]>
  listDepartments(): Promise<Department[]>
  listCrews(): Promise<Crew[]>
  listVerifications(): Promise<Verification[]>
  getStats(): Promise<CityStats>
  listRiskPredictions(horizon: 7 | 30 | 90): Promise<RiskPrediction[]>
  getMasterSummary(issueId: string): Promise<MasterIssueSummary | null>

  // intelligence
  classify(input: { description: string; seedCategory?: IssueCategory | null }): Promise<ClassificationResult>
  checkDuplicates(candidate: {
    id: string
    point: GeoPoint
    description: string
    category: IssueCategory | null
    createdAt: string
  }): Promise<DuplicateAnalysis>

  // mutations
  submitReport(input: SubmitReportInput): Promise<SubmitReportResult>
  assignDepartment(issueId: string, departmentId: string, actor: User): Promise<Issue>
  createWorkOrder(
    issueId: string,
    crewId: string,
    instructions: string,
    actor: User,
  ): Promise<{ issue: Issue; workOrder: WorkOrder }>
  transitionWorkOrder(
    workOrderId: string,
    status: WorkOrderStatus,
    actor: User,
    note?: string,
  ): Promise<WorkOrder>
  uploadEvidence(
    workOrderId: string,
    kind: 'BEFORE' | 'AFTER',
    dataUrl: string,
    actor: User,
  ): Promise<WorkOrder>
  markRepaired(workOrderId: string, note: string, actor: User): Promise<WorkOrder>
  submitRepair(workOrderId: string, submission: RepairSubmission, actor: User): Promise<WorkOrder>
  assignInspector(workOrderId: string, inspectorId: string, actor: User): Promise<WorkOrder>
  submitRepair(workOrderId: string, submission: RepairSubmission, actor: User): Promise<WorkOrder>
  recordVerification(
    workOrderId: string,
    decision: VerificationDecision,
    actor: User,
  ): Promise<{ issue: Issue; workOrder: WorkOrder; verification: Verification }>
  markNotificationRead(id: string): Promise<void>
  resetDemoData(): Promise<void>
}
