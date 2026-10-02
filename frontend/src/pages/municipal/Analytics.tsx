/** Analytics — city health, distributions and trends (leadership view). */

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIssues, useStats, useWorkOrders } from '@/hooks/useService'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { CATEGORIES, DEPARTMENTS, PRIORITY_META } from '@/config/app'
import { cityHistory } from '@/services/risk'
import { CATEGORY_LABELS } from '@/services/risk'

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'var(--muted-foreground)',
  MEDIUM: 'var(--chart-3)',
  HIGH: 'var(--chart-1)',
  CRITICAL: 'var(--destructive)',
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-black">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

export default function Analytics() {
  const statsQ = useStats()
  const issuesQ = useIssues()
  const woQ = useWorkOrders()

  const issues = issuesQ.data ?? []
  const wos = woQ.data ?? []

  const byCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of issues) {
      const label = CATEGORIES.find((c) => c.id === i.category)?.label ?? i.category
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }))
  }, [issues])

  const byPriority = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of issues) counts.set(i.priority, (counts.get(i.priority) ?? 0) + 1)
    return (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((p) => ({ name: p, value: counts.get(p) ?? 0 }))
  }, [issues])

  const byDept = useMemo(() => {
    return DEPARTMENTS.map((d) => ({
      name: d.shortName,
      total: issues.filter((i) => i.departmentId === d.id).length,
      resolved: issues.filter((i) => i.departmentId === d.id && ['RESOLVED', 'CLOSED'].includes(i.status)).length,
    }))
  }, [issues])

  const history = useMemo(() => {
    const h = cityHistory()
    const months = h[0]?.monthly.map((_, idx) => idx) ?? []
    return months.map((idx) => {
      const row: Record<string, string | number> = { m: `M${idx + 1}` }
      for (const cat of h) row[cat.category] = cat.monthly[idx] ?? 0
      row.total = h.reduce((sum, cat) => sum + (cat.monthly[idx] ?? 0), 0)
      return row
    })
  }, [])

  if (statsQ.isLoading || issuesQ.isLoading) return <LoadingState label="Loading analytics…" />
  if (statsQ.isError) return <ErrorState onRetry={() => void statsQ.refetch()} />

  const stats = statsQ.data
  const resolvedRate = stats && stats.totalReports > 0 ? Math.round((stats.resolved / Math.max(1, issues.length)) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal · Performance</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          City health and workload distribution over synthetic demo data.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total reports" value={stats?.totalReports ?? 0} sub="all time (demo)" />
        <Kpi label="Active issues" value={stats?.activeIssues ?? 0} sub="open work" />
        <Kpi label="Resolved" value={stats?.resolved ?? 0} sub={`${resolvedRate}% of issues`} />
        <Kpi label="SLA breached" value={stats?.slaBreached ?? 0} sub="open past due" />
        <Kpi label="Duplicate clusters" value={stats?.duplicateClusters ?? 0} sub="multi-report masters" />
        <Kpi label="Avg trust score" value={`${stats?.avgTrustScore ?? 0}%`} sub="demo confidence" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader className="pb-3"><CardTitle className="text-base">Issues by category</CardTitle></CardHeader>
          <CardContent className="h-64">
            {byCategory.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3"><CardTitle className="text-base">Priority distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byPriority} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {byPriority.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Department load vs resolved</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">12-month incident trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="total" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="POTHOLE" stroke="var(--color-chart-3)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="WATER_LEAK" stroke="var(--color-chart-5)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-primary" aria-hidden /> Work order pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['ASSIGNED', 'IN_PROGRESS', 'VERIFICATION', 'RESOLVED'] as const).map((s) => {
              const n = wos.filter((w) => w.status === s).length
              return (
                <div key={s} className="rounded-lg border border-border/70 p-3 text-center">
                  <p className="font-mono text-xl font-black">{n}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.replaceAll('_', ' ')}</p>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Priority mix:{' '}
            {byPriority.map((p) => `${PRIORITY_META[p.name as keyof typeof PRIORITY_META].label}: ${p.value}`).join(' · ')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Categories tracked: {CATEGORIES.map((c) => CATEGORY_LABELS[c.id]).join(', ')}.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
