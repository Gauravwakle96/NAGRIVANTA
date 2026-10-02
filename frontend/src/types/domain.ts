/**
 * Nagrivanta core domain types.
 * Shared vocabulary for citizen portal, crew portal and municipal command.
 */

export type Role =
  | 'CITIZEN'
  | 'FIELD_CREW'
  | 'INSPECTOR'
  | 'DEPARTMENT_OFFICER'
  | 'SUPERVISOR'
  | 'CITY_ADMIN'
  | 'CITY_LEADERSHIP'

export type IssueCategory =
  | 'POTHOLE'
  | 'WATER_LEAK'
  | 'GARBAGE'
  | 'STREETLIGHT'
  | 'DRAINAGE'
  | 'ROAD_DAMAGE'

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type TrustLabel = 'LIKELY_GENUINE' | 'SIMILAR_REPORT' | 'NEEDS_REVIEW'

export type IssueStatus =
  | 'REPORTED'
  | 'UNDER_REVIEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'AWAITING_VERIFICATION'
  | 'RESOLVED'
  | 'REINSPECTION_REQUIRED'
  | 'CLOSED'
  | 'REJECTED'

export type WorkOrderStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'DISPATCHED'
  | 'IN_PROGRESS'
  | 'REPAIR_SUBMITTED'
  | 'VERIFICATION'
  | 'RESOLVED'
  | 'REINSPECTION_REQUIRED'
  | 'CLOSED'
  | 'CANCELLED'

export type EvidenceKind = 'BEFORE' | 'AFTER' | 'REPORT' | 'REINSPECTION'

export type ServiceMode = 'API' | 'DEMO' | 'FALLBACK'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface User {
  id: string
  name: string
  role: Role
  departmentId?: string
  crewId?: string
  avatarLabel: string
}

export interface CategoryConfig {
  id: IssueCategory
  label: string
  departmentId: string
  keywords: string[]
  slaHours: number
}

export interface Department {
  id: string
  name: string
  shortName: string
  color: string
  categories: IssueCategory[]
  description: string
}

export interface Crew {
  id: string
  name: string
  departmentId: string
  memberCount: number
  leadName: string
  status: 'AVAILABLE' | 'ON_JOB' | 'OFF_DUTY'
  basePoint: GeoPoint
}

export interface Evidence {
  id: string
  kind: EvidenceKind
  /** data URL or server URL; demo images are generated SVG placeholders */
  url: string
  caption?: string
  uploadedAt: string
  uploadedBy: string
  point?: GeoPoint
}

export interface Report {
  id: string
  issueId: string | null
  category: IssueCategory | null
  description: string
  point: GeoPoint
  address: string
  evidenceId: string | null
  submittedBy: string
  createdAt: string
  /** true when the report was produced by the guided demo / seed data */
  synthetic: boolean
}

export interface TrustFactor {
  label: string
  detail: string
  impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
}

export interface TrustScore {
  reportId: string
  /** 0-100, explicitly a DEMO score */
  score: number
  label: TrustLabel
  factors: TrustFactor[]
  engine: string
  evaluatedAt: string
}

export interface ClassificationResult {
  category: IssueCategory
  categoryLabel: string
  departmentId: string
  departmentName: string
  severity: Severity
  /** 0-100 demo/simulated confidence */
  confidence: number
  matchedKeywords: string[]
  summary: string
  simulated: boolean
}

export interface DuplicateMatch {
  reportId: string
  issueId: string
  distanceMeters: number
  categoryAgree: boolean
  descriptionSimilarity: number
}

export interface DuplicateAnalysis {
  candidateReportId: string
  matches: DuplicateMatch[]
  matchedCount: number
  nearestDistanceMeters: number | null
  suggestedMasterIssueId: string | null
  threshold: number
  simulated: boolean
}

export interface PriorityFactor {
  label: string
  detail: string
  weight: number
  points: number
}

export interface PriorityScore {
  score: number
  level: Priority
  factors: PriorityFactor[]
  explanation: string
  simulated: boolean
  calculatedAt: string
}

export interface WorkOrderEvent {
  id: string
  workOrderId: string
  from: WorkOrderStatus | null
  to: WorkOrderStatus
  actorId: string
  note: string
  createdAt: string
}

export interface WorkOrder {
  id: string
  issueId: string
  category: IssueCategory
  priority: Priority
  departmentId: string
  crewId: string | null
  point: GeoPoint
  address: string
  description: string
  instructions: string
  status: WorkOrderStatus
  slaDueAt: string
  createdAt: string
  updatedAt: string
  beforeEvidenceId: string | null
  afterEvidenceId: string | null
  /** crew's repair confirmation note (set by markRepaired) */
  repairNote?: string
  repairedAt?: string
}

export type VerificationResult = 'RESOLVED' | 'REINSPECTION_REQUIRED'

export interface VerificationCheck {
  key: string
  label: string
  pass: boolean
  detail: string
}

export interface Verification {
  id: string
  workOrderId: string
  issueId: string
  result: VerificationResult | null
  checks: VerificationCheck[]
  notes: string
  inspectorId: string | null
  createdAt: string
}

export interface Issue {
  id: string
  title: string
  category: IssueCategory
  departmentId: string | null
  crewId: string | null
  priority: Priority
  priorityScore: PriorityScore | null
  trust: TrustScore | null
  status: IssueStatus
  point: GeoPoint
  address: string
  reportIds: string[]
  uniquePhotoCount: number
  workOrderId: string | null
  openedAt: string
  updatedAt: string
  closedAt: string | null
  /** seeded issues carry synthetic history */
  synthetic: boolean
}

export interface AuditEvent {
  id: string
  entityType: 'REPORT' | 'ISSUE' | 'WORK_ORDER' | 'VERIFICATION' | 'SESSION'
  entityId: string
  action: string
  detail: string
  actorId: string
  actorRole: Role | 'SYSTEM'
  createdAt: string
}

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH'

export interface AppNotification {
  id: string
  userId: string
  role: Role | 'ALL'
  title: string
  body: string
  issueId: string | null
  read: boolean
  createdAt: string
}

export interface RiskFactor {
  label: string
  detail: string
  contribution: number
}

export interface RiskPrediction {
  id: string
  category: IssueCategory
  zoneName: string
  point: GeoPoint
  radiusMeters: number
  currentRisk: number
  predictedRisk: number
  horizonDays: 7 | 30 | 90
  trend: { t: string; value: number }[]
  factors: RiskFactor[]
  recommendedAction: string
  label: 'LOW' | 'MEDIUM' | 'HIGH'
  synthetic: true
}

export interface CityStats {
  totalReports: number
  activeIssues: number
  highPriority: number
  underReview: number
  resolved: number
  slaBreached: number
  duplicateClusters: number
  avgTrustScore: number
  synthetic: true
}

/** master issue rollup shown in the duplicate-cluster view */
export interface MasterIssueSummary {
  issueId: string
  reportCount: number
  photoCount: number
  daysActive: number
  firstReportAt: string
  lastReportAt: string
}
