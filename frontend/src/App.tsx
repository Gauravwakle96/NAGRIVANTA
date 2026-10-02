/**
 * Application router (§28).
 * Lazy routes for code splitting (§35); role guards resolve in guards.tsx.
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingState } from '@/components/states'
import { RequireRole } from '@/routes/guards'
import Landing from '@/pages/Landing'

const ReportIssue = lazy(() => import('@/pages/ReportIssue'))
const TrackIssue = lazy(() => import('@/pages/TrackIssue'))
const IssueDetail = lazy(() => import('@/pages/IssueDetail'))
const CityMap = lazy(() => import('@/pages/CityMap'))
const SignIn = lazy(() => import('@/pages/SignIn'))
const CitizenIssues = lazy(() => import('@/pages/citizen/MyIssues'))
const NearbyIssues = lazy(() => import('@/pages/citizen/NearbyIssues'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const CommandCenter = lazy(() => import('@/pages/municipal/CommandCenter'))
const IssueList = lazy(() => import('@/pages/municipal/IssueList'))
const WorkOrders = lazy(() => import('@/pages/municipal/WorkOrders'))
const Departments = lazy(() => import('@/pages/municipal/Departments'))
const Crews = lazy(() => import('@/pages/municipal/Crews'))
const AuditLog = lazy(() => import('@/pages/municipal/AuditLog'))
const RiskIntelligence = lazy(() => import('@/pages/municipal/RiskIntelligence'))
const VerificationQueue = lazy(() => import('@/pages/municipal/VerificationQueue'))
const Analytics = lazy(() => import('@/pages/municipal/Analytics'))
const CrewDashboard = lazy(() => import('@/pages/crew/CrewDashboard'))
const CrewJob = lazy(() => import('@/pages/crew/CrewJob'))
const GuidedDemo = lazy(() => import('@/pages/GuidedDemo'))

function Page({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="py-20"><LoadingState label="Loading view…" /></div>}>{children}</Suspense>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public, no shell chrome */}
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<Page><SignIn /></Page>} />
        <Route
          path="/city-map"
          element={
            <AppShell>
              <Page><CityMap /></Page>
            </AppShell>
          }
        />

        {/* Citizen flows */}
        <Route
          path="/report"
          element={
            <AppShell>
              <Page><ReportIssue /></Page>
            </AppShell>
          }
        />
        <Route
          path="/track"
          element={
            <AppShell>
              <Page><TrackIssue /></Page>
            </AppShell>
          }
        />
        <Route
          path="/issues/:id"
          element={
            <AppShell>
              <Page><IssueDetail /></Page>
            </AppShell>
          }
        />
        <Route
          path="/citizen/issues"
          element={
            <AppShell>
              <Page><CitizenIssues /></Page>
            </AppShell>
          }
        />
        <Route
          path="/citizen/nearby"
          element={
            <AppShell>
              <Page><NearbyIssues /></Page>
            </AppShell>
          }
        />
        <Route
          path="/citizen/notifications"
          element={
            <AppShell>
              <Page><Notifications /></Page>
            </AppShell>
          }
        />

        {/* Field crew */}
        <Route
          path="/crew"
          element={
            <AppShell>
              <Page><CrewDashboard /></Page>
            </AppShell>
          }
        />
        <Route
          path="/crew/jobs/:workOrderId"
          element={
            <AppShell>
              <Page><CrewJob /></Page>
            </AppShell>
          }
        />

        {/* Municipal */}
        <Route
          path="/app"
          element={<Navigate to="/app/command" replace />}
        />
        <Route
          path="/app/command"
          element={
            <AppShell>
              <RequireRole section="command"><Page><CommandCenter /></Page></RequireRole>
            </AppShell>
          }
        />
        <Route
          path="/app/issues"
          element={
            <AppShell>
              <RequireRole section="issues"><Page><IssueList /></Page></RequireRole>
            </AppShell>
          }
        />
        <Route
          path="/app/work-orders"
          element={
            <AppShell>
              <RequireRole section="work-orders"><Page><WorkOrders /></Page></RequireRole>
            </AppShell>
          }
        />
        <Route
          path="/app/departments"
          element={
            <AppShell>
              <RequireRole section="departments"><Page><Departments /></Page></RequireRole>
            </AppShell>
          }
        />
        <Route
          path="/app/crews"
          element={
            <AppShell>
              <RequireRole section="crews"><Page><Crews /></Page></RequireRole>
            </AppShell>
          }
        />
        <Route
          path="/app/verification"
          element={
            <AppShell>
              <RequireRole section="verification"><Page><VerificationQueue /></Page></RequireRole>
            </AppShell>
          }
        />
        <Route
          path="/app/risk"
          element={
            <AppShell>
              <RequireRole section="risk"><Page><RiskIntelligence /></Page></RequireRole>
            </AppShell>
          }
        />
        <Route
          path="/app/analytics"
          element={
            <AppShell>
              <RequireRole section="analytics"><Page><Analytics /></Page></RequireRole>
            </AppShell>
          }
        />
        <Route
          path="/app/audit"
          element={
            <AppShell>
              <RequireRole section="audit"><Page><AuditLog /></Page></RequireRole>
            </AppShell>
          }
        />

        {/* Judge demo */}
        <Route
          path="/demo"
          element={
            <AppShell>
              <Page><GuidedDemo /></Page>
            </AppShell>
          }
        />

        {/* Fallback */}
        <Route
          path="*"
          element={
            <AppShell>
              <div className="py-20 text-center">
                <h1 className="text-2xl font-bold">Page not found</h1>
                <p className="mt-2 text-muted-foreground">That route does not exist.</p>
                <a className="mt-4 inline-block underline" href="/">Back to home</a>
              </div>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
