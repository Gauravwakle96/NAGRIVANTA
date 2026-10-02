/** Crew dashboard — mobile-first today's jobs list (§19). */

import { Link } from 'react-router-dom'
import { HardHat, MapPin, Navigation } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCrews, useWorkOrders } from '@/hooks/useService'
import { useSession } from '@/stores/session'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { WO_STATUS_META } from '@/components/issues/statusMeta'
import { PRIORITY_META } from '@/config/app'
import { CITY_CENTER } from '@/config/app'
import { formatDistance, haversineMeters, hoursUntil } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function CrewDashboard() {
  const user = useSession((s) => s.user)
  const woQ = useWorkOrders()
  const crewsQ = useCrews()

  const crewId = user?.crewId ?? 'crew-road-a'
  const crew = (crewsQ.data ?? []).find((c) => c.id === crewId)

  if (woQ.isLoading) return <LoadingState label="Loading today's jobs…" />
  if (woQ.isError) return <ErrorState onRetry={() => void woQ.refetch()} />

  const myJobs = (woQ.data ?? [])
    .filter((w) => w.crewId === crewId || user?.role === 'CITY_ADMIN')
    .filter((w) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(w.status))
    .map((w) => ({ wo: w, d: haversineMeters(w.point, w.point) }))
    .sort((a, b) => {
      // dispatch first, then distance from crew base
      const da = crew ? haversineMeters(a.wo.point, crew.basePoint) : 0
      const db = crew ? haversineMeters(b.wo.point, crew.basePoint) : 0
      return da - db
    })

  const today = (woQ.data ?? []).filter(
    (w) => w.crewId === crewId && Date.now() - Date.parse(w.createdAt) < 86_400_000,
  ).length

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Field crew portal</p>
          <h1 className="text-2xl font-bold">Today's jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {crew ? `${crew.name} · lead ${crew.leadName}` : 'Demo crew'} · {myJobs.length} open
          </p>
        </div>
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="size-5" aria-hidden />
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-border/70 bg-card p-3">
          <p className="font-mono text-xl font-black">{myJobs.length}</p>
          <p className="text-[10px] text-muted-foreground">open jobs</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card p-3">
          <p className="font-mono text-xl font-black">{today}</p>
          <p className="text-[10px] text-muted-foreground">new today</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card p-3">
          <p className="font-mono text-xl font-black text-success">
            {(woQ.data ?? []).filter((w) => w.crewId === crewId && ['RESOLVED', 'CLOSED'].includes(w.status)).length}
          </p>
          <p className="text-[10px] text-muted-foreground">done</p>
        </div>
      </div>

      {myJobs.length === 0 ? (
        <EmptyState
          icon={<HardHat className="size-8" />}
          title="No open jobs"
          description="When an officer dispatches a work order to your crew it appears here."
        />
      ) : (
        <ul className="space-y-3">
          {myJobs.map(({ wo }) => {
            const dist = crew ? haversineMeters(wo.point, crew.basePoint) : haversineMeters(wo.point, CITY_CENTER)
            const h = hoursUntil(wo.slaDueAt)
            const meta = WO_STATUS_META[wo.status]
            const p = PRIORITY_META[wo.priority]
            return (
              <li key={wo.id}>
                <Link
                  to={`/crew/jobs/${wo.id}`}
                  className="block rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{wo.category.replace('_', ' ').toLowerCase()}</span>
                        <Badge variant="outline" className={cn('text-[10px]', p.className)}>{p.label}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{wo.address}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden /> {formatDistance(dist)}
                        </span>
                        <span>{wo.id}</span>
                        <span className={h < 0 ? 'text-destructive' : h < 24 ? 'text-warning' : ''}>
                          {h < 0 ? `${Math.abs(Math.round(h))}h overdue` : `${Math.round(h)}h left`}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge className={cn('text-[10px]', meta.className)}>{meta.label}</Badge>
                      <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                        Open <Navigation className="size-3" aria-hidden />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
        Navigation opens your device's built-in maps app — no external mapping provider required (§19).
        <div className="mt-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/city-map">Open city map</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
