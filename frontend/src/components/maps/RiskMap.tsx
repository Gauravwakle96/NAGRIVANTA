/**
 * RiskMap — §16.
 * Leaflet with layer modes, marker grouping, legend, filters, popup detail
 * and a tile-failure fallback so a dead tile server never breaks the page.
 */

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Layers, LocateFixed } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CITY_CENTER, CITY_NAME, PRIORITY_META } from '@/config/app'
import { ZONES } from '@/services/demo/seed'
import { formatDistance, haversineMeters } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Crew, Issue, RiskPrediction, WorkOrder } from '@/types/domain'

/* Fix default marker icons under bundlers */
const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})
L.Marker.prototype.options.icon = iconDefault

function pin(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px">
      <span style="background:${color};color:#fff;font:700 9px ui-monospace,monospace;padding:2px 6px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</span>
      <span style="width:8px;height:8px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>
    </div>`,
    iconSize: [0, 0],
  })
}

export type MapMode = 'ISSUES' | 'RISK' | 'HEATMAP' | 'DEPARTMENTS' | 'CREWS' | 'PREDICTION'

export interface MapData {
  issues: Issue[]
  workOrders: WorkOrder[]
  crews: Crew[]
  risks: RiskPrediction[]
}

/** Simple grid-based "heat" — circle density, not a false precision surface. */
function HeatLayer({ issues }: { issues: Issue[] }) {
  const cells = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; n: number }>()
    for (const i of issues) {
      const key = `${i.point.lat.toFixed(2)}:${i.point.lng.toFixed(2)}`
      const c = map.get(key) ?? { lat: 0, lng: 0, n: 0 }
      c.lat += i.point.lat
      c.lng += i.point.lng
      c.n += 1
      map.set(key, c)
    }
    return [...map.entries()].map(([k, v]) => ({
      key: k,
      pos: [v.lat / v.n, v.lng / v.n] as [number, number],
      n: v.n,
    }))
  }, [issues])

  return (
    <>
      {cells.map((c) => (
        <Circle
          key={c.key}
          center={c.pos}
          radius={140 + c.n * 70}
          pathOptions={{
            color: c.n >= 4 ? 'var(--destructive)' : c.n >= 2 ? 'var(--warning)' : 'var(--chart-1)',
            weight: 1,
            fillOpacity: 0.28,
          }}
        />
      ))}
    </>
  )
}

function FlyTo({ target }: { target: LatLngExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 16, { duration: 0.6 })
  }, [target, map])
  return null
}

function TileLayerWithFallback() {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-muted">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(rgba(120,130,150,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(120,130,150,0.2) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />
        <div className="relative z-10 rounded-lg border border-border bg-background/90 px-4 py-2 text-center text-xs text-muted-foreground">
          Map tiles unavailable — markers and filters still work.
        </div>
      </div>
    )
  }
  return (
    <TileLayer
      attribution='&copy; OpenStreetMap contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      eventHandlers={{ tileerror: () => setFailed(true) }}
    />
  )
}

const MODES: { id: MapMode; label: string }[] = [
  { id: 'ISSUES', label: 'Issues' },
  { id: 'RISK', label: 'Risk' },
  { id: 'HEATMAP', label: 'Heatmap' },
  { id: 'DEPARTMENTS', label: 'Departments' },
  { id: 'CREWS', label: 'Crews' },
  { id: 'PREDICTION', label: 'Prediction' },
]

export function RiskMap({
  data,
  mode,
  onModeChange,
  focusIssueId,
  selectedId,
  onSelect,
  departmentFilter,
}: {
  data: MapData
  mode: MapMode
  onModeChange: (m: MapMode) => void
  focusIssueId?: string | null
  selectedId?: string | null
  onSelect?: (id: string) => void
  departmentFilter?: string | null
}) {
  const [geoAllowed, setGeoAllowed] = useState<'unknown' | 'yes' | 'no'>('unknown')

  const issues = useMemo(
    () => (departmentFilter ? data.issues.filter((i) => i.departmentId === departmentFilter) : data.issues),
    [data.issues, departmentFilter],
  )

  const focus = issues.find((i) => i.id === (focusIssueId ?? selectedId))
  const focusPos: LatLngExpression | null = focus ? [focus.point.lat, focus.point.lng] : null

  const requestGeo = () => {
    if (!('geolocation' in navigator)) {
      setGeoAllowed('no')
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => setGeoAllowed('yes'),
      () => setGeoAllowed('no'),
      { timeout: 6000 },
    )
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="size-4 text-muted-foreground" aria-hidden />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                mode === m.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50',
              )}
              aria-pressed={mode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={requestGeo}>
          <LocateFixed className="mr-2 size-4" aria-hidden />
          {geoAllowed === 'yes' ? 'Location on' : geoAllowed === 'no' ? 'Location denied' : 'Use my location'}
        </Button>
      </div>

      {/* Map */}
      <div className="relative h-[440px] overflow-hidden rounded-xl border border-border/70 sm:h-[520px]">
        <MapContainer
          center={[CITY_CENTER.lat, CITY_CENTER.lng]}
          zoom={14}
          className="size-full"
          scrollWheelZoom
        >
          <TileLayerWithFallback />
          <FlyTo target={focusPos} />

          {/* Issues mode */}
          {(mode === 'ISSUES' || mode === 'DEPARTMENTS' || mode === 'HEATMAP') && (
            <>
              {mode === 'HEATMAP' ? <HeatLayer issues={issues} /> : null}
              {issues.map((i) => (
                <Marker
                  key={i.id}
                  position={[i.point.lat, i.point.lng]}
                  icon={pin(
                    i.priority === 'CRITICAL' ? '#b91c1c' : i.priority === 'HIGH' ? '#ea580c' : i.priority === 'MEDIUM' ? '#d97706' : '#64748b',
                    i.id,
                  )}
                  eventHandlers={{ click: () => onSelect?.(i.id) }}
                >
                  <Popup>
                    <div style={{ minWidth: 190 }}>
                      <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{i.id}</strong>
                      <div style={{ fontSize: 12, margin: '2px 0 6px' }}>{i.title}</div>
                      <div style={{ fontSize: 11, color: '#555' }}>{i.address}</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>
                        {PRIORITY_META[i.priority].label} priority · {i.status.replaceAll('_', ' ')} ·{' '}
                        {i.reportIds.length} reports
                      </div>
                      <a href={`/issues/${i.id}`} style={{ fontSize: 11, color: '#2563eb' }}>
                        Open issue →
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </>
          )}

          {/* Work orders overlay */}
          {mode === 'ISSUES' &&
            data.workOrders
              .filter((w) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(w.status))
              .map((w) => (
                <Circle
                  key={`wo-${w.id}`}
                  center={[w.point.lat, w.point.lng]}
                  radius={90}
                  pathOptions={{ color: 'var(--primary)', weight: 1, dashArray: '4 4', fillOpacity: 0.08 }}
                />
              ))}

          {/* Risk zones */}
          {(mode === 'RISK' || mode === 'PREDICTION') &&
            data.risks.map((r) => (
              <Circle
                key={`risk-${r.id}`}
                center={[r.point.lat, r.point.lng]}
                radius={r.radiusMeters}
                pathOptions={{
                  color: r.label === 'HIGH' ? 'var(--destructive)' : r.label === 'MEDIUM' ? 'var(--warning)' : 'var(--success)',
                  weight: 2,
                  fillOpacity: mode === 'PREDICTION' ? 0.14 : 0.2,
                  dashArray: mode === 'PREDICTION' ? '6 4' : undefined,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <strong>{r.zoneName}</strong> · {r.category.replace('_', ' ')}
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      current {r.currentRisk} → predicted {r.predictedRisk} ({r.horizonDays}d)
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{r.recommendedAction}</div>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>SIMULATED PREDICTION</div>
                  </div>
                </Popup>
              </Circle>
            ))}

          {/* Crews */}
          {mode === 'CREWS' &&
            data.crews.map((c) => (
              <Marker
                key={`crew-${c.id}`}
                position={[c.basePoint.lat, c.basePoint.lng]}
                icon={pin('#0891b2', c.name)}
              >
                <Popup>
                  <strong>{c.name}</strong>
                  <div style={{ fontSize: 11 }}>{c.memberCount} members · {c.status.replaceAll('_', ' ')}</div>
                </Popup>
              </Marker>
            ))}

          {/* Zone labels */}
          {mode === 'DEPARTMENTS' &&
            ZONES.map((z) => (
              <Marker key={`zone-${z.id}`} position={[z.center.lat, z.center.lng]} icon={pin('#4338ca', z.name)} />
            ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] rounded-lg border border-border/70 bg-background/92 p-2.5 text-[10px] shadow-sm backdrop-blur">
          <p className="mb-1.5 font-bold uppercase tracking-wider text-muted-foreground">Legend</p>
          <ul className="space-y-1">
            {(mode === 'ISSUES' || mode === 'HEATMAP' || mode === 'DEPARTMENTS') && (
              <>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-700" /> Critical / High</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-600" /> Medium</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-500" /> Low</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-primary" /> open work order</li>
              </>
            )}
            {(mode === 'RISK' || mode === 'PREDICTION') && (
              <>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-destructive/70" /> High risk</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warning/70" /> Medium risk</li>
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success/70" /> Low risk</li>
                {mode === 'PREDICTION' ? <li className="text-muted-foreground">dashed = predicted zone</li> : null}
              </>
            )}
            {mode === 'CREWS' && <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-cyan-600" /> Crew base</li>}
          </ul>
          <p className="mt-1.5 border-t border-border/60 pt-1 font-mono text-[9px] text-muted-foreground">
            {mode === 'RISK' || mode === 'PREDICTION' ? 'SIMULATED ZONES' : 'DEMO DATA'} · {CITY_NAME}
          </p>
        </div>

        {mode === 'RISK' || mode === 'PREDICTION' ? (
          <div className="absolute right-3 top-3 z-[1000]">
            <Badge variant="outline" className="bg-background/90 text-[10px]">
              <AlertTriangle className="mr-1 size-3" aria-hidden /> simulated zones
            </Badge>
          </div>
        ) : null}
      </div>

      {/* Map ↔ list sync strip */}
      {focus ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
          <span>
            Selected <span className="font-mono font-bold">{focus.id}</span> — {focus.title} ·{' '}
            {formatDistance(haversineMeters(focus.point, CITY_CENTER))} from centre
          </span>
          <Button size="sm" variant="ghost" onClick={() => onSelect?.('')}>
            Clear selection
          </Button>
        </div>
      ) : null}
    </div>
  )
}
