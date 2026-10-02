/**
 * Nagrivanta intelligence engines — pure functions.
 *
 * Every result carries its own reasoning so the UI can always answer
 * "why?". All heuristics are deterministic demo logic; nothing here claims
 * real-world model accuracy (§45).
 */

import {
  CATEGORIES,
  DEPARTMENTS,
  DUPLICATE_RULES,
  PRIORITY_RULES,
  TRUST_RULES,
} from '@/config/app'
import type { TrafficClass } from '@/config/app'
import { daysBetween, haversineMeters } from '@/lib/format'
import type {
  CategoryConfig,
  ClassificationResult,
  DuplicateAnalysis,
  DuplicateMatch,
  GeoPoint,
  Issue,
  IssueCategory,
  PriorityFactor,
  PriorityScore,
  Report,
  Severity,
  TrustFactor,
  TrustScore,
  TrustLabel,
  VerificationCheck,
  VerificationResult,
} from '@/types/domain'

const CATEGORY_BY_ID = new Map<IssueCategory, CategoryConfig>(
  CATEGORIES.map((c) => [c.id, c]),
)

export function categoryConfig(id: IssueCategory): CategoryConfig {
  const found = CATEGORY_BY_ID.get(id)
  if (!found) throw new Error(`Unknown category: ${id}`)
  return found
}

export function departmentOf(category: IssueCategory) {
  const cfg = categoryConfig(category)
  const dept = DEPARTMENTS.find((d) => d.id === cfg.departmentId)
  if (!dept) throw new Error(`No department for ${category}`)
  return dept
}

/** Word-overlap similarity in [0,1]; deterministic and dependency-free. */
export function textSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    )
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const w of ta) if (tb.has(w)) shared += 1
  return shared / Math.max(ta.size, tb.size)
}

/* ------------------------------------------------------------------ */
/* Classifier                                                          */
/* ------------------------------------------------------------------ */

export interface ClassificationInput {
  description: string
  /** Optional seed override so demo data stays deterministic. */
  seedCategory?: IssueCategory | null
}

export function classify(input: ClassificationInput): ClassificationResult {
  const desc = input.description.toLowerCase()

  if (input.seedCategory) {
    const cfg = categoryConfig(input.seedCategory)
    const dept = departmentOf(input.seedCategory)
    return {
      category: cfg.id,
      categoryLabel: cfg.label,
      departmentId: dept.id,
      departmentName: dept.name,
      severity: severityFor(cfg.id),
      confidence: 92,
      matchedKeywords: cfg.keywords.filter((k) => desc.includes(k)),
      summary: `Report text matches ${cfg.label} patterns${dept ? ` handled by ${dept.name}` : ''}.`,
      simulated: true,
    }
  }

  let best: { cfg: CategoryConfig; hits: string[] } | null = null
  for (const cfg of CATEGORIES) {
    const hits = cfg.keywords.filter((k) => desc.includes(k))
    if (hits.length > 0 && (!best || hits.length > best.hits.length)) {
      best = { cfg, hits }
    }
  }

  const chosen = best?.cfg ?? categoryConfig('POTHOLE')
  const dept = departmentOf(chosen.id)
  const hits = best?.hits ?? []
  const confidence = hits.length === 0 ? 38 : Math.min(95, 55 + hits.length * 14)

  return {
    category: chosen.id,
    categoryLabel: chosen.label,
    departmentId: dept.id,
    departmentName: dept.name,
    severity: severityFor(chosen.id),
    confidence,
    matchedKeywords: hits,
    summary:
      hits.length > 0
        ? `Matched ${hits.length} keyword${hits.length > 1 ? 's' : ''}: ${hits.join(', ')}.`
        : 'No strong keyword match — classified by default taxonomy entry for review.',
    simulated: true,
  }
}

/** Severity baseline per category (classifier default before report nuance). */
export function severityForCategory(category: IssueCategory): Severity {
  return severityFor(category)
}

function severityFor(category: IssueCategory): Severity {
  switch (category) {
    case 'WATER_LEAK':
    case 'DRAINAGE':
    case 'POTHOLE':
      return 'HIGH'
    case 'STREETLIGHT':
      return 'LOW'
    case 'GARBAGE':
    case 'ROAD_DAMAGE':
      return 'MEDIUM'
    default:
      return 'MEDIUM'
  }
}

/* ------------------------------------------------------------------ */
/* Trust engine                                                        */
/* ------------------------------------------------------------------ */

export interface TrustInput {
  report: Pick<Report, 'id' | 'description' | 'point' | 'createdAt' | 'evidenceId'>
  hasLocation: boolean
  knownReporter: boolean
  nearbyExistingCount: number
}

export function evaluateTrust(input: TrustInput): TrustScore {
  const factors: TrustFactor[] = []
  let score = 0

  if (input.report.evidenceId) {
    score += TRUST_RULES.hasImage
    factors.push({
      label: 'Photo evidence attached',
      detail: `Image present (+${TRUST_RULES.hasImage}).`,
      impact: 'POSITIVE',
    })
  } else {
    factors.push({
      label: 'No photo evidence',
      detail: `Missing image reduces confidence (${TRUST_RULES.descriptionTooShort}).`,
      impact: 'NEGATIVE',
    })
    score += TRUST_RULES.descriptionTooShort
  }

  if (input.hasLocation && input.report.point) {
    score += TRUST_RULES.hasLocation
    factors.push({
      label: 'Location provided',
      detail: `Pin present (+${TRUST_RULES.hasLocation}).`,
      impact: 'POSITIVE',
    })
  } else {
    factors.push({ label: 'No location', detail: 'Report has no coordinate pin.', impact: 'NEGATIVE' })
    score -= 15
  }

  const desc = input.report.description.trim()
  if (desc.length >= 40) {
    score += TRUST_RULES.descriptionLengthGood
    factors.push({
      label: 'Descriptive report',
      detail: `${desc.length} characters of detail (+${TRUST_RULES.descriptionLengthGood}).`,
      impact: 'POSITIVE',
    })
  } else if (desc.length < 15) {
    score += TRUST_RULES.descriptionTooShort
    factors.push({
      label: 'Very short description',
      detail: `Only ${desc.length} characters (${TRUST_RULES.descriptionTooShort}).`,
      impact: 'NEGATIVE',
    })
  } else {
    factors.push({ label: 'Brief description', detail: 'Adequate but not detailed.', impact: 'NEUTRAL' })
  }

  if (input.knownReporter) {
    score += TRUST_RULES.knownReporter
    factors.push({
      label: 'Known reporter',
      detail: `Reporter has prior accepted submissions (+${TRUST_RULES.knownReporter}).`,
      impact: 'POSITIVE',
    })
  }

  if (input.nearbyExistingCount > 0) {
    score += TRUST_RULES.nearExistingCluster
    factors.push({
      label: 'Corroborated by nearby reports',
      detail: `${input.nearbyExistingCount} independent report(s) within ${DUPLICATE_RULES.radiusMeters} m (+${TRUST_RULES.nearExistingCluster}).`,
      impact: 'POSITIVE',
    })
  } else {
    factors.push({
      label: 'No corroboration yet',
      detail: 'No other reports nearby — single source.',
      impact: 'NEUTRAL',
    })
  }

  score = Math.max(0, Math.min(TRUST_RULES.maxScore, score))

  let label: TrustLabel = 'NEEDS_REVIEW'
  if (score >= 78 && (input.report.evidenceId || input.nearbyExistingCount >= 2)) {
    label = 'LIKELY_GENUINE'
  } else if (input.nearbyExistingCount >= 2) {
    label = 'SIMILAR_REPORT'
  } else if (score >= 55) {
    label = 'LIKELY_GENUINE'
  }

  return {
    reportId: input.report.id,
    score,
    label,
    factors,
    engine: 'DemoTrustEngine v1',
    evaluatedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* Duplicate engine                                                    */
/* ------------------------------------------------------------------ */

export interface DuplicateInput {
  candidate: { id: string; point: GeoPoint; description: string; category: IssueCategory | null; createdAt: string }
  others: Array<{
    id: string
    issueId: string
    point: GeoPoint
    description: string
    category: IssueCategory | null
    createdAt: string
  }>
}

export function analyzeDuplicates(input: DuplicateInput): DuplicateAnalysis {
  const matches: DuplicateMatch[] = []
  const cutoff = Date.now() - DUPLICATE_RULES.windowDays * 86_400_000

  for (const other of input.others) {
    if (other.id === input.candidate.id) continue
    if (new Date(other.createdAt).getTime() < cutoff) continue

    const distance = haversineMeters(input.candidate.point, other.point)
    if (distance > DUPLICATE_RULES.radiusMeters) continue

    const similarity = textSimilarity(input.candidate.description, other.description)
    const categoryAgree =
      input.candidate.category !== null && other.category !== null
        ? input.candidate.category === other.category
        : false

    const near = distance <= DUPLICATE_RULES.radiusMeters
    const similarEnough = similarity >= DUPLICATE_RULES.minSimilarity || categoryAgree
    if (near && similarEnough) {
      matches.push({
        reportId: other.id,
        issueId: other.issueId,
        distanceMeters: Math.round(distance),
        categoryAgree,
        descriptionSimilarity: Number(similarity.toFixed(2)),
      })
    }
  }

  matches.sort((a, b) => a.distanceMeters - b.distanceMeters)

  const counts = new Map<string, number>()
  for (const m of matches) counts.set(m.issueId, (counts.get(m.issueId) ?? 0) + 1)
  let suggested: string | null = null
  let best = 0
  for (const [issueId, n] of counts) {
    if (n > best) {
      best = n
      suggested = issueId
    }
  }

  return {
    candidateReportId: input.candidate.id,
    matches,
    matchedCount: matches.length,
    nearestDistanceMeters: matches.length ? matches[0]!.distanceMeters : null,
    suggestedMasterIssueId: suggested,
    threshold: DUPLICATE_RULES.minSimilarity,
    simulated: true,
  }
}

/* ------------------------------------------------------------------ */
/* Priority engine                                                     */
/* ------------------------------------------------------------------ */

export interface PriorityInput {
  reportCount: number
  severity: Severity
  category: IssueCategory
  trafficClass: TrafficClass
  daysOpen: number
  priorWorkOrders: number
}

export function calculatePriority(input: PriorityInput): PriorityScore {
  const factors: PriorityFactor[] = []
  let score = 0

  const vol = Math.min(
    PRIORITY_RULES.reportVolume.max,
    input.reportCount * PRIORITY_RULES.reportVolume.perReport,
  )
  if (vol > 0) {
    factors.push({
      label: `${input.reportCount} report${input.reportCount > 1 ? 's' : ''} in cluster`,
      detail: `${PRIORITY_RULES.reportVolume.perReport} pts each, cap ${PRIORITY_RULES.reportVolume.max}.`,
      weight: PRIORITY_RULES.reportVolume.perReport,
      points: vol,
    })
    score += vol
  }

  const traffic = PRIORITY_RULES.trafficClassPoints[input.trafficClass]
  factors.push({
    label: `${input.trafficClass.toLowerCase()} road corridor`,
    detail: `Traffic exposure weighting.`,
    weight: traffic,
    points: traffic,
  })
  score += traffic

  const safety = PRIORITY_RULES.safetyImpactPoints[input.category]
  factors.push({
    label: 'Safety impact',
    detail: `Category safety weighting for ${categoryConfig(input.category).label}.`,
    weight: safety,
    points: safety,
  })
  score += safety

  const sev = PRIORITY_RULES.severityPoints[input.severity]
  factors.push({
    label: `${input.severity.toLowerCase()} severity`,
    detail: 'Classifier severity contribution.',
    weight: sev,
    points: sev,
  })
  score += sev

  if (input.priorWorkOrders > 0) {
    factors.push({
      label: 'Repeat location',
      detail: `${input.priorWorkOrders} previous work order(s) at this location.`,
      weight: PRIORITY_RULES.repeatLocationPoints,
      points: PRIORITY_RULES.repeatLocationPoints,
    })
    score += PRIORITY_RULES.repeatLocationPoints
  }

  const age = Math.min(
    PRIORITY_RULES.ageBonusMax,
    Math.floor(input.daysOpen) * PRIORITY_RULES.ageBonusPerDay,
  )
  if (age > 0) {
    factors.push({
      label: 'Ageing issue',
      detail: `${Math.floor(input.daysOpen)} day(s) open at +${PRIORITY_RULES.ageBonusPerDay}/day (cap ${PRIORITY_RULES.ageBonusMax}).`,
      weight: PRIORITY_RULES.ageBonusPerDay,
      points: age,
    })
    score += age
  }

  score = Math.max(0, Math.min(100, score))
  const level = levelFor(score)

  const top = [...factors].sort((a, b) => b.points - a.points).slice(0, 3)
  const explanation =
    score === 0
      ? 'No contributing factors recorded.'
      : `Scored ${score}/100 → ${level}. Driven by ${top
          .map((f) => `${f.label} (+${f.points})`)
          .join(', ')}.`

  return {
    score,
    level,
    factors,
    explanation,
    simulated: true,
    calculatedAt: new Date().toISOString(),
  }
}

function levelFor(score: number) {
  if (score >= PRIORITY_RULES.thresholds.CRITICAL) return 'CRITICAL' as const
  if (score >= PRIORITY_RULES.thresholds.HIGH) return 'HIGH' as const
  if (score >= PRIORITY_RULES.thresholds.MEDIUM) return 'MEDIUM' as const
  return 'LOW' as const
}

/* ------------------------------------------------------------------ */
/* Verification engine                                                 */
/* ------------------------------------------------------------------ */

export interface VerificationInput {
  hasBefore: boolean
  hasAfter: boolean
  beforePoint?: GeoPoint | null
  afterPoint?: GeoPoint | null
  maxDriftMeters?: number
  repairedFlag: boolean
  hoursSinceRepair: number
  citizenReopened: boolean
}

export function verifyRepair(input: VerificationInput): {
  result: VerificationResult
  checks: VerificationCheck[]
} {
  const maxDrift = input.maxDriftMeters ?? 150
  const checks: VerificationCheck[] = []

  const locPass =
    !!input.beforePoint &&
    !!input.afterPoint &&
    haversineMeters(input.beforePoint, input.afterPoint) <= maxDrift
  checks.push({
    key: 'location',
    label: 'Location match',
    pass: locPass,
    detail: locPass
      ? 'Before and after photos are at the same coordinate.'
      : 'Before/after coordinates missing or too far apart.',
  })

  checks.push({
    key: 'timestamp',
    label: 'Evidence timestamps',
    pass: input.hasBefore && input.hasAfter,
    detail:
      input.hasBefore && input.hasAfter
        ? 'Both evidence photos have upload timestamps.'
        : 'Missing before or after evidence upload.',
  })

  checks.push({
    key: 'evidence',
    label: 'Evidence completeness',
    pass: input.hasBefore && input.hasAfter,
    detail: `${[input.hasBefore && 'before', input.hasAfter && 'after'].filter(Boolean).join(' + ') || 'none'} uploaded.`,
  })

  const visual = input.repairedFlag && input.hasAfter
  checks.push({
    key: 'visual',
    label: 'Reported repair complete',
    pass: visual,
    detail: visual
      ? 'Crew marked the repair complete with after evidence.'
      : 'Crew has not confirmed repair completion.',
  })

  const fresh = input.hoursSinceRepair <= 72
  checks.push({
    key: 'persistence',
    label: 'Issue persistence check',
    pass: fresh && !input.citizenReopened,
    detail: input.citizenReopened
      ? 'Citizen reported the issue persisting after repair.'
      : fresh
        ? 'No reopen reported within the observation window.'
        : 'Observation window expired without citizen confirmation.',
  })

  const allPass = checks.every((c) => c.pass)
  return { result: allPass ? 'RESOLVED' : 'REINSPECTION_REQUIRED', checks }
}

/* ------------------------------------------------------------------ */
/* Priority helpers                                                    */
/* ------------------------------------------------------------------ */

export function daysOpenFor(issue: Pick<Issue, 'openedAt' | 'closedAt'>, now = new Date()): number {
  const end = issue.closedAt ? new Date(issue.closedAt) : now
  return Math.max(0, (end.getTime() - new Date(issue.openedAt).getTime()) / 86_400_000)
}

export function daysSince(iso: string, now = new Date()): number {
  return daysBetween(iso, now.toISOString())
}
