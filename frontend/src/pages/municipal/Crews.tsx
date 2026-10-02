/** Crews — roster and current load. */

import { HardHat, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCrews, useWorkOrders } from '@/hooks/useService'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { DEPARTMENTS } from '@/config/app'
import { cn } from '@/lib/utils'

export default function Crews() {
  const crewsQ = useCrews()
  const woQ = useWorkOrders()

  if (crewsQ.isLoading) return <LoadingState label="Loading crews…" />
  if (crewsQ.isError) return <ErrorState onRetry={() => void crewsQ.refetch()} />

  const crews = crewsQ.data ?? []
  const wos = woQ.data ?? []

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal · Resources</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Crews</h1>
        <p className="mt-1 text-sm text-muted-foreground">Field teams, their departments and live job load.</p>
      </div>

      {crews.length === 0 ? (
        <EmptyState title="No crews configured" description="Add crews via admin configuration (Phase 2)." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {crews.map((c) => {
            const dept = DEPARTMENTS.find((d) => d.id === c.departmentId)
            const jobs = wos.filter((w) => w.crewId === c.id && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(w.status))
            return (
              <Card key={c.id} className="border-border/70">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                      <HardHat className="size-4 text-primary" aria-hidden />
                    </span>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-auto text-[10px]',
                        c.status === 'AVAILABLE' && 'border-success/50 text-success',
                        c.status === 'ON_JOB' && 'border-warning/50 text-warning',
                        c.status === 'OFF_DUTY' && 'text-muted-foreground',
                      )}
                    >
                      {c.status.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <span className="font-medium">{dept?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead</span>
                    <span className="font-medium">{c.leadName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-medium">{c.memberCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open jobs</span>
                    <span className={cn('font-mono font-bold', jobs.length > 0 ? 'text-primary' : 'text-muted-foreground')}>
                      {jobs.length}
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden />
                    base {c.basePoint.lat.toFixed(4)}, {c.basePoint.lng.toFixed(4)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
