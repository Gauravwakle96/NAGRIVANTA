/** Issue detail (§12-14): intelligence panel, timeline, evidence, audit. */

import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Images, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAudit, useEvidence, useIssue, useIssueReports, useMasterSummary } from '@/hooks/useService'
import { IssueIntelligencePanel } from '@/components/issues/IssueIntelligencePanel'
import { IssueTimeline } from '@/components/issues/IssueTimeline'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { STATUS_META } from '@/components/issues/statusMeta'
import { formatDateTime, timeAgo } from '@/lib/format'
import type { Evidence } from '@/types/domain'

function EvidenceGrid({ items }: { items: Evidence[] }) {
  if (items.length === 0) {
    return <EmptyState title="No evidence yet" description="Photos appear as citizens and crews upload them." />
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((ev) => (
        <figure key={ev.id} className="overflow-hidden rounded-lg border border-border/70 bg-muted">
          <img src={ev.url} alt={`${ev.kind} evidence ${ev.id}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          <figcaption className="flex items-center justify-between px-2 py-1.5 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">{ev.kind}</Badge>
            <span>{timeAgo(ev.uploadedAt)}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

export default function IssueDetail() {
  const { id } = useParams<{ id: string }>()
  const issueQ = useIssue(id)
  const reportsQ = useIssueReports(id)
  const auditQ = useAudit(id)
  const masterQ = useMasterSummary(id)

  const evidenceIds = [
    ...(reportsQ.data ?? []).map((r) => r.evidenceId).filter((x): x is string => Boolean(x)),
  ]
  const evidenceQ = useEvidence(evidenceIds)

  if (issueQ.isLoading) return <LoadingState label="Loading issue…" />
  if (issueQ.isError) return <ErrorState onRetry={() => void issueQ.refetch()} />
  if (!issueQ.data) {
    return (
      <EmptyState
        title={id ? `Issue ${id} not found` : 'No issue selected'}
        description="The ID may be mistyped or the demo data was reset."
        action={
          <Button asChild variant="outline">
            <Link to="/track">Track an issue</Link>
          </Button>
        }
      />
    )
  }

  const issue = issueQ.data
  const meta = STATUS_META[issue.status]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/track"><ArrowLeft className="mr-1.5 size-4" /> Back</Link>
          </Button>
          <h1 className="font-mono text-2xl font-bold">{issue.id}</h1>
          <p className="text-sm text-muted-foreground">{issue.title} · {issue.address}</p>
        </div>
        <div className="text-right">
          <Badge className={meta.className}>{meta.label}</Badge>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            opened {formatDateTime(issue.openedAt)}
          </p>
        </div>
      </div>

      <IssueIntelligencePanel issue={issue} master={masterQ.data} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4 text-primary" aria-hidden /> Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IssueTimeline issue={issue} audit={auditQ.data ?? []} isLoading={auditQ.isLoading} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Images className="size-4 text-primary" aria-hidden /> Evidence
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {issue.reportIds.length} report(s)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EvidenceGrid items={evidenceQ.data ?? []} />
              <div className="space-y-2 border-t border-border/60 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reports</p>
                {(reportsQ.data ?? []).map((r) => (
                  <div key={r.id} className="rounded-lg border border-border/70 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{r.id}</span>
                      <span className="text-muted-foreground" title={formatDateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{r.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(auditQ.data ?? []).slice(0, 12).map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 text-xs">
                    <span>
                      <span className="font-semibold">{a.action}</span>
                      <span className="text-muted-foreground"> — {a.detail}</span>
                    </span>
                    <time className="shrink-0 font-mono text-[10px] text-muted-foreground" dateTime={a.createdAt}>
                      {timeAgo(a.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
