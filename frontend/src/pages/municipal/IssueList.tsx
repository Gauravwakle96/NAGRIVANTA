/** Issue list with filters driven by the URL (KPI cards link here). */

import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Filter, MapPinned, Ticket, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORIES, DEPARTMENTS, PRIORITY_META } from '@/config/app'
import { useIssues } from '@/hooks/useService'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { STATUS_META } from '@/components/issues/statusMeta'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { IssueStatus } from '@/types/domain'

const ALL_STATUSES = Object.keys(STATUS_META) as IssueStatus[]

export default function IssueList() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const status = params.get('status')?.split(',').filter(Boolean) ?? []
  const category = params.get('category')?.split(',').filter(Boolean) ?? []
  const priority = params.get('priority')?.split(',').filter(Boolean) ?? []
  const department = params.get('department')?.split(',').filter(Boolean) ?? []
  const search = params.get('search') ?? ''

  const filter = useMemo(
    () => ({
      status: status as IssueStatus[] | undefined,
      category: category as never,
      priority: priority.length ? priority : undefined,
      departmentId: department.length ? department : undefined,
      search: search || undefined,
    }),
    [status, category, priority, department, search],
  )

  const q = useIssues(filter)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const toggleInList = (key: string, list: string[], value: string) => {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    setParam(key, next.length ? next.join(',') : null)
  }

  const hasFilters = status.length + category.length + priority.length + department.length > 0 || Boolean(search)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Issues</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {q.data ? `${q.data.length} issue${q.data.length === 1 ? '' : 's'} match the current filters.` : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/map"><MapPinned className="mr-2 size-4" /> Map view</Link>
          </Button>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
              <X className="mr-2 size-4" /> Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="size-3.5" aria-hidden /> Filters
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="q">Search</label>
            <Input
              id="q"
              value={search}
              onChange={(e) => setParam('search', e.target.value || null)}
              placeholder="ID, title or address"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Department</label>
            <Select value={department[0] ?? 'all'} onValueChange={(v) => setParam('department', v === 'all' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Category</label>
            <Select value={category[0] ?? 'all'} onValueChange={(v) => setParam('category', v === 'all' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Priority</label>
            <div className="flex flex-wrap gap-1.5">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleInList('priority', priority, p)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    priority.includes(p)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                  aria-pressed={priority.includes(p)}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status chips */}
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleInList('status', status, s)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  status.includes(s)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
                aria-pressed={status.includes(s)}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {q.isLoading ? (
        <LoadingState label="Loading issues…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Ticket className="size-8" />}
          title="No issues match"
          description={hasFilters ? 'Try removing a filter.' : 'No reports exist yet — the demo seed should provide data; try resetting demo data.'}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Issue</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map((i) => (
                  <tr
                    key={i.id}
                    className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-accent/50"
                    onClick={() => navigate(`/issues/${i.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-primary">{i.id}</span>
                      <span className="block max-w-[240px] truncate text-xs text-muted-foreground">{i.title}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{i.title.split(' — ')[0]}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground">{i.address}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('text-[10px]', PRIORITY_META[i.priority].className)}>
                        {PRIORITY_META[i.priority].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('text-[10px]', STATUS_META[i.status].className)}>{STATUS_META[i.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[10px] text-muted-foreground">{timeAgo(i.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
