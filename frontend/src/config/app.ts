/**
 * Application configuration: departments, categories, priority rules, SLA
 * policies, map settings and demo-mode flags.
 *
 * Everything here is intended to move to a server-side config/admin screen in
 * Phase 2 — the UI never hard-codes domain facts.
 */

import type {
  CategoryConfig,
  Department,
  IssueCategory,
  Priority,
  Role,
  Severity,
} from '@/types/domain'

export const APP_NAME = 'NAGRIVANTA'
export const APP_TAGLINE = 'City Civic Intelligence Platform'

/** Demo city centroid — synthetic ward grid, not a real municipality. */
export const CITY_CENTER = { lat: 18.5204, lng: 73.8567 }
export const CITY_NAME = 'Nagari Demo City'

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false'

/**
 * FastAPI backend origin. Build-time baked from VITE_API_URL (set as a
 * GitHub repository variable in the Pages deploy workflow); the legacy
 * VITE_API_BASE_URL spelling still works. Unset → local backend, and
 * the service registry silently falls back to the demo provider when
 * the API is unreachable.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://localhost:8000'

/** Vite base path ('/NAGRIVANTA/' on Pages, '/' locally) without trailing slash. */
export const BASE_PATH: string = import.meta.env.BASE_URL.replace(/\/+$/, '')

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024
export const IMAGE_MAX_DIMENSION = 1600
export const IMAGE_COMPRESS_QUALITY = 0.82

export const DEPARTMENTS: Department[] = [
  {
    id: 'dept-road',
    name: 'Road Maintenance',
    shortName: 'ROADS',
    color: 'var(--chart-1)',
    categories: ['POTHOLE', 'ROAD_DAMAGE'],
    description: 'Carriageway, potholes, resurfacing and pavement defects.',
  },
  {
    id: 'dept-water',
    name: 'Water Supply',
    shortName: 'WATER',
    color: 'var(--chart-5)',
    categories: ['WATER_LEAK'],
    description: 'Potable water mains, leakage and standpipe repairs.',
  },
  {
    id: 'dept-sanitation',
    name: 'Sanitation',
    shortName: 'SANI',
    color: 'var(--chart-2)',
    categories: ['GARBAGE'],
    description: 'Waste collection, street cleaning and dumping removal.',
  },
  {
    id: 'dept-electrical',
    name: 'Electrical',
    shortName: 'ELEC',
    color: 'var(--chart-3)',
    categories: ['STREETLIGHT'],
    description: 'Street lighting, poles and public electrical fittings.',
  },
  {
    id: 'dept-drainage',
    name: 'Drainage',
    shortName: 'DRN',
    color: 'var(--chart-4)',
    categories: ['DRAINAGE'],
    description: 'Storm drains, culverts, de-silting and flood prevention.',
  },
]

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'POTHOLE',
    label: 'Pothole',
    departmentId: 'dept-road',
    keywords: ['pothole', 'hole', 'crater', 'road hole', 'sunken', 'dip'],
    slaHours: 72,
  },
  {
    id: 'ROAD_DAMAGE',
    label: 'Road Damage',
    departmentId: 'dept-road',
    keywords: ['cracked', 'crack', 'broken road', 'road edge', 'rutting', 'tar'],
    slaHours: 96,
  },
  {
    id: 'WATER_LEAK',
    label: 'Water Leak',
    departmentId: 'dept-water',
    keywords: ['leak', 'leaking', 'water', 'burst pipe', 'flooding', 'dripping'],
    slaHours: 24,
  },
  {
    id: 'GARBAGE',
    label: 'Garbage / Waste',
    departmentId: 'dept-sanitation',
    keywords: ['garbage', 'trash', 'waste', 'dump', 'bin', 'litter', 'stink'],
    slaHours: 48,
  },
  {
    id: 'STREETLIGHT',
    label: 'Streetlight',
    departmentId: 'dept-electrical',
    keywords: ['streetlight', 'street light', 'lamp', 'dark', 'flickering', 'pole'],
    slaHours: 120,
  },
  {
    id: 'DRAINAGE',
    label: 'Drainage',
    departmentId: 'dept-drainage',
    keywords: ['drain', 'sewage', 'clogged', 'manhole', 'overflow', 'gutter'],
    slaHours: 48,
  },
]

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

export const SEVERITY_POINTS: Record<Severity, number> = { LOW: 10, MEDIUM: 22, HIGH: 34 }

/** Weighted rule table behind the explainable priority engine. */
export const PRIORITY_RULES = {
  reportVolume: { perReport: 6, max: 30 },
  trafficClassPoints: { ARTERIAL: 16, COLLECTOR: 10, LOCAL: 4 },
  safetyImpactPoints: { WATER_LEAK: 14, DRAINAGE: 12, POTHOLE: 12, ROAD_DAMAGE: 8, STREETLIGHT: 6, GARBAGE: 4 },
  severityPoints: SEVERITY_POINTS,
  repeatLocationPoints: 10,
  ageBonusPerDay: 2,
  ageBonusMax: 12,
  thresholds: { MEDIUM: 30, HIGH: 55, CRITICAL: 78 },
} as const

export const TRUST_RULES = {
  hasImage: 34,
  hasLocation: 24,
  descriptionLengthGood: 18,
  descriptionTooShort: -12,
  knownReporter: 10,
  nearExistingCluster: 12,
  duplicateOfCluster: -8,
  maxScore: 100,
} as const

export const DUPLICATE_RULES = {
  radiusMeters: 350,
  minSimilarity: 0.42,
  windowDays: 14,
} as const

export const SLA_POLICY: Record<IssueCategory, number> = {
  POTHOLE: 72,
  ROAD_DAMAGE: 96,
  WATER_LEAK: 24,
  GARBAGE: 48,
  STREETLIGHT: 120,
  DRAINAGE: 48,
}

export const TRAFFIC_CLASSES = ['ARTERIAL', 'COLLECTOR', 'LOCAL'] as const
export type TrafficClass = (typeof TRAFFIC_CLASSES)[number]

export const ROLES: { id: Role; label: string; blurb: string }[] = [
  { id: 'CITIZEN', label: 'Citizen', blurb: 'Report problems and track repairs.' },
  { id: 'FIELD_CREW', label: 'Field Crew', blurb: 'Today’s jobs, evidence and repair submission.' },
  { id: 'INSPECTOR', label: 'Inspector', blurb: 'Verify before/after evidence and close jobs.' },
  { id: 'DEPARTMENT_OFFICER', label: 'Department Officer', blurb: 'Triage issues, assign crews, create work orders.' },
  { id: 'SUPERVISOR', label: 'Supervisor', blurb: 'Oversee departments, crews and SLA health.' },
  { id: 'CITY_ADMIN', label: 'City Admin', blurb: 'Full configuration and audit access.' },
  { id: 'CITY_LEADERSHIP', label: 'City Leadership', blurb: 'City health, trends and risk outlook.' },
]

export const RISK_HORIZONS = [7, 30, 90] as const

export const PRIORITY_META: Record<
  Priority,
  { label: string; className: string; dot: string }
> = {
  LOW: { label: 'Low', className: 'bg-muted text-muted-foreground', dot: 'bg-zinc-400' },
  MEDIUM: { label: 'Medium', className: 'bg-warning/15 text-warning', dot: 'bg-amber-500' },
  HIGH: { label: 'High', className: 'bg-destructive/12 text-destructive', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Critical', className: 'bg-destructive text-destructive-foreground', dot: 'bg-red-600' },
}
