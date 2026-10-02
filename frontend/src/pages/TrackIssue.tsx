/** Track an issue by ID (§14). Shows timeline from real audit events. */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAudit, useIssue, useMasterSummary } from '@/hooks/useService'
import { IssueTimeline } from '@/components/issues/IssueTimeline'
import { IssueIntelligencePanel } from '@/components/issues/IssueIntelligencePanel'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { STATUS_META } from '@/components/issues/statusMeta'

export default function TrackIssue() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('id') ?? ''
  const [draft, setDraft] = useState(initial)
  const id = params.get('id')?.trim().toUpperCase() ?? ''

  const issueQ = useIssue(id || undefined)
  const auditQ = useAudit(id || undefined)
  const masterQ = useMasterSummary(id || undefined)

  const submit = (value: string) => {
    const v = value.trim().toUpperCase()
    if (v) setParams({ id: v })
    else setParams({})
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Citizen · Track</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Track your issue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your issue ID (for example <span className="font-mono text-foreground">NGV-1001</span>) to see live status.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="NGV-1042"
          aria-label="Issue ID"
          className="font-mono uppercase"
        />
        <Button type="submit">
          <Search className="mr-2 size-4" aria-hidden /> Track
        </Button>
      </form>

      <div className="mt-8">
        {!id ? (
          <EmptyState
            icon={<Ticket className="size-8" />}
            title="Enter an issue ID"
            description="Paste the ID you received when reporting — it looks like NGV-1042. Try NGV-1001 for a seeded example."
          />
        ) : issueQ.isLoading ? (
          <LoadingState label="Loading issue…" />
        ) : issueQ.isError ? (
          <ErrorState onRetry={() => void issueQ.refetch()} />
        ) : !issueQ.data ? (
          <EmptyState
            title={`No issue ${id}`}
            description="Check the ID and try again, or browse your reports under My Issues."
            action={
              <Button asChild variant="outline">
                <Link to="/citizen/issues">My issues</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="font-mono text-lg">{issueQ.data.id}</CardTitle>
                  <Badge className={STATUS_META[issueQ.data.status].className}>
                    {STATUS_META[issueQ.data.status].label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{issueQ.data.title} · {issueQ.data.address}</p>
              </CardHeader>
              <CardContent>
                <IssueTimeline
                  issue={issueQ.data}
                  audit={auditQ.data ?? []}
                  isLoading={auditQ.isLoading}
                />
              </CardContent>
            </Card>

            <IssueIntelligencePanel issue={issueQ.data} master={masterQ.data} />

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to={`/issues/${issueQ.data.id}`}>Open full detail</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/report">Report another problem</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
