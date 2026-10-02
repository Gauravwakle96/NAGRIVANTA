/**
 * Session store — demo sign-in by role (§23, §32).
 *
 * Phase 1 authentication is explicitly a DEMO session: picking a role issues
 * a local session record. Server-side role checks still apply when the API
 * is live; a real identity provider plugs in behind the same store later
 * (SupabaseAuthProvider boundary — not faked as integrated).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SEED_USERS } from '@/services/demo/seed'
import type { Role, User } from '@/types/domain'

interface SessionState {
  user: User | null
  /** true once the user explicitly signed in during this browser session */
  signedIn: boolean
  signIn: (role: Role) => void
  signOut: () => void
  setUser: (user: User) => void
}

function pickDemoUser(role: Role): User {
  // officers/supervisors/admins share the road officer demo identity where
  // a dedicated seed user does not exist
  const exact = SEED_USERS.find((u) => u.role === role)
  if (exact) return exact
  const fallbackByRole: Partial<Record<Role, string>> = {
    SUPERVISOR: 'u-supervisor-1',
    CITY_ADMIN: 'u-admin-1',
    CITY_LEADERSHIP: 'u-leadership-1',
    DEPARTMENT_OFFICER: 'u-officer-road',
  }
  const fid = fallbackByRole[role]
  const found = fid ? SEED_USERS.find((u) => u.id === fid) : undefined
  if (found) return found
  return { id: `u-${role.toLowerCase()}`, name: `${role} (demo)`, role, avatarLabel: role.slice(0, 2) }
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      signedIn: false,
      signIn: (role: Role) => set({ user: pickDemoUser(role), signedIn: true }),
      signOut: () => set({ user: null, signedIn: false }),
      setUser: (user: User) => set({ user }),
    }),
    { name: 'nagrivanta.session.v1' },
  ),
)

/** Roles allowed on each route group. */
export const ROUTE_ROLES: Record<string, Role[]> = {
  report: ['CITIZEN'],
  track: ['CITIZEN'],
  'my-issues': ['CITIZEN'],
  nearby: ['CITIZEN'],
  command: ['DEPARTMENT_OFFICER', 'SUPERVISOR', 'CITY_ADMIN', 'CITY_LEADERSHIP'],
  issues: ['DEPARTMENT_OFFICER', 'SUPERVISOR', 'CITY_ADMIN', 'INSPECTOR'],
  map: ['DEPARTMENT_OFFICER', 'SUPERVISOR', 'CITY_ADMIN', 'CITY_LEADERSHIP', 'INSPECTOR'],
  risk: ['DEPARTMENT_OFFICER', 'SUPERVISOR', 'CITY_ADMIN', 'CITY_LEADERSHIP'],
  'work-orders': ['DEPARTMENT_OFFICER', 'SUPERVISOR', 'CITY_ADMIN', 'FIELD_CREW'],
  departments: ['DEPARTMENT_OFFICER', 'SUPERVISOR', 'CITY_ADMIN'],
  crews: ['DEPARTMENT_OFFICER', 'SUPERVISOR', 'CITY_ADMIN'],
  verification: ['INSPECTOR', 'SUPERVISOR', 'CITY_ADMIN'],
  analytics: ['SUPERVISOR', 'CITY_ADMIN', 'CITY_LEADERSHIP'],
  audit: ['CITY_ADMIN', 'SUPERVISOR'],
  notifications: [], // all roles
  crew: ['FIELD_CREW'],
  leadership: ['CITY_LEADERSHIP', 'CITY_ADMIN', 'SUPERVISOR'],
}

export function canAccess(section: string, role: Role | undefined): boolean {
  if (!section) return true
  const allowed = ROUTE_ROLES[section]
  if (!allowed) return true
  if (allowed.length === 0) return true
  if (!role) return false
  return allowed.includes(role)
}
