/**
 * Service registry (§26).
 *
 * API-first when the backend answers its health check; every failed call
 * silently degrades to DemoDataProvider and records the downgrade so the UI
 * can show `DEMO MODE` (§24, §25). The UI never sees which implementation
 * served a request — it only reads `getService().mode`.
 */

import { ApiProvider } from '@/services/api/apiProvider'
import { DemoDataProvider } from '@/services/demo/demoProvider'
import type { NagrivantaService } from '@/services/types'
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
import type { IssueFilter, RepairSubmission, SubmitReportInput, VerificationDecision } from '@/services/types'

const demo = new DemoDataProvider()
const api = new ApiProvider()

let usingApi = false
let fellBack = false
const listeners = new Set<() => void>()

export function subscribeServiceMode(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  for (const fn of listeners) fn()
}

export function currentMode(): 'API' | 'DEMO' | 'FALLBACK' {
  if (!usingApi) return fellBack ? 'FALLBACK' : 'DEMO'
  return 'API'
}

/** Probe the backend once at boot; fall back silently if it is absent. */
export async function initServices(): Promise<void> {
  const ok = await api.healthCheck()
  usingApi = ok
  if (!ok) fellBack = true
  emit()
}

/** Force demo mode (used by settings/tests). */
export function useDemoMode(): void {
  usingApi = false
  fellBack = true
  emit()
}

/**
 * Wrap a demo call so exceptions inside demo logic still surface (demo is
 * local and should never fail — but if it does we must not white-screen).
 */
async function guard<T>(demoCall: () => Promise<T>): Promise<T> {
  return demoCall()
}

/** Run against API, downgrade on first failure, keep the workflow moving. */
async function withFallback<T>(apiCall: () => Promise<T>, demoCall: () => Promise<T>): Promise<T> {
  if (usingApi) {
    try {
      return await apiCall()
    } catch {
      usingApi = false
      fellBack = true
      emit()
    }
  }
  return guard(demoCall)
}

export function getService(): NagrivantaService {
  return {
    get mode() {
      return currentMode()
    },
    healthCheck: () => (usingApi ? api.healthCheck() : Promise.resolve(true)),

    listIssues: (filter?: IssueFilter) => withFallback(() => api.listIssues(filter), () => demo.listIssues(filter)),
    getIssue: (id: string) => withFallback(() => api.getIssue(id), () => demo.getIssue(id)),
    listReports: (issueId?: string) => withFallback(() => api.listReports(issueId), () => demo.listReports(issueId)),
    getReport: (id: string) => withFallback(() => api.getReport(id), () => demo.getReport(id)),
    listWorkOrders: (f?) => withFallback(() => api.listWorkOrders(f), () => demo.listWorkOrders(f)),
    getWorkOrder: (id: string) => withFallback(() => api.getWorkOrder(id), () => demo.getWorkOrder(id)),
    listEvidence: (ids: string[]) => withFallback(() => api.listEvidence(ids), () => demo.listEvidence(ids)),
    getEvidence: (id: string) => withFallback(() => api.getEvidence(id), () => demo.getEvidence(id)),
    listAudit: (entityId?: string) => withFallback(() => api.listAudit(entityId), () => demo.listAudit(entityId)),
    listNotifications: (userId: string, role: string) =>
      withFallback(() => api.listNotifications(userId, role), () => demo.listNotifications(userId, role)),
    listDepartments: () => withFallback(() => api.listDepartments(), () => demo.listDepartments()),
    listCrews: () => withFallback(() => api.listCrews(), () => demo.listCrews()),
    listVerifications: () => withFallback(() => api.listVerifications(), () => demo.listVerifications()),
    getStats: () => withFallback(() => api.getStats(), () => demo.getStats()),
    listRiskPredictions: (h) => withFallback(() => api.listRiskPredictions(h), () => demo.listRiskPredictions(h)),
    getMasterSummary: (id) => withFallback(() => api.getMasterSummary(id), () => demo.getMasterSummary(id)),

    classify: (input) => withFallback(() => api.classify(input), () => demo.classify(input)),
    checkDuplicates: (c) => withFallback(() => api.checkDuplicates(c), () => demo.checkDuplicates(c)),

    submitReport: (input: SubmitReportInput) =>
      withFallback(() => api.submitReport(input), () => demo.submitReport(input)),
    assignDepartment: (issueId, departmentId, actor) =>
      withFallback(() => api.assignDepartment(issueId, departmentId, actor), () => demo.assignDepartment(issueId, departmentId, actor)),
    createWorkOrder: (issueId, crewId, instructions, actor) =>
      withFallback(() => api.createWorkOrder(issueId, crewId, instructions, actor), () => demo.createWorkOrder(issueId, crewId, instructions, actor)),
    transitionWorkOrder: (id, status, actor, note?) =>
      withFallback(() => api.transitionWorkOrder(id, status, actor, note), () => demo.transitionWorkOrder(id, status, actor, note)),
    uploadEvidence: (id, kind, dataUrl, actor) =>
      withFallback(() => api.uploadEvidence(id, kind, dataUrl, actor), () => demo.uploadEvidence(id, kind, dataUrl, actor)),
    markRepaired: (id, note, actor) => withFallback(() => api.markRepaired(id, note, actor), () => demo.markRepaired(id, note, actor)),
    submitRepair: (id, submission: RepairSubmission, actor) =>
      withFallback(() => api.submitRepair(id, submission, actor), () => demo.submitRepair(id, submission, actor)),
    assignInspector: (id, inspectorId, actor) =>
      withFallback(() => api.assignInspector(id, inspectorId, actor), () => demo.assignInspector(id, inspectorId, actor)),
    recordVerification: (id, decision: VerificationDecision, actor) =>
      withFallback(() => api.recordVerification(id, decision, actor), () => demo.recordVerification(id, decision, actor)),
    markNotificationRead: (id) => withFallback(() => api.markNotificationRead(id), () => demo.markNotificationRead(id)),
    resetDemoData: () => withFallback(() => api.resetDemoData(), () => demo.resetDemoData()),
  } satisfies NagrivantaService
}

/* Re-exported types used by callers */
export type {
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
}
