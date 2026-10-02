/**
 * Launch Guided Demo (§46) — runs the §6 acceptance scenario by calling the
 * REAL service layer step by step. Deterministic; degrades gracefully if the
 * API is unreachable (registry falls back to demo provider automatically).
 *
 * Each step maps to an actual mutation, so what the judge reads is what the
 * platform actually did.
 */

import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Play,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { DemoModeBadge } from '@/components/layout/AppShell'
import { useServiceMode } from '@/hooks/useService'
import { getService } from '@/services/registry'
import { useSession } from '@/stores/session'
import { DemoDataProvider } from '@/services/demo/demoProvider'
import type {
  ClassificationResult,
  DuplicateAnalysis,
  Issue,
  PriorityScore,
  TrustScore,
  Verification,
  WorkOrder,
} from '@/types/domain'
import { cn } from '@/lib/utils'

interface StepResult {
  label: string
  detail: string
  issueId?: string
}

interface StepDef {
  key: string
  title: string
  narrative: string
  run: (ctx: DemoCtx) => Promise<StepResult>
}

interface DemoCtx {
  actor: ReturnType<typeof useSession.getState>['user']
  state: {
    issue?: Issue
    classification?: ClassificationResult
    trust?: TrustScore
    duplicates?: DuplicateAnalysis
    priority?: PriorityScore
    workOrder?: WorkOrder
    verification?: Verification
    beforeDataUrl?: string
    afterDataUrl?: string
  }
}

const BEFORE_IMG = DemoDataProvider.placeholderImage('POTHOLE', 'BEFORE', 'BEFORE')
const AFTER_IMG = DemoDataProvider.placeholderImage('POTHOLE', 'AFTER', 'AFTER')

/** Citizen coordinates: MG Road — inside the seeded 7-report pending cluster. */
const DEMO_POINT = { lat: 18.52063, lng: 73.85671 }
const DEMO_ADDRESS = 'MG Road, Ward 4 · MG Road'

const officerActor = { id: 'u-officer-road', name: 'Meera Kulkarni', role: 'DEPARTMENT_OFFICER' as const, departmentId: 'dept-road', avatarLabel: 'MK' }
const crewActor = { id: 'u-crew-road-a', name: 'Sanjay Pawar', role: 'FIELD_CREW' as const, crewId: 'crew-road-a', avatarLabel: 'SP' }
const inspectorActor = { id: 'u-inspector-1', name: 'Rohan Deshpande', role: 'INSPECTOR' as const, avatarLabel: 'RD' }

const STEPS: StepDef[] = [
  {
    key: 'report',
    title: 'Citizen reports pothole',
    narrative: 'Photo + pin + one line of description submitted through the report flow.',
    run: async (ctx) => {
      const svc = getService()
      const res = await svc.submitReport({
        description: 'Deep pothole on MG Road near the bus stop, cars swerving to avoid it.',
        point: DEMO_POINT,
        address: DEMO_ADDRESS,
        imageDataUrl: BEFORE_IMG,
        submittedBy: 'u-citizen-1',
      })
      ctx.state.issue = res.issue
      ctx.state.classification = res.classification
      ctx.state.trust = res.trust
      ctx.state.duplicates = res.duplicates
      ctx.state.priority = res.priority
      return {
        label: `Report ${res.report.id} accepted → ${res.issue.id}`,
        detail: `Master issue ${res.issue.id} now holds ${res.issue.reportIds.length} reports.`,
        issueId: res.issue.id,
      }
    },
  },
  {
    key: 'classify',
    title: 'AI identifies pothole',
    narrative: 'Classification assigns category, department and severity (demo heuristic, marked simulated).',
    run: async (ctx) => {
      const svc = getService()
      const c = await svc.classify({ description: 'Deep pothole near bus stop' })
      ctx.state.classification = c
      return { label: `${c.categoryLabel} → ${c.departmentName}`, detail: `severity ${c.severity} · confidence ${c.confidence}% (demo)` }
    },
  },
  {
    key: 'trust',
    title: 'Trust check',
    narrative: 'Evidence, location and corroboration produce an explainable trust score.',
    run: async (ctx) => {
      const t = ctx.state.trust
      if (!t) throw new Error('trust missing — run report step first')
      return {
        label: `${t.score}% · ${t.label.replace('_', ' ')}`,
        detail: t.factors.map((f) => f.label).join(' · '),
      }
    },
  },
  {
    key: 'dupes',
    title: 'Duplicate reports detected',
    narrative: 'Nearby matching reports found within the 350 m duplicate radius.',
    run: async (ctx) => {
      const d = ctx.state.duplicates
      if (!d) throw new Error('duplicate analysis missing')
      return {
        label: `${d.matchedCount} similar reports found`,
        detail: d.nearestDistanceMeters !== null ? `nearest match ${d.nearestDistanceMeters} m away` : 'no matches',
      }
    },
  },
  {
    key: 'master',
    title: 'Master issue created',
    narrative: 'All matching reports collapse into ONE master issue — original evidence preserved.',
    run: async (ctx) => {
      const i = ctx.state.issue
      if (!i) throw new Error('issue missing')
      const master = await getService().getMasterSummary(i.id)
      return {
        label: `${i.reportIds.length} reports → 1 master issue → ${i.workOrderId ? '1 work order' : 'work order pending'}`,
        detail: master ? `${master.reportCount} reports · ${master.photoCount} unique photos · ${master.daysActive} days active` : '',
        issueId: i.id,
      }
    },
  },
  {
    key: 'priority',
    title: 'HIGH priority explained',
    narrative: 'Weighted factors compute the score; every point is attributable.',
    run: async (ctx) => {
      const p = ctx.state.priority ?? ctx.state.issue?.priorityScore
      if (!p) throw new Error('priority missing')
      return {
        label: `${p.level} · ${p.score}/100`,
        detail: p.factors.slice(0, 3).map((f) => `${f.label} +${f.points}`).join(' · '),
      }
    },
  },
  {
    key: 'dept',
    title: 'Department assigned',
    narrative: 'Officer routes the master issue to the responsible department.',
    run: async (ctx) => {
      const i = ctx.state.issue
      if (!i) throw new Error('issue missing')
      const updated = await getService().assignDepartment(i.id, 'dept-road', officerActor)
      ctx.state.issue = updated
      return { label: 'Road Maintenance', detail: `${updated.id} status → ${updated.status.replaceAll('_', ' ')}`, issueId: updated.id }
    },
  },
  {
    key: 'wo',
    title: 'Work order created & crew dispatched',
    narrative: 'A work order is generated with SLA and dispatched to a field crew.',
    run: async (ctx) => {
      const i = ctx.state.issue
      if (!i) throw new Error('issue missing')
      const res = await getService().createWorkOrder(i.id, 'crew-road-a', '', officerActor)
      ctx.state.issue = res.issue
      ctx.state.workOrder = res.workOrder
      return { label: `${res.workOrder.id} → Road Team A`, detail: `SLA due ${new Date(res.workOrder.slaDueAt).toLocaleString()}`, issueId: res.issue.id }
    },
  },
  {
    key: 'crew',
    title: 'Crew accepts & uploads BEFORE',
    narrative: 'Crew accepts the job, reaches the site and uploads before-evidence.',
    run: async (ctx) => {
      const wo = ctx.state.workOrder
      if (!wo) throw new Error('work order missing')
      const svc = getService()
      await svc.transitionWorkOrder(wo.id, 'ACCEPTED', crewActor, 'Crew accepted')
      await svc.transitionWorkOrder(wo.id, 'DISPATCHED', crewActor, 'En route')
      const w1 = await svc.transitionWorkOrder(wo.id, 'IN_PROGRESS', crewActor, 'On site')
      const w2 = await svc.uploadEvidence(wo.id, 'BEFORE', BEFORE_IMG, crewActor)
      ctx.state.workOrder = w2
      return { label: 'BEFORE evidence uploaded', detail: `${w1.id} on site · status ${w2.status.replaceAll('_', ' ')}` }
    },
  },
  {
    key: 'repair',
    title: 'Crew marks repair & uploads AFTER',
    narrative: 'Repair confirmed, after-evidence uploaded, job submitted for verification.',
    run: async (ctx) => {
      const wo = ctx.state.workOrder
      if (!wo) throw new Error('work order missing')
      const svc = getService()
      await svc.markRepaired(wo.id, 'Filled pothole with hot mix, compacted, cones placed.', crewActor)
      await svc.uploadEvidence(wo.id, 'AFTER', AFTER_IMG, crewActor)
      const w = await svc.submitRepair(wo.id, { beforeImage: null, afterImage: null, repairedFlag: true, note: 'Repair complete' }, crewActor)
      ctx.state.workOrder = w
      return { label: 'AFTER evidence uploaded · repair submitted', detail: `status → ${w.status.replaceAll('_', ' ')}` }
    },
  },
  {
    key: 'verify',
    title: 'Verification: before/after',
    narrative: 'Inspector compares evidence against five checks and decides.',
    run: async (ctx) => {
      const wo = ctx.state.workOrder
      if (!wo) throw new Error('work order missing')
      const res = await getService().recordVerification(
        wo.id,
        { result: 'RESOLVED', notes: 'Before/after comparison confirms defect corrected.' },
        inspectorActor,
      )
      ctx.state.verification = res.verification
      ctx.state.workOrder = res.workOrder
      ctx.state.issue = res.issue
      const passing = res.verification.checks.filter((c) => c.pass).length
      return { label: `RESOLVED · ${passing}/${res.verification.checks.length} checks passing`, detail: res.verification.notes, issueId: res.issue.id }
    },
  },
  {
    key: 'citizen',
    title: 'Citizen sees resolved status',
    narrative: 'The same issue the citizen submitted now reads RESOLVED with the full timeline.',
    run: async (ctx) => {
      const i = ctx.state.issue
      if (!i) throw new Error('issue missing')
      const fresh = await getService().getIssue(i.id)
      if (!fresh) throw new Error('issue disappeared')
      ctx.state.issue = fresh
      return { label: `${fresh.id} → ${fresh.status.replaceAll('_', ' ')}`, detail: 'Citizen timeline updated end-to-end.', issueId: fresh.id }
    },
  },
  {
    key: 'risk',
    title: 'Risk intelligence predicts future issue',
    narrative: 'The prediction engine flags the corridor for preventive action (simulated).',
    run: async () => {
      const preds = await getService().listRiskPredictions(30)
      const mg = preds.find((p) => p.zoneName === 'MG Road') ?? preds[0]
      if (!mg) throw new Error('no predictions')
      return {
        label: `${mg.zoneName}: risk ${mg.currentRisk} → ${mg.predictedRisk} (${mg.label})`,
        detail: mg.recommendedAction,
      }
    },
  },
]

type StepState = 'idle' | 'running' | 'done' | 'error'

interface StepLog {
  state: StepState
  result?: StepResult
  error?: string
}

export default function GuidedDemo() {
  const reduce = useReducedMotion()
  const mode = useServiceMode()
  const signIn = useSession((s) => s.signIn)
  const navigate = useNavigate()
  const [logs, setLogs] = useState<Record<string, StepLog>>({})
  const [runningAll, setRunningAll] = useState(false)

  // Refs keep the run loop coherent across the async sequence: the stale-closure
  // version replayed every already-done step on each runStep() call (O(n²) service
  // calls), and a render-scoped ctx lost state between individual step clicks.
  const logsRef = useRef<Record<string, StepLog>>({})
  const ctxRef = useRef<DemoCtx>({ actor: useSession.getState().user, state: {} })

  const updateLog = useCallback((key: string, entry: StepLog) => {
    logsRef.current = { ...logsRef.current, [key]: entry }
    setLogs(logsRef.current)
  }, [])

  const runStep = useCallback(
    async (index: number, quiet = false) => {
      const step = STEPS[index]
      if (!step) return false
      const ctx = ctxRef.current
      updateLog(step.key, { state: 'running' as StepState })
      try {
        // replay prior steps silently so state is coherent when jumping around —
        // the ref read sees live progress, so completed steps are never re-run
        for (let i = 0; i < index; i++) {
          const prev = STEPS[i]
          if (prev && logsRef.current[prev.key]?.state !== 'done') {
            const res = await prev.run(ctx)
            updateLog(prev.key, { state: 'done', result: res })
          }
        }
        const result = await step.run(ctx)
        updateLog(step.key, { state: 'done', result })
        if (!quiet) toast.success(step.title, { description: result.label })
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'step failed'
        updateLog(step.key, { state: 'error', error: msg })
        if (!quiet) toast.error(`${step.title} failed`, { description: msg })
        return false
      }
    },
    [updateLog],
  )

  const runAll = async () => {
    setRunningAll(true)
    logsRef.current = {}
    ctxRef.current = { actor: useSession.getState().user, state: {} }
    setLogs({})
    for (let i = 0; i < STEPS.length; i++) {
      const ok = await runStep(i, true)
      if (!ok) break
      // small pause so the judge can follow along
      await new Promise((r) => setTimeout(r, reduce ? 60 : 420))
    }
    setRunningAll(false)
    signIn('CITIZEN')
    toast.success('Acceptance scenario complete', { description: 'Report → … → Predict, executed with real service calls.' })
  }

  const reset = async () => {
    await getService().resetDemoData()
    logsRef.current = {}
    ctxRef.current = { actor: useSession.getState().user, state: {} }
    setLogs({})
    toast.success('Demo data reset to seed')
    navigate(0)
  }

  const doneCount = STEPS.filter((s) => logs[s.key]?.state === 'done').length
  const allDone = doneCount === STEPS.length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Judge mode</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Launch Guided Demo</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            The complete §6 acceptance scenario, executed as real service calls against the live
            provider — not a scripted animation. 2–3 minutes end to end.
          </p>
        </div>
        <DemoModeBadge />
      </div>

      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Scenario progress</CardTitle>
            <span className="font-mono text-xs text-muted-foreground">{doneCount}/{STEPS.length} steps</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={STEPS.length}>
            <motion.div
              className="h-full bg-primary"
              animate={{ width: `${(doneCount / STEPS.length) * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.3 }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runAll()} disabled={runningAll}>
              {runningAll ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Play className="mr-2 size-4" aria-hidden />}
              {runningAll ? 'Running scenario…' : 'Run full scenario'}
            </Button>
            <Button variant="outline" onClick={() => void reset()} disabled={runningAll}>
              <RotateCcw className="mr-2 size-4" aria-hidden /> Reset demo data
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/app/command">Open Command Center</Link>
            </Button>
          </div>

          <ol className="space-y-2">
            {STEPS.map((step, i) => {
              const log = logs[step.key] ?? { state: 'idle' }
              return (
                <li
                  key={step.key}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    log.state === 'done' && 'border-success/40 bg-success/5',
                    log.state === 'running' && 'border-primary/50 bg-primary/5',
                    log.state === 'error' && 'border-destructive/50 bg-destructive/5',
                    log.state === 'idle' && 'border-border/70',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">
                      {log.state === 'done' ? (
                        <CheckCircle2 className="size-4.5 text-success" aria-hidden />
                      ) : log.state === 'running' ? (
                        <Loader2 className="size-4.5 animate-spin text-primary" aria-hidden />
                      ) : log.state === 'error' ? (
                        <CircleDashed className="size-4.5 text-destructive" aria-hidden />
                      ) : (
                        <CircleDashed className="size-4.5 text-muted-foreground/60" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                        {step.title}
                        {log.result?.issueId ? (
                          <Badge variant="outline" className="font-mono text-[9px]">{log.result.issueId}</Badge>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.narrative}</p>
                      {log.result ? (
                        <motion.p
                          initial={reduce ? false : { opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-1.5 rounded-md bg-background/70 px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-semibold text-foreground">{log.result.label}</span>
                          {log.result.detail ? <span className="text-muted-foreground"> — {log.result.detail}</span> : null}
                        </motion.p>
                      ) : null}
                      {log.error ? <p className="mt-1.5 text-xs text-destructive">{log.error}</p> : null}
                    </div>
                    <Button
                      size="sm"
                      variant={log.state === 'done' ? 'ghost' : 'outline'}
                      disabled={runningAll}
                      onClick={() => void runStep(i)}
                    >
                      {log.state === 'done' ? 'Re-run' : 'Run'}
                      <ArrowRight className="ml-1.5 size-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      {allDone ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-success/40 bg-success/10 p-4"
        >
          <p className="font-semibold">Scenario complete.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You just watched one citizen report travel through classification, trust, duplicate
            merging, explainable priority, assignment, work execution, evidence-based verification
            and predictive risk — the entire Nagrivanta loop.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to={`/issues/${logs['citizen']?.result?.issueId ?? logs['report']?.result?.issueId ?? 'NGV-1001'}`}>Open the resolved issue</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/app/audit">Inspect audit trail</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/app/risk">See risk outlook</Link></Button>
          </div>
        </motion.div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Provider: {mode === 'API' ? 'live API' : mode === 'FALLBACK' ? 'demo fallback (API unavailable)' : 'demo provider'} —
          the scenario runs either way.
        </p>
      )}
    </div>
  )
}
