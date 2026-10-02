/** Departments — ownership map of categories to teams. */

import { Building2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCrews, useIssues } from '@/hooks/useService'
import { LoadingState, ErrorState } from '@/components/states'
import { CATEGORIES, DEPARTMENTS } from '@/config/app'

export default function Departments() {
  const issuesQ = useIssues()
  const crewsQ = useCrews()

  if (issuesQ.isLoading) return <LoadingState label="Loading departments…" />
  if (issuesQ.isError) return <ErrorState onRetry={() => void issuesQ.refetch()} />

  const issues = issuesQ.data ?? []

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal · Structure</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Departments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Categories route to owning departments; crews execute their work orders.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENTS.map((d) => {
          const owned = issues.filter((i) => i.departmentId === d.id)
          const active = owned.filter((i) => !['CLOSED', 'REJECTED', 'RESOLVED'].includes(i.status))
          const crews = (crewsQ.data ?? []).filter((c) => c.departmentId === d.id)
          return (
            <Card key={d.id} className="border-border/70">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: 'color-mix(in oklab, var(--primary) 12%, transparent)' }}>
                    <Building2 className="size-4 text-primary" aria-hidden />
                  </span>
                  <CardTitle className="text-base">{d.name}</CardTitle>
                  <Badge variant="outline" className="ml-auto font-mono text-[10px]">{d.shortName}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{d.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.categories.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">
                      {CATEGORIES.find((x) => x.id === c)?.label ?? c}
                    </Badge>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                  <div>
                    <p className="font-mono text-lg font-bold">{owned.length}</p>
                    <p className="text-[10px] text-muted-foreground">total</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-primary">{active.length}</p>
                    <p className="text-[10px] text-muted-foreground">active</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold">{crews.length}</p>
                    <p className="text-[10px] text-muted-foreground">crews</p>
                  </div>
                </div>
                {crews.length > 0 ? (
                  <ul className="space-y-1">
                    {crews.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Users className="size-3.5" aria-hidden /> {c.name}
                        </span>
                        <Badge variant="outline" className="text-[9px]">{c.status.replaceAll('_', ' ')}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
