/**
 * Deterministic demo dataset (§24).
 *
 * Everything is generated from a fixed PRNG seed — the structure is identical
 * on every load. Timestamps are anchored to load time so relative ages stay
 * sensible. Labeled synthetic throughout; no random unseeded values.
 */

import { CATEGORIES, CITY_CENTER, SLA_POLICY, TRAFFIC_CLASSES } from '@/config/app'
import type { TrafficClass } from '@/config/app'
import {
  calculatePriority,
  evaluateTrust,
  severityForCategory,
  textSimilarity,
} from '@/services/engines'
import { haversineMeters } from '@/lib/format'
import type {
  AppNotification,
  AuditEvent,
  CategoryConfig,
  Crew,
  Evidence,
  GeoPoint,
  Issue,
  IssueCategory,
  IssueStatus,
  Report,
  User,
  Verification,
  VerificationResult,
  WorkOrder,
  WorkOrderStatus,
} from '@/types/domain'

/* ---------------- PRNG ---------------- */

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

const SEED = 20261002

/* ---------------- City geography ---------------- */

export interface Zone {
  id: string
  name: string
  center: GeoPoint
  trafficClass: TrafficClass
  ward: number
}

/** ~1 km apart so duplicate radius (350 m) never crosses zones accidentally. */
export const ZONES: Zone[] = [
  { id: 'z-mg', name: 'MG Road', center: { lat: 18.5204, lng: 73.8567 }, trafficClass: 'ARTERIAL', ward: 4 },
  { id: 'z-stn', name: 'Station Road', center: { lat: 18.5294, lng: 73.8567 }, trafficClass: 'ARTERIAL', ward: 3 },
  { id: 'z-civ', name: 'Civil Lines', center: { lat: 18.5294, lng: 73.8657 }, trafficClass: 'COLLECTOR', ward: 6 },
  { id: 'z-mkt', name: 'Market Quarter', center: { lat: 18.5204, lng: 73.8677 }, trafficClass: 'COLLECTOR', ward: 7 },
  { id: 'z-riv', name: 'Riverside Colony', center: { lat: 18.5114, lng: 73.8647 }, trafficClass: 'LOCAL', ward: 9 },
  { id: 'z-old', name: 'Old Town', center: { lat: 18.5114, lng: 73.8487 }, trafficClass: 'COLLECTOR', ward: 2 },
  { id: 'z-air', name: 'Airport Road', center: { lat: 18.5364, lng: 73.8467 }, trafficClass: 'ARTERIAL', ward: 11 },
  { id: 'z-ind', name: 'Industrial Estate', center: { lat: 18.5024, lng: 73.8557 }, trafficClass: 'LOCAL', ward: 12 },
  { id: 'z-lak', name: 'Lake View', center: { lat: 18.5024, lng: 73.8717 }, trafficClass: 'LOCAL', ward: 8 },
  { id: 'z-grn', name: 'Green Park', center: { lat: 18.5364, lng: 73.8717 }, trafficClass: 'COLLECTOR', ward: 5 },
]

const LANDMARKS = [
  'bus stop',
  'school gate',
  'market entrance',
  'hospital corner',
  'bridge approach',
  'metro pillar',
  'signal junction',
  'community hall',
  'post office',
  'park gate',
]

const STREETS = [
  'MG Road',
  'Station Road',
  'Ring Road',
  'Market Street',
  'Temple Lane',
  'Canal Bank Road',
  'Old Customs Road',
  'Mill Lines',
  'Lake Road',
  'Orchard Avenue',
]

/* ---------------- Description templates ---------------- */

const DESCRIPTION_TEMPLATES: Record<IssueCategory, string[]> = {
  POTHOLE: [
    'Deep pothole on {street} near the {landmark}, cars swerving to avoid it.',
    'Large pothole by the {landmark} on {street}, bikes losing balance.',
    'Road surface has caved in near the {landmark} on {street}.',
  ],
  ROAD_DAMAGE: [
    'Cracked and rutted road surface near the {landmark} on {street}.',
    'Road edge has broken away near the {landmark} on {street}.',
    'Loose gravel and tar failure near the {landmark} on {street}.',
  ],
  WATER_LEAK: [
    'Water main leaking continuously near the {landmark} on {street}.',
    'Standpipe gushing water by the {landmark} on {street}, wastage all day.',
    'Underground pipe seepage pooling near the {landmark} on {street}.',
  ],
  GARBAGE: [
    'Garbage dumped and overflowing near the {landmark} on {street}.',
    'Trash pile uncollected for days near the {landmark} on {street}.',
    'Waste bins overflowing by the {landmark} on {street}, bad smell.',
  ],
  STREETLIGHT: [
    'Streetlight out near the {landmark} on {street}, very dark at night.',
    'Two lamps dead near the {landmark} on {street}, unsafe stretch.',
    'Flickering streetlight near the {landmark} on {street}.',
  ],
  DRAINAGE: [
    'Drain clogged and overflowing near the {landmark} on {street}.',
    'Sewage blockage near the {landmark} on {street}, water stagnating.',
    'Storm drain choked with debris near the {landmark} on {street}.',
  ],
}

/* ---------------- Evidence images ---------------- */

const CATEGORY_TINT: Record<IssueCategory, [string, string]> = {
  POTHOLE: ['#475569', '#1e293b'],
  ROAD_DAMAGE: ['#57534e', '#292524'],
  WATER_LEAK: ['#0369a1', '#0c4a6e'],
  GARBAGE: ['#4d7c0f', '#1a2e05'],
  STREETLIGHT: ['#a16207', '#422006'],
  DRAINAGE: ['#6d28d9', '#2e1065'],
}

/**
 * Deterministic inline SVG standing in for an evidence photo — clearly
 * labeled synthetic so nobody mistakes it for a real photograph (§45).
 */
export function demoEvidenceImage(
  category: IssueCategory,
  kind: string,
  label: string,
): string {
  const [c1, c2] = CATEGORY_TINT[category]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <rect width="28" height="28" fill="none"/>
      <rect width="10" height="28" fill="rgba(255,255,255,0.05)"/>
    </pattern>
  </defs>
  <rect width="640" height="420" fill="url(#g)"/>
  <rect width="640" height="420" fill="url(#p)"/>
  <rect x="0" y="300" width="640" height="120" fill="rgba(0,0,0,0.25)"/>
  <path d="M0 320 Q160 300 320 318 T640 316 L640 420 L0 420 Z" fill="rgba(0,0,0,0.35)"/>
  <ellipse cx="300" cy="330" rx="92" ry="26" fill="rgba(0,0,0,0.55)"/>
  <text x="32" y="70" font-family="ui-monospace, monospace" font-size="30" fill="rgba(255,255,255,0.95)" font-weight="700">${label}</text>
  <text x="32" y="108" font-family="ui-monospace, monospace" font-size="19" fill="rgba(255,255,255,0.75)">${category.replace('_', ' ')} · ${kind}</text>
  <rect x="32" y="130" width="176" height="34" rx="17" fill="rgba(255,255,255,0.16)"/>
  <text x="48" y="153" font-family="ui-monospace, monospace" font-size="16" fill="#fff">SYNTHETIC</text>
  <text x="32" y="396" font-family="ui-monospace, monospace" font-size="15" fill="rgba(255,255,255,0.6)">DEMO EVIDENCE · GENERATED PLACEHOLDER</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ---------------- Seed state ---------------- */

export interface DemoSeed {
  users: User[]
  crews: Crew[]
  issues: Issue[]
  reports: Report[]
  evidence: Evidence[]
  workOrders: WorkOrder[]
  verifications: Verification[]
  audit: AuditEvent[]
  notifications: AppNotification[]
  seq: {
    issue: number
    report: number
    workOrder: number
    evidence: number
    audit: number
    notification: number
    verification: number
  }
}

export const SEED_USERS: User[] = [
  { id: 'u-citizen-1', name: 'Aarav Mehta', role: 'CITIZEN', avatarLabel: 'AM' },
  { id: 'u-citizen-2', name: 'Priya Nair', role: 'CITIZEN', avatarLabel: 'PN' },
  { id: 'u-citizen-3', name: 'Imran Shaikh', role: 'CITIZEN', avatarLabel: 'IS' },
  { id: 'u-crew-road-a', name: 'Sanjay Pawar', role: 'FIELD_CREW', crewId: 'crew-road-a', avatarLabel: 'SP' },
  { id: 'u-crew-road-b', name: 'Vikram Rao', role: 'FIELD_CREW', crewId: 'crew-road-b', avatarLabel: 'VR' },
  { id: 'u-crew-water', name: 'Dev Patil', role: 'FIELD_CREW', crewId: 'crew-water-1', avatarLabel: 'DP' },
  { id: 'u-crew-sani', name: 'Kiran Yadav', role: 'FIELD_CREW', crewId: 'crew-sani-1', avatarLabel: 'KY' },
  { id: 'u-crew-elec', name: 'Anil Verma', role: 'FIELD_CREW', crewId: 'crew-elec-1', avatarLabel: 'AV' },
  { id: 'u-crew-drain', name: 'Faisal Khan', role: 'FIELD_CREW', crewId: 'crew-drain-1', avatarLabel: 'FK' },
  { id: 'u-inspector-1', name: 'Rohan Deshpande', role: 'INSPECTOR', avatarLabel: 'RD' },
  { id: 'u-officer-road', name: 'Meera Kulkarni', role: 'DEPARTMENT_OFFICER', departmentId: 'dept-road', avatarLabel: 'MK' },
  { id: 'u-officer-water', name: 'Joseph Thomas', role: 'DEPARTMENT_OFFICER', departmentId: 'dept-water', avatarLabel: 'JT' },
  { id: 'u-supervisor-1', name: 'Nandini Iyer', role: 'SUPERVISOR', avatarLabel: 'NI' },
  { id: 'u-admin-1', name: 'Rahul Bhatt', role: 'CITY_ADMIN', avatarLabel: 'RB' },
  { id: 'u-leadership-1', name: 'Dr. Ananya Sen', role: 'CITY_LEADERSHIP', avatarLabel: 'AS' },
]

const SEED_CREWS: Crew[] = [
  { id: 'crew-road-a', name: 'Road Team A', departmentId: 'dept-road', memberCount: 4, leadName: 'Sanjay Pawar', status: 'AVAILABLE', basePoint: { lat: 18.5196, lng: 73.8549 } },
  { id: 'crew-road-b', name: 'Road Team B', departmentId: 'dept-road', memberCount: 3, leadName: 'Vikram Rao', status: 'AVAILABLE', basePoint: { lat: 18.5334, lng: 73.8493 } },
  { id: 'crew-water-1', name: 'Water Crew 1', departmentId: 'dept-water', memberCount: 3, leadName: 'Dev Patil', status: 'AVAILABLE', basePoint: { lat: 18.5272, lng: 73.8623 } },
  { id: 'crew-sani-1', name: 'Sanitation Crew 1', departmentId: 'dept-sanitation', memberCount: 5, leadName: 'Kiran Yadav', status: 'AVAILABLE', basePoint: { lat: 18.5152, lng: 73.8601 } },
  { id: 'crew-elec-1', name: 'Electrical Crew 1', departmentId: 'dept-electrical', memberCount: 2, leadName: 'Anil Verma', status: 'AVAILABLE', basePoint: { lat: 18.5338, lng: 73.8669 } },
  { id: 'crew-drain-1', name: 'Drainage Crew 1', departmentId: 'dept-drainage', memberCount: 4, leadName: 'Faisal Khan', status: 'AVAILABLE', basePoint: { lat: 18.5068, lng: 73.8527 } },
]

/** Covering every lifecycle status for realistic filters/dashboards. */
const STATUS_PATTERN: IssueStatus[] = [
  'CLOSED', 'RESOLVED', 'RESOLVED', 'IN_PROGRESS', 'ASSIGNED',
  'TRIAGED', 'REPORTED', 'UNDER_REVIEW', 'AWAITING_VERIFICATION', 'REINSPECTION_REQUIRED',
  'CLOSED', 'IN_PROGRESS', 'RESOLVED', 'ASSIGNED', 'REPORTED',
  'UNDER_REVIEW', 'CLOSED', 'AWAITING_VERIFICATION', 'IN_PROGRESS', 'RESOLVED',
  'REJECTED', 'ASSIGNED', 'CLOSED', 'TRIAGED', 'IN_PROGRESS',
  'RESOLVED', 'REPORTED', 'AWAITING_VERIFICATION', 'UNDER_REVIEW', 'CLOSED',
  'IN_PROGRESS', 'ASSIGNED', 'RESOLVED', 'REINSPECTION_REQUIRED', 'TRIAGED',
  'CLOSED', 'REPORTED', 'RESOLVED', 'UNDER_REVIEW', 'IN_PROGRESS',
  'CLOSED',
]

const CATEGORY_CYCLE: IssueCategory[] = [
  'POTHOLE', 'GARBAGE', 'WATER_LEAK', 'STREETLIGHT', 'DRAINAGE', 'ROAD_DAMAGE',
  'POTHOLE', 'STREETLIGHT', 'GARBAGE', 'WATER_LEAK', 'ROAD_DAMAGE', 'DRAINAGE',
]

const WO_STATUS_FOR_ISSUE: Partial<Record<IssueStatus, WorkOrderStatus>> = {
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  AWAITING_VERIFICATION: 'VERIFICATION',
  RESOLVED: 'RESOLVED',
  REINSPECTION_REQUIRED: 'REINSPECTION_REQUIRED',
  CLOSED: 'CLOSED',
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)] as T
}

export function zoneAt(point: GeoPoint): Zone {
  let best = ZONES[0] as Zone
  let bestD = Infinity
  for (const z of ZONES) {
    const d = haversineMeters(point, z.center)
    if (d < bestD) {
      bestD = d
      best = z
    }
  }
  return best
}

function ringJitter(rnd: () => number, min: number, max: number): { dLat: number; dLng: number } {
  // ring-shaped offset: guarantees a minimum distance from the zone center
  const angle = rnd() * Math.PI * 2
  const mag = min + rnd() * (max - min)
  return { dLat: Math.sin(angle) * mag, dLng: Math.cos(angle) * mag }
}

function pointInZone(zone: Zone, rnd: () => number): GeoPoint {
  const { dLat, dLng } = ringJitter(rnd, 0.004, 0.007)
  return { lat: zone.center.lat + dLat, lng: zone.center.lng + dLng }
}

/* Deterministic description builder — always driven by the seeded PRNG. */
function seededDescription(category: IssueCategory, street: string, landmark: string, rnd: () => number): string {
  const list = DESCRIPTION_TEMPLATES[category]
  const tpl = list[Math.floor(rnd() * list.length)] as string
  return tpl.replace('{street}', street).replace('{landmark}', landmark)
}

export function createSeed(now = Date.now()): DemoSeed {
  const rnd = mulberry32(SEED)

  const issues: Issue[] = []
  const reports: Report[] = []
  const evidence: Evidence[] = []
  const workOrders: WorkOrder[] = []
  const verifications: Verification[] = []
  const audit: AuditEvent[] = []
  const notifications: AppNotification[] = []

  let auditSeq = 1
  let evidenceSeq = 1
  let notifSeq = 1
  let verifSeq = 1

  const pushAudit = (
    entityType: AuditEvent['entityType'],
    entityId: string,
    action: string,
    detail: string,
    actorId: string,
    actorRole: AuditEvent['actorRole'],
    at: number,
  ) => {
    audit.push({
      id: `AUD-${String(auditSeq++).padStart(5, '0')}`,
      entityType,
      entityId,
      action,
      detail,
      actorId,
      actorRole,
      createdAt: new Date(at).toISOString(),
    })
  }

  const pushNotif = (
    userId: string,
    role: AppNotification['role'],
    title: string,
    body: string,
    issueId: string | null,
    at: number,
  ) => {
    notifications.push({
      id: `NTF-${String(notifSeq++).padStart(5, '0')}`,
      userId,
      role,
      title,
      body,
      issueId,
      read: false,
      createdAt: new Date(at).toISOString(),
    })
  }

  const seedEvidence = (
    category: IssueCategory,
    kind: Evidence['kind'],
    label: string,
    uploader: string,
    at: number,
    point?: GeoPoint,
  ): Evidence => {
    const ev: Evidence = {
      id: `EV-${String(evidenceSeq++).padStart(5, '0')}`,
      kind,
      url: demoEvidenceImage(category, kind, label),
      caption: `${kind.toLowerCase()} evidence — synthetic placeholder`,
      uploadedAt: new Date(at).toISOString(),
      uploadedBy: uploader,
      point,
    }
    evidence.push(ev)
    return ev
  }

  /* ---------------- Seeded issues ---------------- */

  const catCfg = new Map<IssueCategory, CategoryConfig>(CATEGORIES.map((c) => [c.id, c]))

  for (let i = 0; i < STATUS_PATTERN.length; i++) {
    const status = STATUS_PATTERN[i] as IssueStatus
    const category = CATEGORY_CYCLE[i % CATEGORY_CYCLE.length] as IssueCategory
    const zone = ZONES[i % ZONES.length] as Zone
    const point = pointInZone(zone, rnd)
    const cfg = catCfg.get(category) as CategoryConfig
    const street = STREETS[i % STREETS.length] as string
    const landmark = LANDMARKS[i % LANDMARKS.length] as string
    const daysOld = 2 + Math.floor(rnd() * 46)
    const openedAt = now - daysOld * DAY - Math.floor(rnd() * 12) * HOUR
    const closedStatus = status === 'CLOSED' || status === 'RESOLVED'
    const closedAt = closedStatus ? openedAt + Math.floor(rnd() * daysOld * 0.8 + 0.5) * DAY : null

    const issueId = `NGV-${1001 + i}`
    const description = seededDescription(category, street, landmark, rnd)
    const reportCount = 1 + Math.floor(rnd() * 4) // 1..4
    const reportIds: string[] = []
    let photos = 0
    let firstReportAt = openedAt

    for (let r = 0; r < reportCount; r++) {
      const repSeq = reports.length + 1
      const at = openedAt + r * Math.floor((daysOld * DAY) / (reportCount + 1))
      const j = ringJitter(rnd, 0.0001, 0.0012)
      const repPoint = { lat: point.lat + j.dLat, lng: point.lng + j.dLng }
      const hasPhoto = rnd() > 0.35
      let evId: string | null = null
      if (hasPhoto) {
        const ev = seedEvidence(category, 'REPORT', 'REPORT', pick(SEED_USERS, rnd).id, at, repPoint)
        evId = ev.id
        photos += 1
      }
      const reporter = pick(SEED_USERS.slice(0, 3), rnd)
      const rep: Report = {
        id: `RPT-${String(repSeq).padStart(4, '0')}`,
        issueId,
        category,
        description: r === 0 ? description : seededDescription(category, street, landmark, rnd),
        point: repPoint,
        address: `${street}, Ward ${zone.ward} · ${zone.name}`,
        evidenceId: evId,
        submittedBy: reporter.id,
        createdAt: new Date(at).toISOString(),
        synthetic: true,
      }
      reports.push(rep)
      reportIds.push(rep.id)
      if (at < firstReportAt) firstReportAt = at
    }

    const severity = severityForCategory(category)
    const trafficClass = zone.trafficClass
    const priorityScore = calculatePriority({
      reportCount,
      severity,
      category,
      trafficClass,
      daysOpen: closedAt ? (closedAt - openedAt) / DAY : (now - openedAt) / DAY,
      priorWorkOrders: rnd() > 0.85 ? 1 : 0,
    })

    const firstReport = reports.find((r) => r.id === reportIds[0]) as Report
    const trust = evaluateTrust({
      report: firstReport,
      hasLocation: true,
      knownReporter: rnd() > 0.4,
      nearbyExistingCount: Math.max(0, reportCount - 1),
    })

    const deptFromCat = cfg.departmentId
    const hasDepartment = !['REPORTED', 'UNDER_REVIEW'].includes(status)
    const hasCrew = ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'RESOLVED', 'REINSPECTION_REQUIRED', 'CLOSED'].includes(status)

    const issue: Issue = {
      id: issueId,
      title: `${cfg.label} — ${zone.name}`,
      category,
      departmentId: hasDepartment ? deptFromCat : null,
      crewId: hasCrew ? crewFor(deptFromCat, i) : null,
      priority: priorityScore.level,
      priorityScore,
      trust,
      status,
      point,
      address: `${street}, Ward ${zone.ward} · ${zone.name}`,
      reportIds,
      uniquePhotoCount: photos,
      workOrderId: null,
      openedAt: new Date(firstReportAt).toISOString(),
      updatedAt: new Date(closedAt ?? now - Math.floor(rnd() * 3) * DAY).toISOString(),
      closedAt: closedAt ? new Date(closedAt).toISOString() : null,
      synthetic: true,
    }

    /* Work order for triaged-and-beyond issues */
    const woStatus = WO_STATUS_FOR_ISSUE[status]
    if (woStatus) {
      const woSeq = workOrders.length + 1
      const createdAt = openedAt + DAY * 0.5
      const slaDueAt = openedAt + cfg.slaHours * HOUR
      const crewId = issue.crewId as string
      const beforeEv = seedEvidence(category, 'BEFORE', 'BEFORE', crewId, createdAt + DAY * 0.6, point)
      const hasAfter = ['VERIFICATION', 'RESOLVED', 'CLOSED', 'REINSPECTION_REQUIRED'].includes(woStatus)
      const afterEv = hasAfter
        ? seedEvidence(category, 'AFTER', 'AFTER', crewId, createdAt + DAY * 1.4, point)
        : null

      const wo: WorkOrder = {
        id: `WO-${String(woSeq).padStart(4, '0')}`,
        issueId,
        category,
        priority: priorityScore.level,
        departmentId: deptFromCat,
        crewId,
        point,
        address: issue.address,
        description,
        instructions: instructionsFor(category),
        status: woStatus,
        slaDueAt: new Date(slaDueAt).toISOString(),
        createdAt: new Date(createdAt).toISOString(),
        updatedAt: new Date(hasAfter ? createdAt + DAY * 1.4 : now - DAY).toISOString(),
        beforeEvidenceId: beforeEv.id,
        afterEvidenceId: afterEv ? afterEv.id : null,
      }
      workOrders.push(wo)
      issue.workOrderId = wo.id

      /* verification records for terminal-verified states */
      if (['VERIFICATION', 'RESOLVED', 'CLOSED', 'REINSPECTION_REQUIRED'].includes(woStatus)) {
        const result: VerificationResult =
          woStatus === 'REINSPECTION_REQUIRED' ? 'REINSPECTION_REQUIRED' : 'RESOLVED'
        const vSeq = verifSeq++
        const vAt = createdAt + DAY * 1.5
        verifications.push({
          id: `VER-${String(vSeq).padStart(4, '0')}`,
          workOrderId: wo.id,
          issueId,
          result: woStatus === 'VERIFICATION' ? null : result,
          checks: [
            { key: 'location', label: 'Location match', pass: true, detail: 'Before and after coordinates align.' },
            { key: 'timestamp', label: 'Evidence timestamps', pass: true, detail: 'Both uploads timestamped.' },
            { key: 'evidence', label: 'Evidence completeness', pass: true, detail: 'before + after uploaded.' },
            {
              key: 'visual',
              label: 'Reported repair complete',
              pass: result === 'RESOLVED',
              detail: result === 'RESOLVED' ? 'Crew confirmed completion.' : 'Repair reported incomplete on inspection.',
            },
            {
              key: 'persistence',
              label: 'Issue persistence check',
              pass: result === 'RESOLVED',
              detail: result === 'RESOLVED' ? 'No reopen reported.' : 'Citizen reported the defect persisting.',
            },
          ],
          notes: result === 'RESOLVED' ? 'Evidence accepted.' : 'Defect visible in after photo — reinspection scheduled.',
          inspectorId: 'u-inspector-1',
          createdAt: new Date(vAt).toISOString(),
        })
      }
    }

    issues.push(issue)

    /* -------- Audit trail -------- */
    pushAudit('ISSUE', issueId, 'Citizen submitted report', `Report ${reportIds[0]} received at ${zone.name}.`, firstReport.submittedBy, 'CITIZEN', firstReportAt)
    pushAudit('ISSUE', issueId, 'AI analysis completed', `Classified as ${cfg.label} (${Math.floor(70 + rnd() * 25)}% demo confidence).`, 'system', 'SYSTEM', firstReportAt + 60_000)
    pushAudit('ISSUE', issueId, 'Trust evaluated', `Trust score ${trust.score} — ${trust.label.replace('_', ' ')}.`, 'system', 'SYSTEM', firstReportAt + 90_000)
    if (reportCount > 1) {
      pushAudit('ISSUE', issueId, 'Duplicate cluster updated', `${reportCount} reports clustered into one master issue.`, 'system', 'SYSTEM', firstReportAt + 120_000)
    }
    pushAudit('ISSUE', issueId, 'Priority calculated', `${priorityScore.level} (${priorityScore.score}/100): ${priorityScore.explanation}`, 'system', 'SYSTEM', firstReportAt + 130_000)
    if (issue.departmentId) {
      pushAudit('ISSUE', issueId, 'Department assigned', `Routed to ${departmentName(issue.departmentId)}.`, 'u-officer-road', 'DEPARTMENT_OFFICER', firstReportAt + DAY)
    }
    if (issue.workOrderId) {
      const wo = workOrders.find((w) => w.id === issue.workOrderId) as WorkOrder
      pushAudit('WORK_ORDER', wo.id, 'Work order created', `${wo.id} created for ${issueId}.`, 'u-officer-road', 'DEPARTMENT_OFFICER', new Date(wo.createdAt).getTime())
      pushAudit('WORK_ORDER', wo.id, 'Crew assigned', `${crewName(wo.crewId)} dispatched.`, 'u-officer-road', 'DEPARTMENT_OFFICER', new Date(wo.createdAt).getTime() + 60_000)
      if (wo.beforeEvidenceId) {
        pushAudit('WORK_ORDER', wo.id, 'Before evidence uploaded', 'Crew uploaded BEFORE photo.', wo.crewId ?? 'system', 'FIELD_CREW', new Date(wo.createdAt).getTime() + DAY * 0.6)
      }
      if (wo.status !== 'ASSIGNED' && wo.status !== 'NEW') {
        pushAudit('WORK_ORDER', wo.id, 'Repair in progress', `Status → ${wo.status}.`, wo.crewId ?? 'system', 'FIELD_CREW', new Date(wo.createdAt).getTime() + DAY)
      }
      if (wo.afterEvidenceId) {
        pushAudit('WORK_ORDER', wo.id, 'After evidence uploaded', 'Crew uploaded AFTER photo.', wo.crewId ?? 'system', 'FIELD_CREW', new Date(wo.createdAt).getTime() + DAY * 1.4)
      }
      const ver = verifications.find((v) => v.workOrderId === wo.id)
      if (ver && ver.result) {
        pushAudit('VERIFICATION', ver.id, 'Verification completed', `Result: ${ver.result.replace('_', ' ')}.`, 'u-inspector-1', 'INSPECTOR', new Date(ver.createdAt).getTime())
      }
    }
    if (issue.closedAt) {
      pushAudit('ISSUE', issueId, 'Issue closed', 'Workflow complete.', 'u-inspector-1', 'INSPECTOR', new Date(issue.closedAt).getTime())
    }

    /* -------- Notifications (citizen + crew) -------- */
    const citizen = firstReport.submittedBy
    pushNotif(citizen, 'CITIZEN', 'Your report has been received', `${issueId} — ${cfg.label} near ${zone.name}.`, issueId, firstReportAt)
    if (issue.status === 'RESOLVED' || issue.status === 'CLOSED') {
      pushNotif(citizen, 'CITIZEN', 'Your issue has been resolved', `${issueId} passed verification.`, issueId, closedAt ?? now - DAY)
    } else if (issue.workOrderId) {
      pushNotif(citizen, 'CITIZEN', 'A crew has been dispatched', `${issueId} is now being repaired.`, issueId, openedAt + DAY * 1.2)
    } else if (issue.departmentId) {
      pushNotif(citizen, 'CITIZEN', 'Your issue has been assigned', `${departmentName(issue.departmentId)} took ownership.`, issueId, openedAt + DAY)
    }
  }

  /* ---------------- MG Road pending duplicate cluster ----------------
   * 7 unclustered pothole reports around MG Road, all < 350 m apart and
   * < 3 days old — the citizen's new report merges them into ONE master
   * issue (the §6 acceptance scenario: "7 similar reports found").
   */
  const mgCenter = (ZONES[0] as Zone).center
  const pendingReportIds: string[] = []
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2
    const radius = 0.0006 + (i % 3) * 0.0005 // ~65-170 m from centre
    const point = {
      lat: mgCenter.lat + Math.sin(angle) * radius,
      lng: mgCenter.lng + Math.cos(angle) * radius,
    }
    const at = now - (0.4 + i * 0.42) * DAY // within last ~3 days
    const hasPhoto = i < 4 // 4 photos → +1 from citizen = 5 unique photos
    let evId: string | null = null
    if (hasPhoto) {
      const ev = seedEvidence('POTHOLE', 'REPORT', 'REPORT', SEED_USERS[i % 3]?.id ?? 'u-citizen-1', at, point)
      evId = ev.id
    }
    const street = 'MG Road'
    const landmark = LANDMARKS[i % LANDMARKS.length] as string
    const rep: Report = {
      id: `RPT-9${String(i + 1).padStart(3, '0')}`,
      issueId: null, // pending duplicate analysis — no master issue yet
      category: 'POTHOLE',
      description: seededDescription('POTHOLE', street, landmark, rnd),
      point,
      address: `MG Road, Ward 4 · MG Road`,
      evidenceId: evId,
      submittedBy: SEED_USERS[i % 3]?.id ?? 'u-citizen-1',
      createdAt: new Date(at).toISOString(),
      synthetic: true,
    }
    reports.push(rep)
    pendingReportIds.push(rep.id)
  }

  return {
    users: SEED_USERS,
    crews: SEED_CREWS,
    issues,
    reports,
    evidence,
    workOrders,
    verifications,
    audit,
    notifications,
    seq: {
      issue: 1001 + STATUS_PATTERN.length,
      report: reports.length + 1,
      workOrder: workOrders.length + 1,
      evidence: evidenceSeq,
      audit: auditSeq,
      notification: notifSeq,
      verification: verifSeq,
    },
  }
}

function crewFor(departmentId: string, i: number): string {
  const options = SEED_CREWS.filter((c) => c.departmentId === departmentId)
  const chosen = options[i % Math.max(1, options.length)] ?? SEED_CREWS[0] ?? null
  return chosen?.id ?? 'crew-road-a'
}

function crewName(id: string | null): string {
  return SEED_CREWS.find((c) => c.id === id)?.name ?? 'Unassigned crew'
}

export function departmentName(id: string): string {
  switch (id) {
    case 'dept-road': return 'Road Maintenance'
    case 'dept-water': return 'Water Supply'
    case 'dept-sanitation': return 'Sanitation'
    case 'dept-electrical': return 'Electrical'
    case 'dept-drainage': return 'Drainage'
    default: return id
  }
}

export function instructionsFor(category: IssueCategory): string {
  switch (category) {
    case 'POTHOLE':
      return 'Clear debris, fill with hot-mix asphalt in layers, compact and level with surrounding surface. Cones while curing.'
    case 'ROAD_DAMAGE':
      return 'Mill damaged section, patch with base course and wearing course, compact to level. Reinforce edges.'
    case 'WATER_LEAK':
      return 'Isolate supply, excavate carefully, replace damaged pipe section, pressure-test before backfill.'
    case 'GARBAGE':
      return 'Load and clear all dumped waste, disinfect the spot, check bin collection schedule for the ward.'
    case 'STREETLIGHT':
      return 'Isolate circuit, inspect driver and lamp, replace faulty unit, verify lux level after dusk.'
    case 'DRAINAGE':
      return 'De-silt the drain, remove debris blockage, flush with water, inspect outlet flow.'
    default:
      return 'Inspect and repair as per standard municipal procedure.'
  }
}

/** Utility for tests and UI: confirm the pending cluster really matches. */
export function pendingClusterStats(reports: Report[], near: GeoPoint) {
  let within = 0
  for (const r of reports) {
    if (r.issueId !== null) continue
    if (haversineMeters(r.point, near) <= 350 && textSimilarity(r.description, 'pothole road near landmark') >= 0) {
      within += 1
    }
  }
  return within
}

export const SEED_SLA = SLA_POLICY
export const SEED_TRAFFIC = TRAFFIC_CLASSES
export const SEED_CENTER = CITY_CENTER
