/**
 * Command Center (§15) — KPI cards that actually navigate/filter.
 * Clicking a card routes to the issues list with that filter applied.
 */

import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  Eye,
  Map as MapIcon,
  PackageCheck,
  Radar,
  Ticket,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useIssues, useStats, useWorkOrders } from '@/hooks/useService'
import { DemoModeBadge } from '@/components/layout/AppShell'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { PRIORITY_META } from '@/config/app'
import { timeAgo } from '@/lib/format'
import { STATUS_META } from '@/components/issues/statusMeta'
import { cn } from '@/lib/utils'

interface Kpi {
  key: string
  label: string
  value: number
  icon: typeof Ticket
  tone: string
  to: string
}

export default function CommandCenter() {
  const navigate = useNavigate()
  const statsQ = useStats()
  const issuesQ = useIssues()
  const woQ = useWorkOrders()

  if (statsQ.isLoading || issuesQ.isLoading) return <LoadingState label="Loading command center…" />
  if (statsQ.isError) return <ErrorState onRetry={() => void statsQ.refetch()} />

  const stats = statsQ.data
  const issues = issuesQ.data ?? []
  const openWos = (woQ.data ?? []).filter((w) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(w.status))

  const kpis: Kpi[] = [
    { key: 'total', label: 'Total Reports', value: stats?.totalReports ?? 0, icon: Ticket, tone: 'text-primary', to: '/app/issues' },
    { key: 'active', label: 'Active Issues', value: stats?.activeIssues ?? 0, icon: AlertTriangle, tone: 'text-chart-5', to: '/app/issues?status=REPORTED,UNDER_REVIEW,TRIAGED,ASSIGNED,IN_PROGRESS,AWAITING_VERIFICATION' },
    { key: 'high', label: 'High Priority', value: stats?.highPriority ?? 0, icon: ArrowUpRight, tone: 'text-destructive', to: '/app/issues?priority=HIGH,CRITICAL' },
    { key: 'review', label: 'Under Review', value: stats?.underReview ?? 0, icon: Eye, tone: 'text-warning', to: '/app/issues?status=REPORTED,UNDER_REVIEW,TRIAGED' },
    { key: 'resolved', label: 'Resolved', value: stats?.resolved ?? 0, icon: PackageCheck, tone: 'text-success', to: '/app/issues?status=RESOLVED,CLOSED' },
    { key: 'breach', label: 'SLA Breached', value: stats?.slaBreached ?? 0, icon: ClipboardList, tone: 'text-destructive', to: '/app/work-orders' },
  ]

  const recent = [...issues].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 7)
  const hot = [...issues].filter((i) => ['HIGH', 'CRITICAL'].includes(i.priority)).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal · Operations</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            City-wide operational picture. Click any KPI to filter the issue list.
          </p>
        </div>
        <div className="flex gap-2">
          <DemoModeBadge />
          <Button asChild variant="outline" size="sm">
            <Link to="/app/map"><MapIcon className="mr-2 size-4" /> Live Map</Link>
          </Button>
        </div>
      </div>

      {/* KPI cards — each navigates */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => navigate(k.to)}
            className={cn(
              'group rounded-xl border border-border/70 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md',
              'focus-visible:outline-2 focus-visible:outline-ring',
            )}
          >
            <div className="flex items-center justify-between">
              <k.icon className={cn('size-4', k.tone)} aria-hidden />
              <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </div>
            <p className="mt-2 font-mono text-2xl font-black">{k.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="border-border/70 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recently updated issues</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/issues">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <EmptyState title="No issues yet" description="Reports will appear here as citizens submit them." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Issue</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="hidden px-4 py-2 font-medium sm:table-cell">Priority</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((i) => (
                    <tr
                      key={i.id}
                      className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-accent/50"
                      onClick={() => navigate(`/issues/${i.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs font-bold">{i.id}</span>
                        <span className="block truncate text-xs text-muted-foreground">{i.address}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{i.title.split(' — ')[0]}</td>
                      <td className="hidden px-4 py-2.5 sm:table-cell">
                        <Badge variant="outline" className={cn('text-[10px]', PRIORITY_META[i.priority].className)}>
                          {PRIORITY_META[i.priority].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn('text-[10px]', STATUS_META[i.status].className)}>{STATUS_META[i.status].label}</Badge>
                      </td>
                      <td className="hidden px-4 py-2.5 text-right font-mono text-[10px] text-muted-foreground md:table-cell">
                        {timeAgo(i.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Side column */}
        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top priorities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {hot.length === 0 ? (
                <p className="text-sm text-muted-foreground">No high-priority issues right now.</p>
              ) : (
                hot.map((i) => (
                  <Link
                    key={i.id}
                    to={`/issues/${i.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:border-destructive/40 hover:bg-destructive/5 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className={cn('size-2 shrink-0 rounded-full', PRIORITY_META[i.priority].dot)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-xs font-bold">{i.id}</span>
                      <span className="block truncate text-xs text-muted-foreground">{i.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-bold text-destructive">
                      {i.priorityScore?.score ?? '—'}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Open work orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-black">{openWos.length}</p>
              <p className="text-xs text-muted-foreground">active in the field</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/work-orders"><ClipboardList className="mr-2 size-4" /> Manage</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/app/risk"><Radar className="mr-2 size-4" /> Risk outlook</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Judge mode</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Run the whole acceptance scenario in order with one click.
              </p>
              <Button asChild className="mt-3 w-full">
                <Link to="/demo">Launch Guided Demo</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
