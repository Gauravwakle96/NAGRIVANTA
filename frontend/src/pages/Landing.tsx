/**
 * Landing (§10). Hero + the nine-step workflow rendered so it is
 * understandable without documentation.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileStack,
  Gauge,
  GitMerge,
  MapPin,
  Radar,
  Route as RouteIcon,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_NAME } from '@/config/app'
import { cn } from '@/lib/utils'

interface WorkflowStep {
  key: string
  label: string
  question: string
  answer: string
  icon: typeof Camera
}

const WORKFLOW: WorkflowStep[] = [
  { key: 'photo', label: 'PHOTO', question: 'What do you see?', answer: 'A citizen uploads a photo, drops a pin and writes one line.', icon: Camera },
  { key: 'ai', label: 'AI', question: 'What kind of problem?', answer: 'Classification picks the category and the department that owns it.', icon: Cpu },
  { key: 'trust', label: 'TRUST', question: 'Is this report real?', answer: 'Evidence, location and corroboration produce a trust score with reasons.', icon: ShieldCheck },
  { key: 'duplicate', label: 'DUPLICATE', question: 'Has anyone else reported this?', answer: 'Nearby matching reports merge into one master issue.', icon: GitMerge },
  { key: 'priority', label: 'PRIORITY', question: 'How urgent, and why?', answer: 'A weighted score with a readable explanation — never a black box.', icon: Gauge },
  { key: 'department', label: 'DEPARTMENT', question: 'Who fixes it?', answer: 'Routing sends the issue to the responsible department and crew.', icon: FileStack },
  { key: 'repair', label: 'REPAIR', question: 'Is work happening?', answer: 'A work order is dispatched; the crew uploads BEFORE evidence.', icon: ClipboardList },
  { key: 'verify', label: 'VERIFY', question: 'Was it actually fixed?', answer: 'AFTER evidence is compared against BEFORE — resolved or reinspect.', icon: CheckCircle2 },
  { key: 'predict', label: 'PREDICT', question: 'Where will it fail next?', answer: 'Historical patterns flag future risk zones for preventive action.', icon: Radar },
]

function WorkflowLadder() {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % WORKFLOW.length), 1900)
    return () => window.clearInterval(id)
  }, [reduce])

  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px] tracking-widest">REPORT → UNDERSTAND → TRUST → MERGE</Badge>
        <Badge variant="outline" className="font-mono text-[10px] tracking-widest">PRIORITIZE → ASSIGN → FIX → VERIFY</Badge>
        <Badge variant="outline" className="font-mono text-[10px] tracking-widest">PREDICT → PREVENT</Badge>
      </div>

      <ol className="relative space-y-2" aria-label="Nagrivanta processing workflow">
        <span className="absolute left-[26px] top-4 bottom-4 w-px bg-border" aria-hidden />
        {WORKFLOW.map((step, i) => {
          const isActive = i === active
          return (
            <li key={step.key} className="relative">
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className={cn(
                  'group relative flex w-full items-start gap-4 rounded-xl border px-4 py-3 text-left transition-all',
                  'focus-visible:outline-2 focus-visible:outline-ring',
                  isActive
                    ? 'border-primary/40 bg-card shadow-sm shadow-primary/5'
                    : 'border-transparent bg-card/40 hover:border-border hover:bg-card/80',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    isActive ? 'border-primary/40 bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
                  )}
                  aria-hidden
                >
                  <step.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn('font-mono text-xs font-bold tracking-[0.2em]', isActive ? 'text-primary' : 'text-foreground/80')}>
                      {String(i + 1).padStart(2, '0')} · {step.label}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-foreground">{step.question}</span>
                  <motion.span
                    key={step.answer}
                    initial={reduce ? false : { opacity: 0, y: -3 }}
                    animate={{ opacity: isActive ? 1 : 0.55, y: 0 }}
                    className="mt-0.5 block text-sm text-muted-foreground"
                  >
                    {step.answer}
                  </motion.span>
                </span>
                {isActive ? (
                  <motion.span layoutId="workflow-active" className="absolute inset-y-1 left-0 w-0.5 rounded bg-primary" aria-hidden />
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const DIFFERENTIATORS = [
  {
    step: 'Trust',
    usual: 'Accept every report',
    ours: "Checks it's real first",
    detail: 'Image, location and corroboration feed a score you can read.',
    icon: ShieldCheck,
  },
  {
    step: 'Duplicates',
    usual: 'Each report alone',
    ours: 'Merges 8 reports into 1 issue',
    detail: 'Nearby matching reports become one master issue and one work order.',
    icon: GitMerge,
  },
  {
    step: 'Priority',
    usual: 'Fixed rules',
    ours: 'Explainable reasoning',
    detail: 'Every point is attributed — volume, corridor, safety, age.',
    icon: Gauge,
  },
  {
    step: 'Verification',
    usual: "Trust the crew's word",
    ours: 'Before/after proof',
    detail: 'Evidence comparison decides RESOLVED or REINSPECTION.',
    icon: CheckCircle2,
  },
]

export default function Landing() {
  const reduce = useReducedMotion()
  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-ring">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <RouteIcon className="size-4.5" aria-hidden />
            </span>
            <span className="text-sm font-bold tracking-[0.2em]">{APP_NAME}</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
            <a href="#how-it-works" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">How It Works</a>
            <Link to="/city-map" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">City Map</Link>
            <Link to="/report" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Report Issue</Link>
            <Link to="/track" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Track Issue</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/signin">Sign In</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/report">Report a Problem</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.42_0.115_258/0.10),transparent_60%)]"
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6 font-mono text-[10px] tracking-[0.25em]">
              CITY CIVIC INTELLIGENCE PLATFORM
            </Badge>
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl"
            >
              YOUR CITY SHOULD FIX
              <br />
              PROBLEMS BEFORE THEY
              <br />
              <span className="text-primary">BECOME FAILURES.</span>
            </motion.h1>
            <p className="mt-6 font-mono text-xs text-muted-foreground sm:text-sm">
              Report → Verify → Group → Prioritize → Resolve → Prevent
            </p>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              One photo becomes classified, trust-checked, merged with neighbours, prioritized with
              visible reasoning, assigned to a crew, proven fixed — and finally used to predict the
              next failure.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/report">
                  Report a Civic Problem <ArrowRight className="ml-2 size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/city-map">Explore City Intelligence</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/demo">Launch Guided Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="how-it-works" className="border-y border-border/60 bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">How a report becomes a repair</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Nine steps, every one with a question it answers. Tap any step to see what happens.
            </p>
          </div>
          <WorkflowLadder />
        </div>
      </section>

      {/* Differentiators */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold sm:text-3xl">Four things that make it different</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The gap between a complaint box and an operations platform.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.step} className="rounded-xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <d.icon className="size-4" aria-hidden />
                </span>
                <h3 className="font-semibold">{d.step}</h3>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-baseline gap-2">
                  <dt className="w-28 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Most apps</dt>
                  <dd className="text-muted-foreground line-through decoration-destructive/60">{d.usual}</dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="w-28 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Nagrivanta</dt>
                  <dd className="font-semibold text-foreground">{d.ours}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-muted-foreground">{d.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Risk teaser */}
      <section className="border-t border-border/60 bg-muted/30 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold">Where will the next problem appear?</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              The risk engine reads twelve months of synthetic history and highlights zones likely to
              fail next — so crews prevent instead of react. All predictions are explicitly marked
              <span className="font-semibold text-foreground"> simulated</span>.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-destructive" aria-hidden /> HIGH — schedule preventive work now</li>
              <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-warning" aria-hidden /> MEDIUM — monitor and pre-audit</li>
              <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-success" aria-hidden /> LOW — stable, routine cycle</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline"><Link to="/app/risk">Open Risk Intelligence</Link></Button>
              <Button asChild variant="ghost"><Link to="/city-map"><MapPin className="mr-2 size-4" />View risk zones</Link></Button>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-6 lg:w-80">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Then · preventive action</p>
            <p className="mt-2 text-lg font-bold">Fix it BEFORE it breaks</p>
            <div className="mt-4 space-y-3">
              {[
                { cat: 'Potholes', tag: 'H', hot: true },
                { cat: 'Water leaks', tag: 'H', hot: true },
                { cat: 'Garbage', tag: 'M', hot: false },
                { cat: 'Streetlights', tag: 'L', hot: false },
                { cat: 'Drainage', tag: 'M', hot: false },
                { cat: 'Road damage', tag: 'L', hot: false },
              ].map((r) => (
                <div key={r.cat} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{r.cat}</span>
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded text-[10px] font-bold',
                      r.tag === 'H' ? 'bg-destructive text-white' : r.tag === 'M' ? 'bg-warning/20 text-warning' : 'bg-success/15 text-success',
                    )}
                  >
                    {r.tag}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground">DEMO DATA · SYNTHETIC HISTORY</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">See the whole loop in three minutes</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          The guided demo runs the full acceptance scenario with real service calls — report,
          duplicate merge, assignment, repair, verification, prediction.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/demo">Launch Guided Demo</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/report">Report an Issue</Link></Button>
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden /> Deterministic demo data — no AI keys, no external
          services, works offline.
        </p>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        {APP_NAME} · City Civic Intelligence Platform · synthetic demonstration data
      </footer>
    </div>
  )
}
