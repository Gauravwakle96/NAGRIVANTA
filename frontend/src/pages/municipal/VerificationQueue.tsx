/** Verification queue — inspectors compare before/after and decide (§20). */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEvidence, useRecordVerification, useVerifications, useWorkOrders } from '@/hooks/useService'
import { useSession } from '@/stores/session'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { BeforeAfterViewer, VerificationPanel } from '@/components/issues/BeforeAfterViewer'
import { WO_STATUS_META } from '@/components/issues/statusMeta'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VerificationResult, WorkOrder } from '@/types/domain'
import { toast } from 'sonner'

function Row({ wo, onDecide }: { wo: WorkOrder; onDecide: (wo: WorkOrder, r: VerificationResult, notes: string) => void }) {
  const evIds = [wo.beforeEvidenceId, wo.afterEvidenceId].filter((x): x is string => Boolean(x))
  const evQ = useEvidence(evIds)
  const before = (evQ.data ?? []).find((e) => e.id === wo.beforeEvidenceId) ?? null
  const after = (evQ.data ?? []).find((e) => e.id === wo.afterEvidenceId) ?? null
  const [busy, setBusy] = useState(false)

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-base">{wo.id}</CardTitle>
            <p className="text-sm text-muted-foreground">{wo.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-[10px]', WO_STATUS_META[wo.status].className)}>{WO_STATUS_META[wo.status].label}</Badge>
            <Button asChild size="sm" variant="ghost">
              <Link to={`/issues/${wo.issueId}`}>Open {wo.issueId}</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {evQ.isLoading ? (
          <LoadingState label="Loading evidence…" />
        ) : (
          <BeforeAfterViewer before={before} after={after} />
        )}
        <VerificationPanel
          input={{
            hasBefore: Boolean(before),
            hasAfter: Boolean(after),
            repairedFlag: Boolean(wo.repairedAt || wo.afterEvidenceId),
            hoursSinceRepair: wo.repairedAt ? (Date.now() - Date.parse(wo.repairedAt)) / 3_600_000 : 0,
            citizenReopened: false,
            beforePoint: before?.point ?? null,
            afterPoint: after?.point ?? null,
          }}
          busy={busy}
          onDecide={(result, notes) => {
            setBusy(true)
            onDecide(wo, result, notes)
            setBusy(false)
          }}
        />
      </CardContent>
    </Card>
  )
}

export default function VerificationQueue() {
  const woQ = useWorkOrders()
  const verQ = useVerifications()
  const user = useSession((s) => s.user)
  const record = useRecordVerification()

  const queue = (woQ.data ?? []).filter((w) => ['REPAIR_SUBMITTED', 'VERIFICATION', 'REINSPECTION_REQUIRED'].includes(w.status))

  const decide = async (wo: WorkOrder, result: VerificationResult, notes: string) => {
    if (!user) return
    try {
      await record.mutateAsync({ workOrderId: wo.id, decision: { result, notes }, actor: user })
      toast.success(result === 'RESOLVED' ? `${wo.issueId} resolved` : `${wo.issueId} sent for reinspection`, {
        description: result === 'RESOLVED' ? 'Citizen notified of the resolution.' : 'Assign an inspector to revisit the site.',
      })
      await woQ.refetch()
      await verQ.refetch()
    } catch {
      toast.error('Verification failed to record')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal · Quality</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Before/after evidence decides RESOLVED or REINSPECTION REQUIRED — never the crew's word alone.
        </p>
      </div>

      {woQ.isLoading ? (
        <LoadingState label="Loading verification queue…" />
      ) : woQ.isError ? (
        <ErrorState onRetry={() => void woQ.refetch()} />
      ) : queue.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-8" />}
          title="Verification queue is clear"
          description="Work orders appear here after crews submit repair evidence."
          action={
            <Button asChild variant="outline">
              <Link to="/crew">Open crew portal</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {queue.map((wo) => (
            <Row key={wo.id} wo={wo} onDecide={(w, r, n) => void decide(w, r, n)} />
          ))}
        </div>
      )}

      {(verQ.data ?? []).length > 0 ? (
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent verification decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(verQ.data ?? []).slice(0, 8).map((v) => (
                <li key={v.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="font-mono font-bold">{v.workOrderId}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px]',
                      v.result === 'RESOLVED' && 'text-success',
                      v.result === 'REINSPECTION_REQUIRED' && 'text-destructive',
                      !v.result && 'text-warning',
                    )}
                  >
                    {v.result ? v.result.replaceAll('_', ' ') : 'PENDING'}
                  </Badge>
                  <span className="text-muted-foreground">{v.notes}</span>
                  <time className="ml-auto font-mono text-[10px] text-muted-foreground" dateTime={v.createdAt}>
                    {timeAgo(v.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
