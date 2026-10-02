/**
 * City Risk Intelligence (§17).
 * Current / historical / predicted risk per category, all labeled simulated.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, Info, MapPin, Radar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRiskPredictions } from '@/hooks/useService'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { CATEGORY_LABELS, RISK_CATEGORIES } from '@/services/risk'
import { cn } from '@/lib/utils'
import type { IssueCategory, RiskPrediction } from '@/types/domain'

const HORIZONS = [7, 30, 90] as const

function toneClass(v: number) {
  if (v >= 66) return 'text-destructive'
  if (v >= 38) return 'text-warning'
  return 'text-success'
}
function toneBg(v: number) {
  if (v >= 66) return 'bg-destructive'
  if (v >= 38) return 'bg-warning'
  return 'bg-success'
}

function RiskCard({ pred }: { pred: RiskPrediction }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm">{CATEGORY_LABELS[pred.category]}</CardTitle>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden /> {pred.zoneName}
            </p>
          </div>
          <Badge className={cn('text-[10px]', pred.label === 'HIGH' ? 'bg-destructive text-white' : pred.label === 'MEDIUM' ? 'bg-warning/20 text-warning' : 'bg-success/15 text-success')}>
            {pred.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border border-border/70 p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current risk</p>
            <p className={cn('font-mono text-xl font-black', toneClass(pred.currentRisk))}>{pred.currentRisk}</p>
          </div>
          <div className="rounded-lg border border-border/70 p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Predicted · {pred.horizonDays}d</p>
            <p className={cn('font-mono text-xl font-black', toneClass(pred.predictedRisk))}>{pred.predictedRisk}</p>
          </div>
        </div>

        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pred.trend} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id={`g-${pred.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" width={40} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
              />
              <Area type="monotone" dataKey="value" stroke="var(--color-chart-1)" fill={`url(#g-${pred.id})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">Historical trend (synthetic, 6 months)</p>

        <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide factors' : 'Show contributing factors'}
        </Button>

        {open ? (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contributing factors</p>
            <ul className="space-y-1.5">
              {pred.factors.map((f) => (
                <li key={f.label} className="text-xs">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{f.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">+{f.contribution}</span>
                  </span>
                  <span className="block text-muted-foreground">{f.detail}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-md bg-primary/5 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Recommended action</p>
              <p className="mt-0.5 text-xs">{pred.recommendedAction}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function RiskIntelligence() {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(30)
  const q = useRiskPredictions(horizon)

  const byCategory = useMemo(() => {
    const map = new Map<IssueCategory, RiskPrediction[]>()
    for (const p of q.data ?? []) {
      const list = map.get(p.category) ?? []
      list.push(p)
      map.set(p.category, list)
    }
    return map
  }, [q.data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Municipal · Prediction</p>
          <h1 className="text-2xl font-bold sm:text-3xl">City Risk Intelligence</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Where will the next problem appear? Built on a synthetic 12-month history — every number
            here is <span className="font-semibold text-foreground">simulated</span>, not measured.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border/70 p-1" role="group" aria-label="Prediction horizon">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  horizon === h ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
                aria-pressed={horizon === h}
              >
                {h} Days
              </button>
            ))}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/city-map"><MapPin className="mr-2 size-4" /> Risk map</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/8 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <p>
          <span className="font-semibold text-foreground">Simulated prediction.</span> Generated from
          deterministic synthetic history for demonstration. No accuracy claim is made or implied —
          real deployment requires evaluated models on municipal data.
        </p>
      </div>

      {/* Category summary strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {RISK_CATEGORIES.map((cat) => {
          const preds = byCategory.get(cat) ?? []
          const maxRisk = preds.length ? Math.max(...preds.map((p) => Math.max(p.currentRisk, p.predictedRisk))) : 0
          return (
            <div key={cat} className="rounded-lg border border-border/70 bg-card p-3 text-center">
              <p className="text-[11px] font-medium">{CATEGORY_LABELS[cat]}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', toneBg(maxRisk))} style={{ width: `${maxRisk}%` }} />
              </div>
              <p className={cn('mt-1 font-mono text-xs font-bold', toneClass(maxRisk))}>{maxRisk}</p>
            </div>
          )
        })}
      </div>

      {q.isLoading ? (
        <LoadingState label="Computing predictions…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Radar className="size-8" />}
          title="No predictions for this horizon"
          description="Choose a different time horizon."
        />
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="size-4 text-primary" aria-hidden />
            {(q.data ?? []).length} zone/category predictions for the next {horizon} days, sorted by risk.
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(q.data ?? []).map((p) => (
              <RiskCard key={p.id} pred={p} />
            ))}
          </div>
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Recommended cadence: review HIGH zones weekly and schedule preventive work orders from this list.
      </p>
    </div>
  )
}
