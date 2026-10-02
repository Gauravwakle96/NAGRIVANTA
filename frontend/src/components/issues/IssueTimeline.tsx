/**
 * IssueTimeline — §14.
 * Rendered from real audit events (never hard-coded status changes).
 * Steps not yet reached render hollow so the citizen sees what is next.
 */

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime, timeAgo } from '@/lib/format'
import type { AuditEvent, Issue } from '@/types/domain'

interface Milestone {
  key: string
  label: string
  hint: string
  match: (a: AuditEvent) => boolean
}

const MILESTONES: Milestone[] = [
  { key: 'received', label: 'Report received', hint: 'Citizen submission stored with evidence.', match: (a) => a.action === 'Citizen submitted report' },
  { key: 'ai', label: 'AI analysis', hint: 'Category and department identified.', match: (a) => a.action === 'AI analysis completed' },
  { key: 'trust', label: 'Trust checked', hint: 'Evidence and corroboration scored.', match: (a) => a.action === 'Trust evaluated' },
  { key: 'dup', label: 'Duplicate analysis', hint: 'Nearby reports grouped into this master issue.', match: (a) => a.action === 'Duplicate cluster updated' },
  { key: 'priority', label: 'Priority assessed', hint: 'Explainable score calculated.', match: (a) => a.action === 'Priority calculated' },
  { key: 'dept', label: 'Department assigned', hint: 'Responsible department confirmed.', match: (a) => a.action === 'Department assigned' },
  { key: 'crew', label: 'Crew dispatched', hint: 'Work order issued to a field crew.', match: (a) => a.action === 'Crew assigned' || a.action === 'Work order created' },
  { key: 'before', label: 'Before evidence', hint: 'Crew uploaded the site photo.', match: (a) => a.action === 'BEFORE evidence uploaded' },
  { key: 'repair', label: 'Repair', hint: 'Crew marks the repair complete.', match: (a) => a.action === 'Repair marked complete' || a.action === 'Status transition' },
  { key: 'after', label: 'After evidence', hint: 'Crew proved the fix.', match: (a) => a.action === 'AFTER evidence uploaded' },
  { key: 'verify', label: 'Verification', hint: 'Inspector compares before/after.', match: (a) => a.action === 'Verification completed' },
  { key: 'closed', label: 'Closed', hint: 'Issue resolved and visible to the citizen.', match: (a) => a.action === 'Issue closed' || a.action === 'Issue resolved' },
]

export function IssueTimeline({
  issue,
  audit,
  isLoading,
}: {
  issue: Issue
  audit: AuditEvent[]
  isLoading?: boolean
}) {
  const reached = useMemo(() => {
    const set = new Set<string>()
    for (const m of MILESTONES) {
      if (audit.some(m.match)) set.add(m.key)
    }
    // terminal shortcuts based on issue state
    if (['RESOLVED', 'CLOSED'].includes(issue.status)) {
      set.add('verify')
      set.add('repair')
      set.add('after')
      set.add('before')
      set.add('crew')
      set.add('dept')
    }
    if (issue.status !== 'REPORTED') set.add('priority')
    if (issue.departmentId) set.add('dept')
    if (issue.workOrderId) set.add('crew')
    if (issue.closedAt) set.add('closed')
    return set
  }, [audit, issue])

  const eventsByMilestone = useMemo(() => {
    const map = new Map<string, AuditEvent | undefined>()
    for (const m of MILESTONES) map.set(m.key, audit.find(m.match))
    return map
  }, [audit])

  // first unreached milestone = current focus
  const currentIndex = MILESTONES.findIndex((m) => !reached.has(m.key))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading timeline…
      </div>
    )
  }

  return (
    <ol className="relative space-y-0" aria-label="Issue timeline">
      {MILESTONES.map((m, i) => {
        const done = reached.has(m.key)
        const current = i === currentIndex
        const ev = eventsByMilestone.get(m.key)
        const last = i === MILESTONES.length - 1
        return (
          <li key={m.key} className="relative flex gap-4 pb-5 last:pb-0">
            {!last ? (
              <span
                className={cn('absolute left-[11px] top-6 h-full w-px', done ? 'bg-success/50' : 'bg-border')}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 mt-0.5 flex size-[23px] shrink-0 items-center justify-center rounded-full border-2 bg-background',
                done
                  ? 'border-success'
                  : current
                    ? 'border-primary'
                    : 'border-border',
              )}
              aria-hidden
            >
              {done ? (
                <span className="size-2.5 rounded-full bg-success" />
              ) : current ? (
                <span className="size-2.5 animate-pulse rounded-full bg-primary" />
              ) : (
                <span className="size-2 rounded-full bg-border" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={cn('text-sm font-semibold', done ? 'text-foreground' : current ? 'text-primary' : 'text-muted-foreground/70')}>
                  {m.label}
                  {current ? <span className="ml-2 text-xs font-normal text-primary">· in progress</span> : null}
                </p>
                {ev ? (
                  <time className="font-mono text-[10px] text-muted-foreground" dateTime={ev.createdAt} title={formatDateTime(ev.createdAt)}>
                    {timeAgo(ev.createdAt)}
                  </time>
                ) : null}
              </div>
              <p className={cn('mt-0.5 text-xs', done ? 'text-muted-foreground' : 'text-muted-foreground/60')}>
                {ev ? ev.detail : m.hint}
              </p>
              {ev && ev.actorRole !== 'SYSTEM' ? (
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  by {ev.actorId} · {ev.actorRole.replaceAll('_', ' ')}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
