/** Audit log — append-only event stream (§21). */

import { useMemo, useState } from 'react'
import { FileClock, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAudit } from '@/hooks/useService'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const ROLE_TONE: Record<string, string> = {
  SYSTEM: 'text-muted-foreground',
  CITIZEN: 'text-primary',
  FIELD_CREW: 'text-warning',
  INSPECTOR: 'text-success',
  DEPARTMENT_OFFICER: 'text-chart-5',
  SUPERVISOR: 'text-chart-4',
  CITY_ADMIN: 'text-destructive',
  CITY_LEADERSHIP: 'text-foreground',
}

export default function AuditLog() {
  const q = useAudit()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = q.data ?? []
    if (role) list = list.filter((a) => a.actorRole === role)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(
        (a) =>
          a.action.toLowerCase().includes(s) ||
          a.detail.toLowerCase().includes(s) ||
          a.entityId.toLowerCase().includes(s),
      )
    }
    return list
  }, [q.data, search, role])

  const roles = useMemo(() => {
    const set = new Set((q.data ?? []).map((a) => a.actorRole))
    return [...set].sort()
  }, [q.data])

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal · Accountability</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Append-only: events are added, never edited or deleted.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, entity or detail"
            className="pl-9"
            aria-label="Search audit events"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by actor role">
          <button
            type="button"
            onClick={() => setRole(null)}
            className={cn('rounded-full border px-2.5 py-1 text-[11px]', !role ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
          >
            All
          </button>
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn('rounded-full border px-2.5 py-1 text-[11px]', role === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
            >
              {r.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading ? (
        <LoadingState label="Loading audit trail…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileClock className="size-8" />} title="No matching events" description="Adjust the search or role filter." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <ol className="divide-y divide-border/50">
            {filtered.slice(0, 200).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                <time className="font-mono text-[10px] text-muted-foreground" dateTime={a.createdAt}>
                  {formatDateTime(a.createdAt)}
                </time>
                <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">{a.entityType}</Badge>
                <span className="font-mono text-xs font-bold text-primary">{a.entityId}</span>
                <span className="text-sm font-semibold">{a.action}</span>
                <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">{a.detail}</span>
                <span className={cn('ml-auto font-mono text-[10px]', ROLE_TONE[a.actorRole] ?? 'text-muted-foreground')}>
                  {a.actorId} · {a.actorRole.replaceAll('_', ' ')}
                </span>
              </li>
            ))}
          </ol>
          {filtered.length > 200 ? (
            <p className="border-t border-border/60 px-4 py-2 text-center text-xs text-muted-foreground">
              Showing 200 of {filtered.length} events — narrow the search to see more.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
