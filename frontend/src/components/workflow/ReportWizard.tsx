/**
 * ReportWizard — §11 steps 1-7.
 * photo → location → description → AI analysis + duplicate warning + trust →
 * confirmation → issue ID. Reporting is never blocked by a duplicate match.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GitMerge,
  Loader2,
  MapPin,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useSession } from '@/stores/session'
import { useCheckDuplicates, useClassify, useSubmitReport } from '@/hooks/useService'
import { ImageUploader, type UploaderValue } from '@/components/workflow/ImageUploader'
import { LocationPicker, type LocationValue } from '@/components/workflow/LocationPicker'
import { ErrorState } from '@/components/states'
import { CITY_CENTER, CITY_NAME } from '@/config/app'
import { formatDistance } from '@/lib/format'
import type { ClassificationResult, DuplicateAnalysis, Issue, PriorityScore, TrustScore } from '@/types/domain'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3 | 4 | 5

interface AnalysisBundle {
  classification: ClassificationResult
  duplicates: DuplicateAnalysis
  trust: TrustScore
}

export function ReportWizard({ onDone }: { onDone?: (issue: Issue) => void }) {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const submit = useSubmitReport()
  const classifyMut = useClassify()
  const dupMut = useCheckDuplicates()

  const [step, setStep] = useState<Step>(1)
  const [image, setImage] = useState<UploaderValue | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationValue>({
    point: { ...CITY_CENTER },
    address: '',
    status: 'idle',
  })
  const [description, setDescription] = useState('')
  const [descTouched, setDescTouched] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisBundle | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [dupDismissed, setDupDismissed] = useState(false)
  const [viewingExisting, setViewingExisting] = useState(false)
  const [result, setResult] = useState<{ issue: Issue; priority: PriorityScore } | null>(null)

  const descError = useMemo(() => {
    if (!descTouched) return null
    const t = description.trim()
    if (t.length === 0) return 'Tell us what happened.'
    if (t.length < 10) return 'A little more detail helps (at least 10 characters).'
    if (t.length > 600) return 'Keep it under 600 characters.'
    return null
  }, [description, descTouched])

  const canNext =
    step === 1
      ? Boolean(image?.dataUrl) && !imageError
      : step === 2
        ? location.address.trim().length > 0 && location.status !== 'idle'
        : step === 3
          ? description.trim().length >= 10 && description.trim().length <= 600
          : true

  async function runAnalysis() {
    setAnalysing(true)
    setAnalysisError(null)
    try {
      const classification = await classifyMut.mutateAsync({ description: description.trim() })
      const dup = await dupMut.mutateAsync({
        id: 'draft',
        point: location.point,
        description: description.trim(),
        category: classification.category,
        createdAt: new Date().toISOString(),
      })
      // trust is computed server-side at submit; pre-compute a preview here
      const previewTrust: TrustScore = {
        reportId: 'draft',
        score: Math.min(100, (image?.dataUrl ? 34 : 0) + 24 + (description.trim().length >= 40 ? 18 : 6) + (dup.matchedCount > 0 ? 12 : 10)),
        label: dup.matchedCount >= 2 ? 'SIMILAR_REPORT' : 'LIKELY_GENUINE',
        factors: [
          { label: 'Photo evidence attached', detail: image?.dataUrl ? 'Image present (+34).' : 'No image.', impact: image?.dataUrl ? 'POSITIVE' : 'NEGATIVE' },
          { label: 'Location provided', detail: 'Pin present (+24).', impact: 'POSITIVE' },
          ...(dup.matchedCount > 0
            ? [{ label: 'Corroborated by nearby reports', detail: `${dup.matchedCount} independent report(s) nearby (+12).`, impact: 'POSITIVE' as const }]
            : [{ label: 'No corroboration yet', detail: 'Single source — will be re-checked as reports arrive.', impact: 'NEUTRAL' as const }]),
        ],
        engine: 'DemoTrustEngine v1 (preview)',
        evaluatedAt: new Date().toISOString(),
      }
      setAnalysis({ classification, duplicates: dup, trust: previewTrust })
      setStep(4)
    } catch {
      setAnalysisError('Analysis could not run. You can retry or continue — nothing is lost.')
    } finally {
      setAnalysing(false)
    }
  }

  async function doSubmit() {
    setAnalysing(true)
    setAnalysisError(null)
    try {
      const res = await submit.mutateAsync({
        description: description.trim(),
        point: location.point,
        address: location.address.trim() || `${CITY_NAME}`,
        imageDataUrl: image?.dataUrl ?? null,
        submittedBy: user?.id ?? 'u-citizen-1',
      })
      setResult({ issue: res.issue, priority: res.priority })
      setStep(5)
      onDone?.(res.issue)
    } catch {
      setAnalysisError('Submission failed. Please retry — your draft is intact.')
    } finally {
      setAnalysing(false)
    }
  }

  const stepTitles: Record<Step, string> = {
    1: 'Photo',
    2: 'Location',
    3: 'Description',
    4: 'AI analysis',
    5: 'Confirmation',
  }

  if (result) {
    return (
      <ConfirmationCard issue={result.issue} priority={result.priority} onNavigate={navigate} />
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-1" aria-label="Report progress">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <li key={s} className="flex flex-1 items-center gap-1">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                step === s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : step > s
                    ? 'border-success/50 bg-success/15 text-success'
                    : 'border-border text-muted-foreground',
              )}
              aria-current={step === s ? 'step' : undefined}
            >
              {step > s ? <CheckCircle2 className="size-4" aria-hidden /> : s}
            </span>
            <span className={cn('hidden text-xs sm:block', step === s ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {stepTitles[s]}
            </span>
            {s < 4 ? <span className={cn('h-px flex-1', step > s ? 'bg-success/50' : 'bg-border')} aria-hidden /> : null}
          </li>
        ))}
      </ol>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-lg">
            {step === 1 && 'Step 1 · Add a photo'}
            {step === 2 && 'Step 2 · Where is it?'}
            {step === 3 && 'Step 3 · What happened?'}
            {step === 4 && 'Step 4 · AI analysis & trust'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 ? (
            <ImageUploader value={image} onChange={setImage} onError={setImageError} required />
          ) : null}
          {imageError ? <p className="text-sm text-destructive">{imageError}</p> : null}

          {step === 2 ? <LocationPicker value={location} onChange={setLocation} /> : null}

          {step === 3 ? (
            <div className="space-y-3">
              <Label htmlFor="desc">What happened?</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => setDescTouched(true)}
                placeholder="e.g. Deep pothole on MG Road near the bus stop — bikes are losing balance."
                rows={5}
                aria-invalid={Boolean(descError)}
                aria-describedby="desc-help"
              />
              <div className="flex items-center justify-between text-xs" id="desc-help">
                <span className={cn(descError ? 'text-destructive' : 'text-muted-foreground')}>
                  {descError ?? 'Simple language works — mention the spot and what you saw.'}
                </span>
                <span className="font-mono text-muted-foreground">{description.length}/600</span>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="mb-1.5 font-semibold text-foreground">Quick tips that improve classification</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Name the category in your words: pothole, leak, garbage, streetlight, drain.</li>
                  <li>Add a landmark: bus stop, school gate, market entrance.</li>
                  <li>Mention impact: swerving traffic, flooding, dark stretch.</li>
                </ul>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              {analysing ? (
                <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground" role="status">
                  <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
                  <span className="text-sm">Running classification, trust and duplicate checks…</span>
                </div>
              ) : analysisError ? (
                <ErrorState
                  title="Analysis unavailable"
                  description={analysisError}
                  onRetry={() => {
                    void runAnalysis()
                  }}
                />
              ) : analysis ? (
                <AnalysisView
                  analysis={analysis}
                  dupDismissed={dupDismissed}
                  viewingExisting={viewingExisting}
                  onViewExisting={() => setViewingExisting(true)}
                  onDismissDup={() => {
                    setDupDismissed(true)
                    setViewingExisting(false)
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {/* Nav */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
              disabled={step === 1 || analysing}
            >
              <ArrowLeft className="mr-2 size-4" aria-hidden /> Back
            </Button>

            {step < 4 ? (
              <Button
                type="button"
                onClick={() => {
                  if (step === 3) setDescTouched(true)
                  if (canNext) setStep((s) => (s + 1) as Step)
                }}
                disabled={!canNext}
              >
                Next <ArrowRight className="ml-2 size-4" aria-hidden />
              </Button>
            ) : step === 4 && !analysis && !analysing ? (
              <Button type="button" onClick={() => void runAnalysis()}>
                Run AI analysis <ArrowRight className="ml-2 size-4" aria-hidden />
              </Button>
            ) : step === 4 && analysis && !dupDismissed && analysis.duplicates.matchedCount > 0 && !viewingExisting ? null : step === 4 && analysis ? (
              <Button type="button" onClick={() => void doSubmit()} disabled={analysing}>
                {analysing ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Send className="mr-2 size-4" aria-hidden />}
                Submit report
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AnalysisView({
  analysis,
  dupDismissed,
  viewingExisting,
  onViewExisting,
  onDismissDup,
}: {
  analysis: AnalysisBundle
  dupDismissed: boolean
  viewingExisting: boolean
  onViewExisting: () => void
  onDismissDup: () => void
}) {
  const { classification, duplicates, trust } = analysis
  const showDupWarning = duplicates.matchedCount > 0 && !dupDismissed && !viewingExisting

  return (
    <div className="space-y-4">
      {/* Classification */}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">AI classification</p>
          <Badge variant="outline" className="font-mono text-[10px]">DEMO / SIMULATED</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Likely category</dt>
            <dd className="font-semibold">{classification.categoryLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Department</dt>
            <dd className="font-semibold">{classification.departmentName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Severity</dt>
            <dd className="font-semibold">{classification.severity}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Confidence</dt>
            <dd className="font-semibold">{classification.confidence}% <span className="text-xs font-normal text-muted-foreground">demo score</span></dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{classification.summary}</p>
      </div>

      {/* Duplicate warning (§11 step 5) */}
      {showDupWarning ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-warning/50 bg-warning/8 p-4"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <GitMerge className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">This issue may already be reported.</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{duplicates.matchedCount} similar report{duplicates.matchedCount === 1 ? '' : 's'}</span>
                nearby{duplicates.nearestDistanceMeters !== null ? ` · nearest ${formatDistance(duplicates.nearestDistanceMeters)}` : ''}.
                Merging keeps the evidence together.
              </p>
              {viewingExisting ? (
                <div className="mt-3 space-y-2 rounded-lg border border-warning/40 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Similar reports</p>
                  <ul className="space-y-1.5">
                    {duplicates.matches.slice(0, 6).map((m) => (
                      <li key={m.reportId} className="flex items-center justify-between gap-2 text-xs">
                        <Link
                          to={`/issues/${m.issueId}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {m.issueId}
                        </Link>
                        <span className="text-muted-foreground">
                          {formatDistance(m.distanceMeters)} · {Math.round(m.descriptionSimilarity * 100)}% text match
                          {m.categoryAgree ? ' · same category' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button type="button" size="sm" variant="outline" onClick={onDismissDup}>
                    Back to warning
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={onViewExisting}>
                    View Existing Issue
                  </Button>
                  <Button type="button" size="sm" onClick={onDismissDup}>
                    Continue Anyway
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* Trust (§11 step 6) */}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Trust result</p>
          <Badge variant="outline" className="font-mono text-[10px]">DEMO SCORE</Badge>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <ShieldCheck
            className={cn('size-6', trust.label === 'NEEDS_REVIEW' ? 'text-warning' : 'text-success')}
            aria-hidden
          />
          <span className="text-lg font-bold">{trust.label.replace('_', ' ')}</span>
          <span className="ml-auto font-mono text-xl font-bold text-primary">{trust.score}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Trust score ${trust.score} percent`}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${trust.score}%` }} />
        </div>
        <ul className="mt-3 space-y-1.5">
          {trust.factors.map((f) => (
            <li key={f.label} className="flex items-start gap-2 text-xs">
              <span
                className={cn(
                  'mt-1 size-1.5 shrink-0 rounded-full',
                  f.impact === 'POSITIVE' ? 'bg-success' : f.impact === 'NEGATIVE' ? 'bg-destructive' : 'bg-muted-foreground',
                )}
                aria-hidden
              />
              <span>
                <span className="font-medium text-foreground">{f.label}</span> — {f.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Confirmation summary (§11 step 7) */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Ready to submit</p>
        <p className="mt-1 text-sm text-muted-foreground">
          On submit you get an issue ID, the duplicate cluster merges into one master issue, and
          explainable priority is calculated.
        </p>
      </div>
    </div>
  )
}

function ConfirmationCard({
  issue,
  priority,
  onNavigate,
}: {
  issue: Issue
  priority: PriorityScore
  onNavigate: (to: string) => void
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-success/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
            <CardTitle>Report submitted</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center rounded-xl border border-border/70 bg-muted/40 py-6 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Issue ID</p>
            <p className="mt-1 font-mono text-4xl font-black text-primary">{issue.id}</p>
            <p className="mt-2 text-sm text-muted-foreground">{issue.title}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Priority</dt>
              <dd className="font-bold text-destructive">{priority.level}</dd>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Score</dt>
              <dd className="font-mono font-bold">{priority.score}/100</dd>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Reports merged</dt>
              <dd className="font-bold">{issue.reportIds.length}</dd>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="font-bold">{issue.status.replaceAll('_', ' ')}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-border/70 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Why this priority?</p>
            <p className="mt-1 text-sm">{priority.explanation}</p>
            <ul className="mt-3 space-y-1">
              {priority.factors.map((f) => (
                <li key={f.label} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{f.label} — {f.detail}</span>
                  <span className="shrink-0 font-mono font-semibold text-foreground">+{f.points}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => onNavigate(`/issues/${issue.id}`)}>
              View issue <ArrowRight className="ml-2 size-4" aria-hidden />
            </Button>
            <Button variant="outline" onClick={() => onNavigate('/track')}>
              Track status
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('/citizen/issues')}>
              My issues
            </Button>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden /> {issue.address}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export { AlertTriangle }
