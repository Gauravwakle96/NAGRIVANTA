/**
 * DemoDataProvider — the default NagrivantaService (§24).
 *
 * Works fully offline: seeded deterministic dataset + pure intelligence
 * engines. Mutations (reports, work orders, verifications) persist to
 * localStorage so citizen → officer → crew → verifier flows survive a
 * reload within one browser. No external services required.
 */

import { DEPARTMENTS, SLA_POLICY } from '@/config/app'
import { daysBetween } from '@/lib/format'
import {
  analyzeDuplicates,
  calculatePriority,
  classify,
  evaluateTrust,
  severityForCategory,
  verifyRepair,
} from '@/services/engines'
import {
  createSeed,
  departmentName,
  demoEvidenceImage,
  instructionsFor,
  zoneAt,
} from '@/services/demo/seed'
import type { DemoSeed } from '@/services/demo/seed'
import { buildRiskPredictions } from '@/services/risk'
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
  PriorityScore,
  Report,
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

const STORAGE_KEY = 'nagrivanta.demo.v1'
const HOUR = 3_600_000
const DAY = 24 * HOUR

interface PersistShape {
  seedAt: number
  issues: Issue[]
  reports: Report[]
  evidence: Evidence[]
  workOrders: WorkOrder[]
  verifications: Verification[]
  audit: AuditEvent[]
  notifications: AppNotification[]
  seq: DemoSeed['seq']
}

/** Artificial latency so loading states are actually exercised (40-160ms). */
function delay<T>(value: T): Promise<T> {
  const ms = 40 + Math.floor(Math.random() * 120)
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function loadPersisted(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistShape
    if (!parsed || !Array.isArray(parsed.issues)) return null
    return parsed
  } catch {
    return null
  }
}

export class DemoDataProvider implements NagrivantaService {
  readonly mode = 'DEMO' as const

  private seed: DemoSeed
  private issues = new Map<string, Issue>()
  private reports = new Map<string, Report>()
  private evidence = new Map<string, Evidence>()
  private workOrders = new Map<string, WorkOrder>()
  private verifications = new Map<string, Verification>()
  private audit: AuditEvent[] = []
  private notifications: AppNotification[] = []
  private seq!: DemoSeed['seq']

  constructor() {
    const persisted = typeof localStorage !== 'undefined' ? loadPersisted() : null
    if (persisted) {
      this.seed = createSeed(persisted.seedAt)
      for (const i of persisted.issues) this.issues.set(i.id, i)
      for (const r of persisted.reports) this.reports.set(r.id, r)
      for (const e of persisted.evidence) this.evidence.set(e.id, e)
      for (const w of persisted.workOrders) this.workOrders.set(w.id, w)
      for (const v of persisted.verifications) this.verifications.set(v.id, v)
      this.audit = persisted.audit
      this.notifications = persisted.notifications
      this.seq = persisted.seq
      // seed anything the user hasn't touched
      this.mergeSeed(createSeed(persisted.seedAt))
    } else {
      this.seed = createSeed()
      this.mergeSeed(this.seed)
      this.persist()
    }
  }

  private mergeSeed(seed: DemoSeed) {
    for (const i of seed.issues) if (!this.issues.has(i.id)) this.issues.set(i.id, i)
    for (const r of seed.reports) if (!this.reports.has(r.id)) this.reports.set(r.id, r)
    for (const e of seed.evidence) if (!this.evidence.has(e.id)) this.evidence.set(e.id, e)
    for (const w of seed.workOrders) if (!this.workOrders.has(w.id)) this.workOrders.set(w.id, w)
    for (const v of seed.verifications) if (!this.verifications.has(v.id)) this.verifications.set(v.id, v)
    // seeded audit/notifications are additive-once: only add if list looks empty
    if (this.audit.length === 0) this.audit = [...seed.audit]
    if (this.notifications.length === 0) this.notifications = [...seed.notifications]
    this.seq = {
      issue: Math.max(this.seq?.issue ?? 0, seed.seq.issue),
      report: Math.max(this.seq?.report ?? 0, seed.seq.report),
      workOrder: Math.max(this.seq?.workOrder ?? 0, seed.seq.workOrder),
      evidence: Math.max(this.seq?.evidence ?? 0, seed.seq.evidence),
      audit: Math.max(this.seq?.audit ?? 0, seed.seq.audit),
      notification: Math.max(this.seq?.notification ?? 0, seed.seq.notification),
      verification: Math.max(this.seq?.verification ?? 0, seed.seq.verification),
    }
  }

  private persist(): void {
    try {
      const payload: PersistShape = {
        seedAt: this.seed ? Date.parse((this.audit[0]?.createdAt ?? new Date().toISOString())) || Date.now() : Date.now(),
        issues: [...this.issues.values()],
        reports: [...this.reports.values()],
        evidence: [...this.evidence.values()],
        workOrders: [...this.workOrders.values()],
        verifications: [...this.verifications.values()],
        audit: this.audit,
        notifications: this.notifications,
        seq: this.seq,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // quota or unavailable storage — demo continues in-memory (§25)
    }
  }

  /* ---------------- helpers ---------------- */

  private nextId(kind: keyof DemoSeed['seq']): string {
    const n = this.seq[kind]
    this.seq[kind] = n + 1
    switch (kind) {
      case 'issue':
        return `NGV-${n}`
      case 'report':
        return `RPT-${String(n).padStart(4, '0')}`
      case 'workOrder':
        return `WO-${String(n).padStart(4, '0')}`
      case 'evidence':
        return `EV-${String(n).padStart(5, '0')}`
      case 'audit':
        return `AUD-${String(n).padStart(5, '0')}`
      case 'notification':
        return `NTF-${String(n).padStart(5, '0')}`
      case 'verification':
        return `VER-${String(n).padStart(4, '0')}`
    }
  }

  private logAudit(
    entityType: AuditEvent['entityType'],
    entityId: string,
    action: string,
    detail: string,
    actorId: string,
    actorRole: AuditEvent['actorRole'],
  ): void {
    this.audit.push({
      id: this.nextId('audit'),
      entityType,
      entityId,
      action,
      detail,
      actorId,
      actorRole,
      createdAt: new Date().toISOString(),
    })
  }

  private notify(
    userId: string,
    role: AppNotification['role'],
    title: string,
    body: string,
    issueId: string | null,
  ): void {
    this.notifications.push({
      id: this.nextId('notification'),
      userId,
      role,
      title,
      body,
      issueId,
      read: false,
      createdAt: new Date().toISOString(),
    })
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  /* ---------------- reads ---------------- */

  async listIssues(filter?: IssueFilter): Promise<Issue[]> {
    let list = [...this.issues.values()]
    if (filter?.status?.length) list = list.filter((i) => filter.status?.includes(i.status))
    if (filter?.category?.length) list = list.filter((i) => filter.category?.includes(i.category))
    if (filter?.departmentId?.length)
      list = list.filter((i) => i.departmentId !== null && filter.departmentId?.includes(i.departmentId))
    if (filter?.priority?.length) list = list.filter((i) => filter.priority?.includes(i.priority))
    if (filter?.search) {
      const q = filter.search.toLowerCase()
      list = list.filter(
        (i) => i.id.toLowerCase().includes(q) || i.title.toLowerCase().includes(q) || i.address.toLowerCase().includes(q),
      )
    }
    if (filter?.boundingBox) {
      const b = filter.boundingBox
      list = list.filter((i) => i.point.lat >= b.minLat && i.point.lat <= b.maxLat && i.point.lng >= b.minLng && i.point.lng <= b.maxLng)
    }
    list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    return delay(filter?.limit ? list.slice(0, filter.limit) : list)
  }

  async getIssue(id: string): Promise<Issue | null> {
    return delay(this.issues.get(id) ?? null)
  }

  async listReports(issueId?: string): Promise<Report[]> {
    let list = [...this.reports.values()]
    if (issueId !== undefined) list = list.filter((r) => r.issueId === issueId)
    list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return delay(list)
  }

  async getReport(id: string): Promise<Report | null> {
    return delay(this.reports.get(id) ?? null)
  }

  async listWorkOrders(filter?: { status?: WorkOrderStatus[]; crewId?: string }): Promise<WorkOrder[]> {
    let list = [...this.workOrders.values()]
    if (filter?.status?.length) list = list.filter((w) => filter.status?.includes(w.status))
    if (filter?.crewId) list = list.filter((w) => w.crewId === filter.crewId)
    list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    return delay(list)
  }

  async getWorkOrder(id: string): Promise<WorkOrder | null> {
    return delay(this.workOrders.get(id) ?? null)
  }

  async listEvidence(ids: string[]): Promise<Evidence[]> {
    return delay(ids.map((id) => this.evidence.get(id)).filter((e): e is Evidence => Boolean(e)))
  }

  async getEvidence(id: string): Promise<Evidence | null> {
    return delay(this.evidence.get(id) ?? null)
  }

  async listAudit(entityId?: string): Promise<AuditEvent[]> {
    let list = [...this.audit]
    if (entityId) list = list.filter((a) => a.entityId === entityId)
    list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return delay(list)
  }

  async listNotifications(userId: string, role: string): Promise<AppNotification[]> {
    const list = this.notifications
      .filter((n) => n.userId === userId || n.role === role || n.role === 'ALL')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return delay(list)
  }

  async listDepartments(): Promise<Department[]> {
    return delay(DEPARTMENTS)
  }

  async listCrews(): Promise<Crew[]> {
    return delay(this.seed.crews)
  }

  async listVerifications(): Promise<Verification[]> {
    const list = [...this.verifications.values()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return delay(list)
  }

  async getStats(): Promise<CityStats> {
    const issues = [...this.issues.values()]
    const active = issues.filter((i) => !['CLOSED', 'REJECTED', 'RESOLVED'].includes(i.status))
    const now = Date.now()
    const breached = [...this.workOrders.values()].filter(
      (w) => Date.parse(w.slaDueAt) < now && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(w.status),
    )
    const trusted = issues.map((i) => i.trust?.score ?? 0).filter((s) => s > 0)
    const stats: CityStats = {
      totalReports: this.reports.size,
      activeIssues: active.length,
      highPriority: issues.filter((i) => i.priority === 'HIGH' || i.priority === 'CRITICAL').length,
      underReview: issues.filter((i) => ['REPORTED', 'UNDER_REVIEW', 'TRIAGED'].includes(i.status)).length,
      resolved: issues.filter((i) => ['RESOLVED', 'CLOSED'].includes(i.status)).length,
      slaBreached: breached.length,
      duplicateClusters: issues.filter((i) => i.reportIds.length > 1).length,
      avgTrustScore: trusted.length ? Math.round(trusted.reduce((a, b) => a + b, 0) / trusted.length) : 0,
      synthetic: true,
    }
    return delay(stats)
  }

  async listRiskPredictions(horizon: 7 | 30 | 90): Promise<RiskPrediction[]> {
    return delay(buildRiskPredictions(horizon))
  }

  async getMasterSummary(issueId: string): Promise<MasterIssueSummary | null> {
    const issue = this.issues.get(issueId)
    if (!issue) return delay(null)
    const reps = issue.reportIds
      .map((id) => this.reports.get(id))
      .filter((r): r is Report => Boolean(r))
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    const first = reps[0]?.createdAt ?? issue.openedAt
    const last = reps[reps.length - 1]?.createdAt ?? issue.updatedAt
    const summary: MasterIssueSummary = {
      issueId: issue.id,
      reportCount: issue.reportIds.length,
      photoCount: issue.uniquePhotoCount,
      daysActive: Math.max(1, Math.round(daysBetween(first, issue.closedAt ?? new Date().toISOString()))),
      firstReportAt: first,
      lastReportAt: last,
    }
    return delay(summary)
  }

  /* ---------------- intelligence ---------------- */

  async classify(input: { description: string; seedCategory?: IssueCategory | null }): Promise<ClassificationResult> {
    return delay(classify(input))
  }

  async checkDuplicates(candidate: {
    id: string
    point: GeoPoint
    description: string
    category: IssueCategory | null
    createdAt: string
  }): Promise<DuplicateAnalysis> {
    const others = [...this.reports.values()]
      .filter((r) => r.id !== candidate.id)
      .map((r) => ({
        id: r.id,
        issueId: r.issueId ?? '',
        point: r.point,
        description: r.description,
        category: r.category,
        createdAt: r.createdAt,
      }))
    return delay(analyzeDuplicates({ candidate, others }))
  }

  /* ---------------- mutations ---------------- */

  async submitReport(input: SubmitReportInput): Promise<SubmitReportResult> {
    const now = Date.now()
    const classification = await this.classify({
      description: input.description,
      seedCategory: input.overrideCategory ?? null,
    })

    /* evidence */
    let evidenceId: string | null = null
    if (input.imageDataUrl) {
      const ev: Evidence = {
        id: this.nextId('evidence'),
        kind: 'REPORT',
        url: input.imageDataUrl,
        caption: 'Citizen photo — compressed for upload',
        uploadedAt: new Date(now).toISOString(),
        uploadedBy: input.submittedBy,
        point: input.point,
      }
      this.evidence.set(ev.id, ev)
      evidenceId = ev.id
    }

    const reportId = this.nextId('report')
    const report: Report = {
      id: reportId,
      issueId: null,
      category: classification.category,
      description: input.description,
      point: input.point,
      address: input.address,
      evidenceId,
      submittedBy: input.submittedBy,
      createdAt: new Date(now).toISOString(),
      synthetic: false,
    }

    const others = [...this.reports.values()]
      .filter((r) => r.id !== reportId)
      .map((r) => ({
        id: r.id,
        issueId: r.issueId ?? '',
        point: r.point,
        description: r.description,
        category: r.category,
        createdAt: r.createdAt,
      }))
    const duplicates = analyzeDuplicates({ candidate: report, others })

    const trust = evaluateTrust({
      report,
      hasLocation: true,
      knownReporter: true,
      nearbyExistingCount: duplicates.matchedCount,
    })

    /* -------- merge or create master issue -------- */
    let issue: Issue
    let mergedIntoExisting = false

    const matchedIssues = new Map<string, number>()
    for (const m of duplicates.matches) {
      if (m.issueId) matchedIssues.set(m.issueId, (matchedIssues.get(m.issueId) ?? 0) + 1)
    }
    const dominant = [...matchedIssues.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    if (dominant && this.issues.has(dominant)) {
      // report joins the existing master issue
      mergedIntoExisting = true
      issue = this.issues.get(dominant) as Issue
      report.issueId = issue.id
      this.reports.set(report.id, report)
      issue.reportIds.push(report.id)
      if (evidenceId) issue.uniquePhotoCount += 1
      issue.updatedAt = new Date(now).toISOString()
      issue.trust = trust
      // absorb any matched pending reports (no issue yet) into this master
      for (const m of duplicates.matches) {
        if (m.issueId) continue
        const pending = this.reports.get(m.reportId)
        if (pending) {
          pending.issueId = issue.id
          issue.reportIds.push(pending.id)
          if (pending.evidenceId) issue.uniquePhotoCount += 1
        }
      }
      issue.priorityScore = this.recomputePriority(issue, now)
      issue.priority = issue.priorityScore.level
      this.issues.set(issue.id, issue)
    } else if (duplicates.matchedCount >= 1) {
      // create a NEW master issue and absorb all matched pending reports
      report.issueId = this.nextId('issue')
      this.reports.set(report.id, report)
      const matched = duplicates.matches
        .map((m) => this.reports.get(m.reportId))
        .filter((r): r is Report => Boolean(r))
      const absorbedIds = matched.map((r) => r.id)
      const photoCount = (report.evidenceId ? 1 : 0) + matched.filter((r) => r.evidenceId).length
      const firstAt = matched.reduce<string | null>(
        (acc, r) => (acc === null || +new Date(r.createdAt) < +new Date(acc) ? r.createdAt : acc),
        report.createdAt,
      )
      for (const r of matched) {
        r.issueId = report.issueId
        this.reports.set(r.id, r)
      }
      issue = this.blankIssue(report, classification, trust, now)
      issue.reportIds = [report.id, ...absorbedIds]
      issue.uniquePhotoCount = photoCount
      issue.openedAt = firstAt ?? report.createdAt
      issue.priorityScore = this.recomputePriority(issue, now)
      issue.priority = issue.priorityScore.level
      this.issues.set(issue.id, issue)
    } else {
      report.issueId = this.nextId('issue')
      this.reports.set(report.id, report)
      issue = this.blankIssue(report, classification, trust, now)
      issue.priorityScore = this.recomputePriority(issue, now)
      issue.priority = issue.priorityScore.level
      this.issues.set(issue.id, issue)
    }

    /* -------- priority + audit + notification -------- */
    const priority: PriorityScore = issue.priorityScore as PriorityScore

    this.logAudit('ISSUE', issue.id, 'Citizen submitted report', `Report ${report.id} received at ${input.address}.`, input.submittedBy, 'CITIZEN')
    this.logAudit('ISSUE', issue.id, 'AI analysis completed', `Classified as ${classification.categoryLabel} (${classification.confidence}% demo confidence).`, 'system', 'SYSTEM')
    this.logAudit('ISSUE', issue.id, 'Trust evaluated', `Trust score ${trust.score} — ${trust.label.replace('_', ' ')}.`, 'system', 'SYSTEM')
    if (duplicates.matchedCount > 0) {
      this.logAudit(
        'ISSUE',
        issue.id,
        'Duplicate cluster updated',
        `${duplicates.matchedCount + (mergedIntoExisting ? 1 : issue.reportIds.length - 1) + 1} similar reports clustered → 1 master issue ${issue.id}.`,
        'system',
        'SYSTEM',
      )
    }
    this.logAudit('ISSUE', issue.id, 'Priority calculated', `${priority.level} (${priority.score}/100): ${priority.explanation}`, 'system', 'SYSTEM')
    this.notify(input.submittedBy, 'CITIZEN', 'Your report has been received', `${issue.id} — ${classification.categoryLabel} near ${zoneAt(input.point).name}.`, issue.id)
    if (duplicates.matchedCount > 0) {
      this.notify(input.submittedBy, 'CITIZEN', 'Similar reports merged', `${duplicates.matchedCount} nearby report(s) grouped into ${issue.id}.`, issue.id)
    }

    this.persist()
    return delay({ report, issue, classification, trust, duplicates, priority, mergedIntoExisting })
  }

  private blankIssue(report: Report, classification: ClassificationResult, trust: SubmitReportResult['trust'], now: number): Issue {
    return {
      id: report.issueId as string,
      title: `${classification.categoryLabel} — ${zoneAt(report.point).name}`,
      category: classification.category,
      departmentId: null, // officer assigns explicitly (§6 flow)
      crewId: null,
      priority: 'LOW',
      priorityScore: null,
      trust,
      status: 'REPORTED',
      point: report.point,
      address: report.address,
      reportIds: [report.id],
      uniquePhotoCount: report.evidenceId ? 1 : 0,
      workOrderId: null,
      openedAt: report.createdAt,
      updatedAt: new Date(now).toISOString(),
      closedAt: null,
      synthetic: false,
    }
  }

  private recomputePriority(issue: Issue, now = Date.now()): PriorityScore {
    const zone = zoneAt(issue.point)
    return calculatePriority({
      reportCount: issue.reportIds.length,
      severity: severityForCategory(issue.category),
      category: issue.category,
      trafficClass: zone.trafficClass,
      daysOpen: Math.max(0, (now - Date.parse(issue.openedAt)) / DAY),
      priorWorkOrders: [...this.workOrders.values()].filter((w) => w.issueId === issue.id).length,
    })
  }

  async assignDepartment(issueId: string, departmentId: string, actor: User): Promise<Issue> {
    const issue = this.issues.get(issueId)
    if (!issue) throw new Error(`Issue ${issueId} not found`)
    issue.departmentId = departmentId
    if (['REPORTED', 'UNDER_REVIEW'].includes(issue.status)) issue.status = 'TRIAGED'
    issue.updatedAt = new Date().toISOString()
    this.issues.set(issue.id, issue)
    this.logAudit('ISSUE', issue.id, 'Department assigned', `Routed to ${departmentName(departmentId)}.`, actor.id, actor.role)
    this.notify('u-citizen-1', 'CITIZEN', 'Your issue has been assigned', `${issue.id} → ${departmentName(departmentId)}.`, issue.id)
    this.persist()
    return delay(issue)
  }

  async createWorkOrder(
    issueId: string,
    crewId: string,
    instructions: string,
    actor: User,
  ): Promise<{ issue: Issue; workOrder: WorkOrder }> {
    const issue = this.issues.get(issueId)
    if (!issue) throw new Error(`Issue ${issueId} not found`)
    const now = Date.now()
    const cfg = SLA_POLICY[issue.category] ?? 72

    const wo: WorkOrder = {
      id: this.nextId('workOrder'),
      issueId: issue.id,
      category: issue.category,
      priority: issue.priority,
      departmentId: issue.departmentId ?? (DEPARTMENTS[0]?.id ?? 'dept-road'),
      crewId,
      point: issue.point,
      address: issue.address,
      description: issue.title,
      instructions: instructions || instructionsFor(issue.category),
      status: 'ASSIGNED',
      slaDueAt: new Date(Date.parse(issue.openedAt) + cfg * HOUR).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      beforeEvidenceId: null,
      afterEvidenceId: null,
    }
    this.workOrders.set(wo.id, wo)

    issue.crewId = crewId
    issue.workOrderId = wo.id
    issue.status = 'ASSIGNED'
    issue.updatedAt = new Date(now).toISOString()
    this.issues.set(issue.id, issue)

    this.logAudit('WORK_ORDER', wo.id, 'Work order created', `${wo.id} created for ${issue.id}.`, actor.id, actor.role)
    this.logAudit('WORK_ORDER', wo.id, 'Crew assigned', `Crew ${crewId} dispatched.`, actor.id, actor.role)
    this.logAudit('ISSUE', issue.id, 'Crew assigned', `Crew ${crewId} dispatched.`, actor.id, actor.role)
    this.notify('u-citizen-1', 'CITIZEN', 'A crew has been dispatched', `${issue.id} — crew ${crewId} is on the way.`, issue.id)
    this.notify('u-crew-road-a', 'FIELD_CREW', 'New work order assigned', `${wo.id} — ${issue.title}.`, issue.id)
    this.persist()
    return delay({ issue, workOrder: wo })
  }

  async transitionWorkOrder(workOrderId: string, status: WorkOrderStatus, actor: User, note = ''): Promise<WorkOrder> {
    const wo = this.workOrders.get(workOrderId)
    if (!wo) throw new Error(`Work order ${workOrderId} not found`)
    const from = wo.status
    wo.status = status
    wo.updatedAt = new Date().toISOString()
    this.workOrders.set(wo.id, wo)
    this.logAudit('WORK_ORDER', wo.id, 'Status transition', `${from} → ${status}${note ? ` (${note})` : ''}`, actor.id, actor.role)

    const issue = this.issues.get(wo.issueId)
    if (issue) {
      const map: Partial<Record<WorkOrderStatus, Issue['status']>> = {
        ACCEPTED: 'ASSIGNED',
        DISPATCHED: 'IN_PROGRESS',
        IN_PROGRESS: 'IN_PROGRESS',
        REPAIR_SUBMITTED: 'AWAITING_VERIFICATION',
        VERIFICATION: 'AWAITING_VERIFICATION',
        RESOLVED: 'RESOLVED',
        REINSPECTION_REQUIRED: 'REINSPECTION_REQUIRED',
        CLOSED: 'CLOSED',
        CANCELLED: 'REJECTED',
      }
      const next = map[status]
      if (next) {
        issue.status = next
        if (next === 'RESOLVED' || next === 'CLOSED') issue.closedAt = new Date().toISOString()
        issue.updatedAt = new Date().toISOString()
        this.issues.set(issue.id, issue)
      }
      if (status === 'RESOLVED' || status === 'CLOSED') {
        this.logAudit('ISSUE', issue.id, 'Issue resolved', 'Verification passed — issue resolved.', actor.id, actor.role)
        this.notify('u-citizen-1', 'CITIZEN', 'Your issue has been resolved', `${issue.id} passed verification.`, issue.id)
      }
    }
    this.persist()
    return delay(wo)
  }

  async uploadEvidence(workOrderId: string, kind: 'BEFORE' | 'AFTER', dataUrl: string, actor: User): Promise<WorkOrder> {
    const wo = this.workOrders.get(workOrderId)
    if (!wo) throw new Error(`Work order ${workOrderId} not found`)
    const ev: Evidence = {
      id: this.nextId('evidence'),
      kind,
      url: dataUrl,
      caption: `${kind} evidence uploaded by ${actor.name}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: actor.id,
      point: wo.point,
    }
    this.evidence.set(ev.id, ev)
    if (kind === 'BEFORE') wo.beforeEvidenceId = ev.id
    else wo.afterEvidenceId = ev.id
    wo.updatedAt = ev.uploadedAt
    this.workOrders.set(wo.id, wo)
    this.logAudit('WORK_ORDER', wo.id, `${kind} evidence uploaded`, `Crew uploaded ${kind} photo.`, actor.id, actor.role)
    this.persist()
    return delay(wo)
  }

  async markRepaired(workOrderId: string, note: string, actor: User): Promise<WorkOrder> {
    const wo = this.workOrders.get(workOrderId)
    if (!wo) throw new Error(`Work order ${workOrderId} not found`)
    wo.repairNote = note
    wo.repairedAt = new Date().toISOString()
    wo.updatedAt = wo.repairedAt
    if (wo.status === 'ASSIGNED' || wo.status === 'ACCEPTED' || wo.status === 'DISPATCHED') {
      wo.status = 'IN_PROGRESS'
    }
    this.workOrders.set(wo.id, wo)
    this.logAudit('WORK_ORDER', wo.id, 'Repair marked complete', note || 'Crew marked repair done.', actor.id, actor.role)
    this.persist()
    return delay(wo)
  }

  async submitRepair(workOrderId: string, submission: RepairSubmission, actor: User): Promise<WorkOrder> {
    const wo = this.workOrders.get(workOrderId)
    if (!wo) throw new Error(`Work order ${workOrderId} not found`)
    if (submission.beforeImage && !wo.beforeEvidenceId) {
      await this.uploadEvidence(workOrderId, 'BEFORE', submission.beforeImage, actor)
    }
    if (submission.afterImage && !wo.afterEvidenceId) {
      await this.uploadEvidence(workOrderId, 'AFTER', submission.afterImage, actor)
    }
    if (submission.repairedFlag && !wo.repairedAt) {
      await this.markRepaired(workOrderId, submission.note, actor)
    }
    return this.transitionWorkOrder(workOrderId, 'REPAIR_SUBMITTED', actor, submission.note)
  }

  async assignInspector(workOrderId: string, inspectorId: string, actor: User): Promise<WorkOrder> {
    const wo = this.workOrders.get(workOrderId)
    if (!wo) throw new Error(`Work order ${workOrderId} not found`)
    wo.status = 'VERIFICATION'
    wo.updatedAt = new Date().toISOString()
    this.workOrders.set(wo.id, wo)
    this.logAudit('WORK_ORDER', wo.id, 'Inspector assigned', `Inspector ${inspectorId} assigned for reinspection.`, actor.id, actor.role)
    const issue = this.issues.get(wo.issueId)
    if (issue) {
      issue.status = 'AWAITING_VERIFICATION'
      issue.updatedAt = wo.updatedAt
      this.issues.set(issue.id, issue)
    }
    this.persist()
    return delay(wo)
  }

  async recordVerification(
    workOrderId: string,
    decision: VerificationDecision,
    actor: User,
  ): Promise<{ issue: Issue; workOrder: WorkOrder; verification: Verification }> {
    const wo = this.workOrders.get(workOrderId)
    if (!wo) throw new Error(`Work order ${workOrderId} not found`)

    const beforeEv = wo.beforeEvidenceId ? this.evidence.get(wo.beforeEvidenceId) : null
    const afterEv = wo.afterEvidenceId ? this.evidence.get(wo.afterEvidenceId) : null
    const engine = verifyRepair({
      hasBefore: Boolean(beforeEv),
      hasAfter: Boolean(afterEv),
      beforePoint: beforeEv?.point ?? wo.point,
      afterPoint: afterEv?.point ?? wo.point,
      repairedFlag: Boolean(wo.repairedAt),
      hoursSinceRepair: wo.repairedAt ? (Date.now() - Date.parse(wo.repairedAt)) / HOUR : 999,
      citizenReopened: false,
    })

    const verification: Verification = {
      id: this.nextId('verification'),
      workOrderId: wo.id,
      issueId: wo.issueId,
      result: decision.result,
      checks: engine.checks,
      notes: decision.notes,
      inspectorId: actor.id,
      createdAt: new Date().toISOString(),
    }
    this.verifications.set(verification.id, verification)

    this.logAudit('VERIFICATION', verification.id, 'Verification completed', `Result: ${decision.result.replace('_', ' ')}.`, actor.id, actor.role)
    this.persist()

    const issue = await this.transitionWorkOrder(
      wo.id,
      decision.result === 'RESOLVED' ? 'RESOLVED' : 'REINSPECTION_REQUIRED',
      actor,
      decision.notes,
    )
    const freshWo = this.workOrders.get(wo.id) as WorkOrder
    const freshIssue = this.issues.get(issue.id) as Issue
    return delay({ issue: freshIssue, workOrder: freshWo, verification })
  }

  async markNotificationRead(id: string): Promise<void> {
    const n = this.notifications.find((x) => x.id === id)
    if (n) {
      n.read = true
      this.persist()
    }
    return Promise.resolve()
  }

  async resetDemoData(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable — nothing to clear */
    }
    this.seed = createSeed()
    this.issues = new Map()
    this.reports = new Map()
    this.evidence = new Map()
    this.workOrders = new Map()
    this.verifications = new Map()
    this.audit = []
    this.notifications = []
    this.mergeSeed(this.seed)
    this.persist()
  }

  /** Re-exported so pages can generate placeholders without importing seed directly. */
  static placeholderImage = demoEvidenceImage
}
