/** Nearby issues — what is happening around the citizen (§23). */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useIssues } from '@/hooks/useService'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { CITY_CENTER } from '@/config/app'
import { formatDistance, haversineMeters } from '@/lib/format'
import { STATUS_META } from '@/components/issues/statusMeta'
import type { GeoPoint } from '@/types/domain'

const RADII = [1, 3, 5] // km

export default function NearbyIssues() {
  const q = useIssues()
  const [radiusKm, setRadiusKm] = useState(3)
  const [origin, setOrigin] = useState<GeoPoint>({ ...CITY_CENTER })
  const [locating, setLocating] = useState(false)

  const near = useMemo(() => {
    return (q.data ?? [])
      .map((i) => ({ issue: i, d: haversineMeters(i.point, origin) }))
      .filter((x) => x.d <= radiusKm * 1000)
      .sort((a, b) => a.d - b.d)
  }, [q.data, origin, radiusKm])

  const locate = () => {
    if (!('geolocation' in navigator)) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 },
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Citizen · Nearby</p>
        <h1 className="text-2xl font-bold">Nearby issues</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open issues around you or around the demo city centre.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border/70 p-1" role="group" aria-label="Radius">
          {RADII.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setRadiusKm(km)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                radiusKm === km ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
              aria-pressed={radiusKm === km}
            >
              {km} km
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={locate} disabled={locating}>
          <Navigation className="mr-2 size-4" aria-hidden />
          {locating ? 'Locating…' : 'Use my location'}
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground">
          {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
        </span>
      </div>

      {q.isLoading ? (
        <LoadingState label="Loading nearby issues…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : near.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-8" />}
          title={`Nothing within ${radiusKm} km`}
          description="Widen the radius, or report a new problem you spot."
          action={<Button asChild><Link to="/report">Report an issue</Link></Button>}
        />
      ) : (
        <ul className="space-y-3">
          {near.map(({ issue, d }) => (
            <li key={issue.id}>
              <Link
                to={`/issues/${issue.id}`}
                className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                  {formatDistance(d)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-sm font-bold">{issue.id}</span>
                  <span className="mt-0.5 block truncate text-sm font-medium">{issue.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{issue.address}</span>
                </span>
                <Badge className={STATUS_META[issue.status].className}>{STATUS_META[issue.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
