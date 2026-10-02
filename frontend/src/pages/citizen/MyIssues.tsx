/** My Issues — reports submitted by the signed-in citizen. */

import { Link } from 'react-router-dom'
import { Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAllReports, useIssues } from '@/hooks/useService'
import { useSession } from '@/stores/session'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { STATUS_META } from '@/components/issues/statusMeta'
import { timeAgo } from '@/lib/format'
import { PRIORITY_META } from '@/config/app'

export default function MyIssues() {
  const user = useSession((s) => s.user)
  const issuesQ = useIssues()
  const reportsQ = useAllReports()

  if (issuesQ.isLoading || reportsQ.isLoading) return <LoadingState label="Loading your reports…" />
  if (issuesQ.isError) return <ErrorState onRetry={() => void issuesQ.refetch()} />

  const myReportIds = new Set(
    (reportsQ.data ?? []).filter((r) => r.submittedBy === (user?.id ?? 'u-citizen-1')).map((r) => r.id),
  )
  const mine = (issuesQ.data ?? []).filter((i) => i.reportIds.some((id) => myReportIds.has(id)))

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Citizen</p>
          <h1 className="text-2xl font-bold">My issues</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every problem you reported, with live status.
          </p>
        </div>
        <Button asChild><Link to="/report">Report a problem</Link></Button>
      </div>

      {mine.length === 0 ? (
        <EmptyState
          icon={<Ticket className="size-8" />}
          title="You haven't reported anything yet"
          description="Report a pothole, leak, garbage pile or broken streetlight — it takes about a minute."
          action={<Button asChild><Link to="/report">Report an issue</Link></Button>}
        />
      ) : (
        <ul className="space-y-3">
          {mine.map((issue) => {
            const p = PRIORITY_META[issue.priority]
            const s = STATUS_META[issue.status]
            return (
              <li key={issue.id}>
                <Link
                  to={`/issues/${issue.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className={`size-2.5 shrink-0 rounded-full ${p.dot}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">{issue.id}</span>
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{p.label}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium">{issue.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{issue.address}</span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <Badge className={s.className}>{s.label}</Badge>
                    <span className="mt-1.5 block font-mono text-[10px] text-muted-foreground">
                      updated {timeAgo(issue.updatedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
