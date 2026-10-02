/**
 * Work orders (§18) — creation, table and status transitions.
 * Every transition appends an audit event (server/demo enforced).
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCrews, useIssues, useTransitionWorkOrder, useWorkOrders } from '@/hooks/useService'
import { useSession } from '@/stores/session'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { WO_STATUS_META } from '@/components/issues/statusMeta'
import { PRIORITY_META, SLA_POLICY } from '@/config/app'
import { hoursUntil, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { WorkOrder, WorkOrderStatus } from '@/types/domain'
import { toast } from 'sonner'

const NEXT_TRANSITIONS: Partial<Record<WorkOrderStatus, { to: WorkOrderStatus; label: string }[]>> = {
  ASSIGNED: [
    { to: 'ACCEPTED', label: 'Crew accepted' },
    { to: 'CANCELLED', label: 'Cancel' },
  ],
  ACCEPTED: [{ to: 'DISPATCHED', label: 'Dispatch crew' }],
  DISPATCHED: [{ to: 'IN_PROGRESS', label: 'Start work' }],
  IN_PROGRESS: [{ to: 'REPAIR_SUBMITTED', label: 'Submit repair' }],
  REPAIR_SUBMITTED: [{ to: 'VERIFICATION', label: 'Send to verification' }],
  VERIFICATION: [
    { to: 'RESOLVED', label: 'Mark resolved' },
    { to: 'REINSPECTION_REQUIRED', label: 'Require reinspection' },
  ],
  REINSPECTION_REQUIRED: [{ to: 'VERIFICATION', label: 'Re-verify' }],
  RESOLVED: [{ to: 'CLOSED', label: 'Close work order' }],
}

function SlaChip({ wo }: { wo: WorkOrder }) {
  const terminal = ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(wo.status)
  const h = hoursUntil(wo.slaDueAt)
  if (terminal) return <span className="font-mono text-[10px] text-success">met</span>
  if (h < 0)
    return (
      <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
        BREACHED {Math.abs(Math.round(h))}h
      </span>
    )
  if (h < 24)
    return (
      <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-warning">
        {Math.round(h)}h left
      </span>
    )
  return <span className="font-mono text-[10px] text-muted-foreground">{Math.round(h)}h left</span>
}

export default function WorkOrders() {
  const q = useWorkOrders()
  const issuesQ = useIssues()
  const crewsQ = useCrews()
  const user = useSession((s) => s.user)
  const navigate = useNavigate()
  const transition = useTransitionWorkOrder()

  const [createOpen, setCreateOpen] = useState(false)
  const [issueId, setIssueId] = useState('')
  const [crewId, setCrewId] = useState('')
  const [instructions, setInstructions] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ wo: WorkOrder; to: WorkOrderStatus; label: string } | null>(null)

  const unassignedIssues = (issuesQ.data ?? []).filter(
    (i) => !i.workOrderId && !['CLOSED', 'REJECTED', 'RESOLVED'].includes(i.status),
  )

  const doCreate = async () => {
    if (!issueId || !crewId || !user) {
      setCreateError('Choose an issue and a crew.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const { getService } = await import('@/services/registry')
      const res = await getService().createWorkOrder(issueId, crewId, instructions, user)
      toast.success(`Work order ${res.workOrder.id} created`, {
        description: `Dispatched to ${crewsQ.data?.find((c) => c.id === crewId)?.name ?? crewId}`,
      })
      setCreateOpen(false)
      setIssueId('')
      setCrewId('')
      setInstructions('')
      await q.refetch()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create the work order.')
    } finally {
      setCreating(false)
    }
  }

  const doTransition = async () => {
    if (!pending || !user) return
    const prev = transition.isPending
    try {
      await transition.mutateAsync({ workOrderId: pending.wo.id, status: pending.to, actor: user })
      toast.success(`${pending.wo.id} → ${pending.label}`)
      setPending(null)
      await q.refetch()
    } catch {
      toast.error('Transition failed')
    } finally {
      void prev
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal · Execution</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Work Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Status transitions are audited: NEW → … → CLOSED (§18).
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" aria-hidden /> Create work order
        </Button>
      </div>

      {q.isLoading ? (
        <LoadingState label="Loading work orders…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="No work orders yet"
          description="Assign a department and crew to an issue to create the first one."
          action={<Button onClick={() => setCreateOpen(true)}>Create work order</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(q.data ?? []).map((wo) => {
            const meta = WO_STATUS_META[wo.status]
            const nexts = NEXT_TRANSITIONS[wo.status] ?? []
            const crew = crewsQ.data?.find((c) => c.id === wo.crewId)
            return (
              <div key={wo.id} className="flex flex-col rounded-xl border border-border/70 bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold">{wo.id}</span>
                  <Badge className={cn('text-[10px]', meta.className)}>{meta.label}</Badge>
                </div>
                <p className="mt-1 text-sm font-medium">{wo.category.replace('_', ' ').toLowerCase()} · {wo.address}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {wo.issueId} · SLA <SlaChip wo={wo} />
                </p>
                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between"><dt>Priority</dt><dd className="font-semibold text-foreground">{PRIORITY_META[wo.priority].label}</dd></div>
                  <div className="flex justify-between"><dt>Crew</dt><dd className="font-semibold text-foreground">{crew?.name ?? wo.crewId ?? '—'}</dd></div>
                  <div className="flex justify-between"><dt>Updated</dt><dd>{timeAgo(wo.updatedAt)}</dd></div>
                </dl>
                <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-3">
                  <Button asChild size="sm" variant="ghost" className="flex-1">
                    <Link to={`/issues/${wo.issueId}`}>Open issue</Link>
                  </Button>
                  {nexts.map((n) => (
                    <Button
                      key={n.to}
                      size="sm"
                      variant={n.to === 'CANCELLED' ? 'destructive' : 'outline'}
                      disabled={transition.isPending}
                      onClick={() => setPending({ wo, to: n.to, label: n.label })}
                    >
                      {n.label}
                    </Button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create work order</DialogTitle>
            <DialogDescription>
              Picks up an unassigned issue and dispatches it to a crew. SLA derives from the category policy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wo-issue">Issue</Label>
              <Select value={issueId} onValueChange={setIssueId}>
                <SelectTrigger id="wo-issue"><SelectValue placeholder="Choose an unassigned issue" /></SelectTrigger>
                <SelectContent>
                  {unassignedIssues.length === 0 ? (
                    <SelectItem value="none" disabled>No unassigned issues</SelectItem>
                  ) : (
                    unassignedIssues.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.id} — {i.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="wo-crew">Crew</Label>
              <Select value={crewId} onValueChange={setCrewId}>
                <SelectTrigger id="wo-crew"><SelectValue placeholder="Choose a crew" /></SelectTrigger>
                <SelectContent>
                  {(crewsQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.memberCount} · {c.status.replaceAll('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="wo-instructions">Instructions</Label>
              <Textarea
                id="wo-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Leave blank to use the standard procedure for this category."
                rows={3}
              />
            </div>
            {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
            <p className="text-xs text-muted-foreground">
              SLA policy: {issueId ? SLA_POLICY[(issuesQ.data ?? []).find((i) => i.id === issueId)?.category ?? 'POTHOLE'] : '—'} hours from report time.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void doCreate()} disabled={creating || !issueId || !crewId}>
              {creating ? 'Creating…' : 'Create & dispatch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transition confirm */}
      <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm transition</DialogTitle>
            <DialogDescription>
              {pending ? `${pending.wo.id}: ${pending.wo.status} → ${pending.to}` : ''}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This appends an immutable audit event and updates the citizen-visible timeline.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              <X className="mr-2 size-4" /> Cancel
            </Button>
            <Button onClick={() => void doTransition()} disabled={transition.isPending}>
              {pending?.label ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-center text-xs text-muted-foreground">
        Crew-side execution lives in the{' '}
        <button type="button" className="underline" onClick={() => navigate('/crew')}>
          field crew portal
        </button>
        .
      </p>
    </div>
  )
}
