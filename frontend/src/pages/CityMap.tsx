/**
 * City Map page (§16) — layers, filters, map↔list synchronization,
 * selected-issue panel. Works even when tiles fail.
 */

import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { List, MapPinned } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RiskMap, type MapMode } from '@/components/maps/RiskMap'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCrews, useIssues, useRiskPredictions, useWorkOrders } from '@/hooks/useService'
import { CATEGORIES, DEPARTMENTS, PRIORITY_META } from '@/config/app'
import { STATUS_META } from '@/components/issues/statusMeta'
import { cn } from '@/lib/utils'

export default function CityMap() {
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<MapMode>('ISSUES')
  const [category, setCategory] = useState<string | null>(null)
  const [dept, setDept] = useState<string | null>(null)

  const issuesQ = useIssues()
  const woQ = useWorkOrders()
  const crewsQ = useCrews()
  const horizon = mode === 'PREDICTION' ? 90 : 30
  const riskQ = useRiskPredictions(horizon)

  const selected = params.get('focus')

  const issues = useMemo(() => {
    let list = issuesQ.data ?? []
    if (category) list = list.filter((i) => i.category === category)
    if (dept) list = list.filter((i) => i.departmentId === dept)
    return list
  }, [issuesQ.data, category, dept])

  if (issuesQ.isLoading) return <LoadingState label="Loading city map…" />
  if (issuesQ.isError) return <ErrorState onRetry={() => void issuesQ.refetch()} />

  const select = (id: string) => {
    const next = new URLSearchParams(params)
    if (id) next.set('focus', id)
    else next.delete('focus')
    setParams(next, { replace: true })
  }

  const focused = issues.find((i) => i.id === selected)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">City intelligence</p>
          <h1 className="text-2xl font-bold sm:text-3xl">City Map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {issues.length} issues · {woQ.data?.length ?? 0} work orders · {crewsQ.data?.length ?? 0} crews
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/command"><MapPinned className="mr-2 size-4" /> Command Center</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Category:</span>
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn('rounded-full border px-2.5 py-1 text-[11px]', !category ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn('rounded-full border px-2.5 py-1 text-[11px]', category === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Dept:</span>
          <select
            value={dept ?? ''}
            onChange={(e) => setDept(e.target.value || null)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            aria-label="Filter by department"
          >
            <option value="">All</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <RiskMap
          data={{ issues, workOrders: woQ.data ?? [], crews: crewsQ.data ?? [], risks: riskQ.data ?? [] }}
          mode={mode}
          onModeChange={setMode}
          focusIssueId={selected}
          selectedId={selected}
          onSelect={select}
          departmentFilter={null}
        />

        {/* Synchronized list */}
        <aside className="rounded-xl border border-border/70 bg-card">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <List className="size-4 text-primary" aria-hidden />
            <p className="text-sm font-semibold">Map list</p>
            <Badge variant="outline" className="ml-auto font-mono text-[10px]">{issues.length}</Badge>
          </div>
          {issues.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No issues match" description="Adjust the category or department filter." />
            </div>
          ) : (
            <ul className="max-h-[520px] divide-y divide-border/50 overflow-y-auto">
              {issues.slice(0, 60).map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => select(i.id)}
                    className={cn(
                      'flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring',
                      selected === i.id && 'bg-primary/8',
                    )}
                  >
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', PRIORITY_META[i.priority].dot)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold">{i.id}</span>
                        <span className="truncate text-[10px] text-muted-foreground">{i.title}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{i.address}</span>
                    </span>
                    <Badge className={cn('shrink-0 text-[9px]', STATUS_META[i.status].className)}>
                      {STATUS_META[i.status].label}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {focused ? (
            <div className="border-t border-border/60 p-4">
              <p className="font-mono text-sm font-bold">{focused.id}</p>
              <p className="text-xs text-muted-foreground">{focused.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{focused.address}</p>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link to={`/issues/${focused.id}`}>Open issue</Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => select('')}>Clear</Button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <p className="text-xs text-muted-foreground">
        Layers: issues, risk zones, duplicate clusters (multi-report issues), open work orders,
        active crews and predicted failures. Map tiles degrade gracefully — markers and filters
        keep working if tile servers are unreachable.
      </p>
    </div>
  )
}
