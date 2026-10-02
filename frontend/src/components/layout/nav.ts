/**
 * Navigation model — role-aware (§23).
 * Each role sees only its own navigation; nothing is shared wholesale.
 */

import {
  AlertOctagon,
  BarChart3,
  Bell,
  ClipboardList,
  Construction,
  FileClock,
  Gauge,
  Globe2,
  HardHat,
  Home,
  MapPinned,
  Map as MapIcon,
  Radar,
  Route,
  ShieldCheck,
  Users,
  TrafficCone,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/types/domain'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  section: string
}

export const PUBLIC_NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: Home, section: '' },
  { label: 'How It Works', to: '/#how-it-works', icon: Route, section: '' },
  { label: 'City Map', to: '/city-map', icon: MapIcon, section: '' },
  { label: 'Report Issue', to: '/report', icon: AlertOctagon, section: 'report' },
  { label: 'Track Issue', to: '/track', icon: ClipboardList, section: 'track' },
]

const CITIZEN_NAV: NavItem[] = [
  { label: 'Report Issue', to: '/report', icon: AlertOctagon, section: 'report' },
  { label: 'Track Issue', to: '/track', icon: ClipboardList, section: 'track' },
  { label: 'My Issues', to: '/citizen/issues', icon: TrafficCone, section: 'my-issues' },
  { label: 'Nearby Issues', to: '/citizen/nearby', icon: MapPinned, section: 'nearby' },
  { label: 'Notifications', to: '/citizen/notifications', icon: Bell, section: 'notifications' },
  { label: 'City Map', to: '/city-map', icon: MapIcon, section: '' },
]

const CREW_NAV: NavItem[] = [
  { label: "Today's Jobs", to: '/crew', icon: HardHat, section: 'crew' },
  { label: 'Map', to: '/city-map', icon: MapIcon, section: '' },
  { label: 'Notifications', to: '/citizen/notifications', icon: Bell, section: 'notifications' },
]

const INSPECTOR_NAV: NavItem[] = [
  { label: 'Verification', to: '/app/verification', icon: ShieldCheck, section: 'verification' },
  { label: 'Issues', to: '/app/issues', icon: TrafficCone, section: 'issues' },
  { label: 'Live Map', to: '/app/map', icon: MapIcon, section: 'map' },
  { label: 'Audit Log', to: '/app/audit', icon: FileClock, section: 'audit' },
]

const OFFICER_NAV: NavItem[] = [
  { label: 'Command Center', to: '/app/command', icon: Gauge, section: 'command' },
  { label: 'Issues', to: '/app/issues', icon: TrafficCone, section: 'issues' },
  { label: 'Live Map', to: '/app/map', icon: MapIcon, section: 'map' },
  { label: 'Work Orders', to: '/app/work-orders', icon: ClipboardList, section: 'work-orders' },
  { label: 'Risk Intelligence', to: '/app/risk', icon: Radar, section: 'risk' },
  { label: 'Verification', to: '/app/verification', icon: ShieldCheck, section: 'verification' },
  { label: 'Departments', to: '/app/departments', icon: Users, section: 'departments' },
  { label: 'Crews', to: '/app/crews', icon: Construction, section: 'crews' },
  { label: 'Analytics', to: '/app/analytics', icon: BarChart3, section: 'analytics' },
  { label: 'Audit Log', to: '/app/audit', icon: FileClock, section: 'audit' },
  { label: 'Notifications', to: '/app/notifications', icon: Bell, section: 'notifications' },
]

const SUPERVISOR_NAV: NavItem[] = OFFICER_NAV

const ADMIN_NAV: NavItem[] = [...OFFICER_NAV]

const LEADERSHIP_NAV: NavItem[] = [
  { label: 'City Health', to: '/app/analytics', icon: Gauge, section: 'analytics' },
  { label: 'Risk Outlook', to: '/app/risk', icon: Radar, section: 'risk' },
  { label: 'Live Map', to: '/app/map', icon: Globe2, section: 'map' },
  { label: 'Trends', to: '/app/analytics', icon: BarChart3, section: 'analytics' },
  { label: 'Issues', to: '/app/issues', icon: TrafficCone, section: 'issues' },
  { label: 'Audit Log', to: '/app/audit', icon: FileClock, section: 'audit' },
]

export function navForRole(role: Role | undefined, signedIn: boolean): NavItem[] {
  if (!role) return PUBLIC_NAV.filter((n) => n.to !== '/citizen/notifications')
  if (!signedIn) return PUBLIC_NAV
  switch (role) {
    case 'CITIZEN':
      return CITIZEN_NAV
    case 'FIELD_CREW':
      return CREW_NAV
    case 'INSPECTOR':
      return INSPECTOR_NAV
    case 'DEPARTMENT_OFFICER':
      return OFFICER_NAV
    case 'SUPERVISOR':
      return SUPERVISOR_NAV
    case 'CITY_ADMIN':
      return ADMIN_NAV
    case 'CITY_LEADERSHIP':
      return LEADERSHIP_NAV
    default:
      return PUBLIC_NAV
  }
}

/** Where a role lands after signing in. */
export function homeForRole(role: Role): string {
  switch (role) {
    case 'CITIZEN':
      return '/citizen/issues'
    case 'FIELD_CREW':
      return '/crew'
    case 'INSPECTOR':
      return '/app/verification'
    case 'CITY_LEADERSHIP':
      return '/app/analytics'
    default:
      return '/app/command'
  }
}
