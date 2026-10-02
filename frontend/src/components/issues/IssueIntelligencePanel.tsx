/**
 * IssueIntelligencePanel — §12.
 * One panel answering every "why?" the system produced: trust, duplicates,
 * priority reasoning, department and crew.
 */

import { Link } from 'react-router-dom'
import {
  Building2,
  Gauge,
  GitMerge,
  HardHat,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEPARTMENTS, PRIORITY_META } from '@/config/app'
import { cn } from '@/lib/utils'
import type { Issue, MasterIssueSummary } from '@/types/domain'

function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: typeof Gauge
  title: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-border/60 pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-primary" aria-hidden />
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h4>
        {badge ? (
          <Badge variant="outline" className="ml-auto font-mono text-[9px] tracking-wider">
            {badge}
          </Badge>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export function IssueIntelligencePanel({
  issue,
  master,
}: {
  issue: Issue
  master?: MasterIssueSummary | null
}) {
  const dept = DEPARTMENTS.find((d) => d.id === issue.departmentId)
  const meta = PRIORITY_META[issue.priority]

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-mono text-base">ISSUE #{issue.id}</CardTitle>
          <span className={cn('rounded-md px-2.5 py-1 text-xs font-bold', meta.className)}>
            {meta.label} PRIORITY
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{issue.title}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Link to={`/city-map?focus=${issue.id}`} className="underline-offset-2 hover:text-primary hover:underline">
              {issue.address}
            </Link>
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* WHY / priority */}
        <Section icon={Gauge} title="Why?" badge={issue.priorityScore?.simulated ? 'SIMULATED' : undefined}>
          {issue.priorityScore ? (
            <>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-black text-primary">{issue.priorityScore.score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
                <span className={cn('ml-auto rounded px-2 py-0.5 text-xs font-bold', meta.className)}>{meta.label}</span>
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Priority score ${issue.priorityScore.score} of 100`}>
                <div
                  className={cn('h-full rounded-full', issue.priority === 'HIGH' || issue.priority === 'CRITICAL' ? 'bg-destructive' : issue.priority === 'MEDIUM' ? 'bg-warning' : 'bg-muted-foreground')}
                  style={{ width: `${issue.priorityScore.score}%` }}
                />
              </div>
              <ul className="space-y-1.5">
                {issue.priorityScore.factors.map((f) => (
                  <li key={f.label} className="flex items-baseline justify-between gap-3 text-xs">
                    <span>
                      <span className="font-semibold text-foreground">{f.label}</span>
                      <span className="text-muted-foreground"> — {f.detail}</span>
                    </span>
                    <span className="shrink-0 font-mono font-semibold">+{f.points}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">{issue.priorityScore.explanation}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Priority not calculated yet.</p>
          )}
        </Section>

        {/* TRUST */}
        <Section icon={ShieldCheck} title="Trust" badge="DEMO SCORE">
          {issue.trust ? (
            <>
              <div className="flex items-center gap-3">
                <span className={cn('text-lg font-bold', issue.trust.score >= 70 ? 'text-success' : issue.trust.score >= 50 ? 'text-warning' : 'text-destructive')}>
                  {issue.trust.score}%
                </span>
                <Badge variant="outline">{issue.trust.label.replace('_', ' ')}</Badge>
              </div>
              <ul className="mt-2 space-y-1">
                {issue.trust.factors.slice(0, 4).map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn('mt-1 size-1.5 shrink-0 rounded-full', f.impact === 'POSITIVE' ? 'bg-success' : f.impact === 'NEGATIVE' ? 'bg-destructive' : 'bg-muted-foreground')}
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{f.label} — {f.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Trust analysis pending.</p>
          )}
        </Section>

        {/* DUPLICATES */}
        <Section icon={GitMerge} title="Duplicates">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono text-xl font-black">{issue.reportIds.length} REPORTS</span>
            <span className="text-muted-foreground" aria-hidden>↓</span>
            <span className="font-semibold text-foreground">1 MASTER ISSUE</span>
            <span className="text-muted-foreground" aria-hidden>↓</span>
            <span className="font-semibold text-foreground">{issue.workOrderId ? '1 WORK ORDER' : 'WORK ORDER PENDING'}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-border/70 p-2">
              <p className="font-mono text-lg font-bold">{master?.reportCount ?? issue.reportIds.length}</p>
              <p className="text-muted-foreground">reports</p>
            </div>
            <div className="rounded-lg border border-border/70 p-2">
              <p className="font-mono text-lg font-bold">{master?.photoCount ?? issue.uniquePhotoCount}</p>
              <p className="text-muted-foreground">unique photos</p>
            </div>
            <div className="rounded-lg border border-border/70 p-2">
              <p className="font-mono text-lg font-bold">{master?.daysActive ?? 1}</p>
              <p className="text-muted-foreground">days active</p>
            </div>
          </div>
        </Section>

        {/* DEPARTMENT + CREW */}
        <Section icon={Building2} title="Department & crew">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Department</dt>
              <dd className="font-semibold">{dept?.name ?? <span className="text-warning">Unassigned — officer action required</span>}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Crew</dt>
              <dd className="font-semibold">
                {issue.crewId ?? <span className="text-muted-foreground">Not dispatched yet</span>}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Work order</dt>
              <dd className="font-mono text-xs">
                {issue.workOrderId ? (
                  <Link to="/app/work-orders" className="text-primary underline-offset-2 hover:underline">
                    {issue.workOrderId}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">none</span>
                )}
              </dd>
            </div>
          </dl>
          {issue.crewId ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardHat className="size-3.5" aria-hidden /> Crew {issue.crewId} owns this work order.
            </p>
          ) : null}
        </Section>
      </CardContent>
    </Card>
  )
}
