/**
 * TanStack Query hooks over the service registry.
 * Every hook carries loading / error / empty handling by contract.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentMode, getService, subscribeServiceMode } from '@/services/registry'
import { useSession } from '@/stores/session'
import type { IssueFilter, RepairSubmission, SubmitReportInput, VerificationDecision } from '@/services/types'
import type { IssueCategory, WorkOrderStatus } from '@/types/domain'
import { useEffect, useState } from 'react'

/** Subscribe components to API↔DEMO mode changes. */
export function useServiceMode() {
  const [mode, setMode] = useState(currentMode())
  useEffect(() => subscribeServiceMode(() => setMode(currentMode())), [])
  return mode
}

export function useIssues(filter?: IssueFilter) {
  return useQuery({
    queryKey: ['issues', filter ?? {}],
    queryFn: () => getService().listIssues(filter),
  })
}

export function useIssue(id: string | undefined) {
  return useQuery({
    queryKey: ['issue', id],
    queryFn: () => getService().getIssue(id as string),
    enabled: Boolean(id),
  })
}

export function useIssueReports(issueId: string | undefined) {
  return useQuery({
    queryKey: ['reports', issueId],
    queryFn: () => getService().listReports(issueId),
    enabled: Boolean(issueId),
  })
}

export function useAllReports() {
  return useQuery({ queryKey: ['reports', 'all'], queryFn: () => getService().listReports() })
}

export function useWorkOrders(filter?: { status?: WorkOrderStatus[]; crewId?: string }) {
  return useQuery({
    queryKey: ['work-orders', filter ?? {}],
    queryFn: () => getService().listWorkOrders(filter),
  })
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['work-order', id],
    queryFn: () => getService().getWorkOrder(id as string),
    enabled: Boolean(id),
  })
}

export function useEvidence(ids: string[]) {
  const key = ids.join(',')
  return useQuery({
    queryKey: ['evidence', key],
    queryFn: () => getService().listEvidence(key ? key.split(',') : []),
    enabled: key.length > 0,
  })
}

export function useAudit(entityId?: string) {
  return useQuery({
    queryKey: ['audit', entityId ?? 'all'],
    queryFn: () => getService().listAudit(entityId),
  })
}

export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: () => getService().getStats() })
}

export function useRiskPredictions(horizon: 7 | 30 | 90) {
  return useQuery({
    queryKey: ['risk', horizon],
    queryFn: () => getService().listRiskPredictions(horizon),
  })
}

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: () => getService().listDepartments() })
}

export function useCrews() {
  return useQuery({ queryKey: ['crews'], queryFn: () => getService().listCrews() })
}

export function useVerifications() {
  return useQuery({ queryKey: ['verifications'], queryFn: () => getService().listVerifications() })
}

export function useMasterSummary(issueId: string | undefined) {
  return useQuery({
    queryKey: ['master-summary', issueId],
    queryFn: () => getService().getMasterSummary(issueId as string),
    enabled: Boolean(issueId),
  })
}

export function useNotifications() {
  const user = useSession((s) => s.user)
  return useQuery({
    queryKey: ['notifications', user?.id ?? 'anon'],
    queryFn: () => getService().listNotifications(user?.id ?? 'anon', user?.role ?? 'CITIZEN'),
    enabled: Boolean(user),
  })
}

/* ---------------- mutations ---------------- */

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries()
  }
}

export function useSubmitReport() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: SubmitReportInput) => getService().submitReport(input),
    onSuccess: invalidate,
  })
}

export function useClassify() {
  return useMutation({
    mutationFn: (input: { description: string; seedCategory?: IssueCategory | null }) =>
      getService().classify(input),
  })
}

export function useCheckDuplicates() {
  return useMutation({
    mutationFn: (candidate: {
      id: string
      point: { lat: number; lng: number }
      description: string
      category: IssueCategory | null
      createdAt: string
    }) => getService().checkDuplicates(candidate),
  })
}

export function useAssignDepartment() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ issueId, departmentId, actor }: { issueId: string; departmentId: string; actor: Parameters<ReturnType<typeof getService>['assignDepartment']>[2] }) =>
      getService().assignDepartment(issueId, departmentId, actor),
    onSuccess: invalidate,
  })
}

export function useCreateWorkOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      issueId,
      crewId,
      instructions,
      actor,
    }: {
      issueId: string
      crewId: string
      instructions: string
      actor: Parameters<ReturnType<typeof getService>['createWorkOrder']>[3]
    }) => getService().createWorkOrder(issueId, crewId, instructions, actor),
    onSuccess: invalidate,
  })
}

export function useTransitionWorkOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      workOrderId,
      status,
      actor,
      note,
    }: {
      workOrderId: string
      status: WorkOrderStatus
      actor: Parameters<ReturnType<typeof getService>['transitionWorkOrder']>[2]
      note?: string
    }) => getService().transitionWorkOrder(workOrderId, status, actor, note),
    onSuccess: invalidate,
  })
}

export function useUploadEvidence() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      workOrderId,
      kind,
      dataUrl,
      actor,
    }: {
      workOrderId: string
      kind: 'BEFORE' | 'AFTER'
      dataUrl: string
      actor: Parameters<ReturnType<typeof getService>['uploadEvidence']>[3]
    }) => getService().uploadEvidence(workOrderId, kind, dataUrl, actor),
    onSuccess: invalidate,
  })
}

export function useMarkRepaired() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ workOrderId, note, actor }: { workOrderId: string; note: string; actor: Parameters<ReturnType<typeof getService>['markRepaired']>[2] }) =>
      getService().markRepaired(workOrderId, note, actor),
    onSuccess: invalidate,
  })
}

export function useSubmitRepair() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      workOrderId,
      submission,
      actor,
    }: {
      workOrderId: string
      submission: RepairSubmission
      actor: Parameters<ReturnType<typeof getService>['submitRepair']>[2]
    }) => getService().submitRepair(workOrderId, submission, actor),
    onSuccess: invalidate,
  })
}

export function useAssignInspector() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ workOrderId, inspectorId, actor }: { workOrderId: string; inspectorId: string; actor: Parameters<ReturnType<typeof getService>['assignInspector']>[2] }) =>
      getService().assignInspector(workOrderId, inspectorId, actor),
    onSuccess: invalidate,
  })
}

export function useRecordVerification() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      workOrderId,
      decision,
      actor,
    }: {
      workOrderId: string
      decision: VerificationDecision
      actor: Parameters<ReturnType<typeof getService>['recordVerification']>[2]
    }) => getService().recordVerification(workOrderId, decision, actor),
    onSuccess: invalidate,
  })
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => getService().markNotificationRead(id),
    onSuccess: invalidate,
  })
}

export function useResetDemo() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: () => getService().resetDemoData(), onSuccess: invalidate })
}
