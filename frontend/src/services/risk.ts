/**
 * Predictive risk engine over a synthetic 12-month history (§17).
 *
 * Everything produced here is SIMULATED — no claims of accuracy. The
 * history is generated from a fixed seed so charts never jitter between
 * refreshes.
 */

import type { IssueCategory, RiskFactor, RiskPrediction } from '@/types/domain'
import { categoryConfig } from '@/services/engines'
import { ZONES } from '@/services/demo/seed'
import type { Zone } from '@/services/demo/seed'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HISTORY_MONTHS = 12

export const RISK_CATEGORIES: IssueCategory[] = [
  'POTHOLE',
  'WATER_LEAK',
  'GARBAGE',
  'STREETLIGHT',
  'DRAINAGE',
  'ROAD_DAMAGE',
]

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  POTHOLE: 'Potholes',
  WATER_LEAK: 'Water leaks',
  GARBAGE: 'Garbage',
  STREETLIGHT: 'Streetlights',
  DRAINAGE: 'Drainage',
  ROAD_DAMAGE: 'Road damage',
}

interface CategoryHistory {
  category: IssueCategory
  /** monthly incident counts, oldest → newest */
  monthly: number[]
}

let cachedHistory: CategoryHistory[] | null = null

export function cityHistory(): CategoryHistory[] {
  if (cachedHistory) return cachedHistory
  cachedHistory = RISK_CATEGORIES.map((category, ci) => {
    const rnd = mulberry32(7700 + ci * 97)
    const base = 14 + Math.floor(rnd() * 22)
    const seasonalPhase = ci * 0.9
    const monthly: number[] = []
    for (let m = 0; m < HISTORY_MONTHS; m++) {
      // monsoon-ish seasonal swell + slow upward drift + bounded noise
      const seasonal = Math.sin((m / 12) * Math.PI * 2 + seasonalPhase) * (base * 0.35)
      const drift = m * 0.55
      const noise = (rnd() - 0.5) * base * 0.3
      monthly.push(Math.max(2, Math.round(base + seasonal + drift + noise)))
    }
    return { category, monthly }
  })
  return cachedHistory
}

function lastMonths(h: CategoryHistory, n: number): number[] {
  return h.monthly.slice(-n)
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Least-squares slope per month — used for trend and projection. */
function slopeOf(xs: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = avg(xs)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * ((xs[i] as number) - meanY)
    den += (i - meanX) ** 2
  }
  return den === 0 ? 0 : num / den
}

function monthLabels(count: number): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(d.toLocaleDateString(undefined, { month: 'short' }))
  }
  return out
}

function riskLabel(v: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (v >= 66) return 'HIGH'
  if (v >= 38) return 'MEDIUM'
  return 'LOW'
}

/** Zone bias: certain zones are systematically hotter for certain categories. */
function zoneBias(zone: Zone, category: IssueCategory): number {
  const rnd = mulberry32(zone.id.charCodeAt(2) * 31 + category.charCodeAt(0) * 7)
  return 0.75 + rnd() * 0.6
}

const ACTIONS: Record<IssueCategory, string> = {
  POTHOLE: 'Pre-emptive patching on the highlighted corridor before peak traffic week; inspect resurfacing age.',
  WATER_LEAK: 'Acoustic leak survey along the corridor; prioritise joints near the highlighted zone.',
  GARBAGE: 'Increase collection frequency in this ward and audit bin placement for the next cycle.',
  STREETLIGHT: 'Schedule preventive lamp/driver replacement round in this zone before the dark season.',
  DRAINAGE: 'Pre-monsoon de-silting of the highlighted drains; clear outfalls now.',
  ROAD_DAMAGE: 'Surface condition survey on the corridor; plan patch repair while weather holds.',
}

export function buildRiskPredictions(horizon: 7 | 30 | 90): RiskPrediction[] {
  const history = cityHistory()
  const horizonFactor = horizon === 7 ? 1 : horizon === 30 ? 4 : 12
  const now = new Date()

  const preds: RiskPrediction[] = []
  let id = 1

  for (const cat of RISK_CATEGORIES) {
    const h = history.find((x) => x.category === cat) as CategoryHistory
    const recent = lastMonths(h, 3)
    const longer = lastMonths(h, 6)
    const sl = slopeOf(longer)
    const base = avg(recent)
    const cfg = categoryConfig(cat)

    // choose the two hottest zones for this category (deterministic)
    const zoneRanked = ZONES.map((z) => ({ z, bias: zoneBias(z, cat) })).sort(
      (a, b) => b.bias - a.bias,
    )

    for (const entry of zoneRanked.slice(0, 2)) {
      const biased = base * entry.bias
      const current = Math.min(100, Math.round((biased / 45) * 100))
      const projected = biased + sl * (horizonFactor / 2) * entry.bias
      const predicted = Math.max(0, Math.min(100, Math.round((projected / 45) * 100)))

      const labels = monthLabels(6)
      const trend = longer.map((v, i) => ({
        t: labels[i] ?? `M${i}`,
        value: Math.round(v * entry.bias),
      }))

      const factors: RiskFactor[] = [
        {
          label: 'Recent incident volume',
          detail: `${Math.round(biased)} reports/month in the last 3 months for ${CATEGORY_LABELS[cat].toLowerCase()}.`,
          contribution: Math.min(40, Math.round(current * 0.4)),
        },
        {
          label: 'Six-month trend',
          detail: `${sl >= 0 ? 'Rising' : 'Easing'} ${Math.abs(sl).toFixed(1)} incidents/month.`,
          contribution: Math.min(30, Math.round(Math.abs(sl) * 6) + 8),
        },
        {
          label: 'Corridor exposure',
          detail: `${entry.z.trafficClass.toLowerCase()} road in ${entry.z.name} raises impact if unfixed.`,
          contribution: entry.z.trafficClass === 'ARTERIAL' ? 20 : entry.z.trafficClass === 'COLLECTOR' ? 14 : 9,
        },
        {
          label: 'Category SLA pressure',
          detail: `Standard response window for ${cfg.label} is ${cfg.slaHours} h.`,
          contribution: cfg.slaHours <= 48 ? 10 : 6,
        },
      ]

      preds.push({
        id: `RSK-${String(id++).padStart(3, '0')}`,
        category: cat,
        zoneName: entry.z.name,
        point: entry.z.center,
        radiusMeters: cat === 'POTHOLE' || cat === 'ROAD_DAMAGE' ? 420 : 320,
        currentRisk: current,
        predictedRisk: predicted,
        horizonDays: horizon,
        trend,
        factors,
        recommendedAction: ACTIONS[cat],
        label: riskLabel(Math.max(current, predicted)),
        synthetic: true,
        // note: id/createdAt handled implicitly; synthetic must be literal true
      } as RiskPrediction)
    }
  }

  // stable presentation order: by predicted risk desc
  preds.sort((a, b) => b.predictedRisk - a.predictedRisk)
  void now
  return preds
}
