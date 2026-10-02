/**
 * LocationPicker — §11 Step 2.
 * Browser geolocation (denial handled gracefully), map pin, manual pin drop
 * and manual address entry with detected-location status.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Crosshair, Loader2, MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CITY_NAME } from '@/config/app'
import { ZONES } from '@/services/demo/seed'
import type { GeoPoint } from '@/types/domain'
import { cn } from '@/lib/utils'

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'manual'

export interface LocationValue {
  point: GeoPoint
  address: string
  status: LocationStatus
}

function nearestZoneName(point: GeoPoint): string {
  let best = ZONES[0]
  let bestD = Infinity
  for (const z of ZONES) {
    const d = Math.hypot(z.center.lat - point.lat, z.center.lng - point.lng)
    if (d < bestD) {
      bestD = d
      best = z
    }
  }
  return best ? best.name : 'City centre'
}

/**
 * Map fallback: if tiles fail, this canvas-style picker still works —
 * map failure never breaks reporting (§16, §37).
 */
function MiniMap({
  point,
  onPick,
}: {
  point: GeoPoint
  onPick: (p: GeoPoint) => void
}) {
  const [failed, setFailed] = useState(false)
  const [tileSrc, setTileSrc] = useState(
    `https://tile.openstreetmap.org/15/${Math.floor(((point.lng + 180) / 360) * 2 ** 15)}/${Math.floor(
      ((1 - Math.log(Math.tan((point.lat * Math.PI) / 180) + 1 / Math.cos((point.lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** 15,
    )}.png`,
  )

  // recompute the preview tile when the point moves
  useEffect(() => {
    const x = Math.floor(((point.lng + 180) / 360) * 2 ** 15)
    const latRad = (point.lat * Math.PI) / 180
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** 15)
    setTileSrc(`https://tile.openstreetmap.org/15/${x}/${y}.png`)
    setFailed(false)
  }, [point])

  const span = 0.012 // ~1.3 km window
  const rel = (p: GeoPoint) => ({
    left: `${((p.lng - (point.lng - span / 2)) / span) * 100}%`,
    top: `${1 - ((p.lat - (point.lat - span / 4)) / (span / 2)) * 100}%`,
  })

  return (
    <div className="relative h-56 overflow-hidden rounded-xl border border-border/70 bg-muted">
      {!failed ? (
        <img
          src={tileSrc}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-90"
          onError={() => setFailed(true)}
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(120,130,150,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(120,130,150,0.18) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-background/35" aria-hidden />
      {ZONES.map((z) => (
        <span
          key={z.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-medium text-foreground shadow-sm"
          style={rel(z.center)}
          aria-hidden
        >
          {z.name}
        </span>
      ))}
      <button
        type="button"
        className="absolute -translate-x-1/2 -translate-y-full text-destructive focus-visible:outline-2 focus-visible:outline-ring"
        style={rel(point)}
        aria-label={`Pin at ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}. Click map to move.`}
        onClick={(e) => e.stopPropagation()}
      >
        <MapPin className="size-7 drop-shadow" fill="currentColor" />
      </button>
      <button
        type="button"
        className="absolute inset-0 cursor-crosshair focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="Click to drop the location pin"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const fx = (e.clientX - rect.left) / rect.width
          const fy = (e.clientY - rect.top) / rect.height
          onPick({
            lng: point.lng - span / 2 + fx * span,
            lat: point.lat + span / 4 - fy * (span / 2),
          })
        }}
      />
      {failed ? (
        <span className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 font-mono text-[9px] text-muted-foreground">
          MAP TILES UNAVAILABLE — CLICK GRID TO PLACE PIN
        </span>
      ) : null}
    </div>
  )
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: LocationValue
  onChange: (v: LocationValue) => void
}) {
  const [manualOpen, setManualOpen] = useState(false)
  const [query, setQuery] = useState('')

  const detect = useCallback(() => {
    if (!('geolocation' in navigator)) {
      onChange({ ...value, status: 'denied' })
      return
    }
    onChange({ ...value, status: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        onChange({
          point,
          address: `${nearestZoneName(point)}, ${CITY_NAME}`,
          status: 'granted',
        })
      },
      () => {
        // denial is a first-class path, never a dead end (§11)
        onChange({ ...value, status: 'denied' })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  }, [onChange, value])

  const pickZone = (zoneName: string) => {
    const z = ZONES.find((x) => x.name === zoneName)
    if (!z) return
    onChange({ point: { ...z.center }, address: `${z.name}, Ward ${z.ward} · ${CITY_NAME}`, status: 'manual' })
  }

  const statusChip =
    value.status === 'granted' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success">
        <CheckCircle2 className="size-3.5" aria-hidden /> Location detected
      </span>
    ) : value.status === 'denied' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
        <AlertCircle className="size-3.5" aria-hidden /> Location access denied — drop a pin instead
      </span>
    ) : value.status === 'locating' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Detecting location…
      </span>
    ) : value.status === 'manual' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <MapPin className="size-3.5" aria-hidden /> Pin placed manually
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <MapPin className="size-3.5" aria-hidden /> No location yet
      </span>
    )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Where is the problem?
          <span className="ml-2 text-xs font-normal text-muted-foreground">required</span>
        </p>
        {statusChip}
      </div>

      <MiniMap
        point={value.point}
        onPick={(p) => onChange({ ...value, point: p, address: `${nearestZoneName(p)}, ${CITY_NAME}`, status: 'manual' })}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={detect} disabled={value.status === 'locating'}>
          {value.status === 'locating' ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="mr-2 size-4" aria-hidden />
          )}
          Use my location
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setManualOpen((o) => !o)}>
          <Search className="mr-2 size-4" aria-hidden /> Pick an area
        </Button>
      </div>

      {manualOpen ? (
        <div className="rounded-xl border border-border/70 bg-card p-3">
          <label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="zone-search">
            Search demo areas
          </label>
          <Input
            id="zone-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. MG Road"
            className="mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {ZONES.filter((z) => z.name.toLowerCase().includes(query.toLowerCase())).map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => pickZone(z.name)}
                className={cn(
                  'rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors',
                  'hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring',
                  value.address.startsWith(z.name) && 'border-primary bg-primary/10 text-primary',
                )}
              >
                {z.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="address-input">
          Address / landmark (editable)
        </label>
        <Input
          id="address-input"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value, status: value.status === 'idle' ? 'manual' : value.status })}
          placeholder="Street, ward, landmark"
        />
        <p className="font-mono text-[10px] text-muted-foreground">
          {value.point.lat.toFixed(5)}, {value.point.lng.toFixed(5)} · demo city {CITY_NAME}
        </p>
      </div>
    </div>
  )
}
