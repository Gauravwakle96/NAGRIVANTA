/** Crew job detail (§19): details, map, instructions, before/after, submit. */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Navigation,
  PackageCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useEvidence, useSubmitRepair, useWorkOrder } from '@/hooks/useService'
import { useSession } from '@/stores/session'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { ImageUploader, type UploaderValue } from '@/components/workflow/ImageUploader'
import { WO_STATUS_META } from '@/components/issues/statusMeta'
import { PRIORITY_META } from '@/config/app'
import { formatDistance, haversineMeters, hoursUntil } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function CrewJob() {
  const { workOrderId } = useParams<{ workOrderId: string }>()
  const woQ = useWorkOrder(workOrderId)
  const user = useSession((s) => s.user)
  const submitRepair = useSubmitRepair()
  const navigate = useNavigate()

  const [before, setBefore] = useState<UploaderValue | null>(null)
  const [after, setAfter] = useState<UploaderValue | null>(null)
  const [imgError, setImgError] = useState<string | null>(null)
  const [repaired, setRepaired] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const existingEvIds = [woQ.data?.beforeEvidenceId, woQ.data?.afterEvidenceId].filter((x): x is string => Boolean(x))
  const evQ = useEvidence(existingEvIds)

  if (woQ.isLoading) return <LoadingState label="Loading job…" />
  if (woQ.isError) return <ErrorState onRetry={() => void woQ.refetch()} />
  if (!woQ.data) {
    return (
      <EmptyState
        title="Work order not found"
        description="It may have been cancelled or closed."
        action={<Button asChild variant="outline"><Link to="/crew">Back to jobs</Link></Button>}
      />
    )
  }

  const wo = woQ.data
  const meta = WO_STATUS_META[wo.status]
  const h = hoursUntil(wo.slaDueAt)
  const hasBefore = Boolean(wo.beforeEvidenceId) || Boolean(before?.dataUrl)
  const hasAfter = Boolean(wo.afterEvidenceId) || Boolean(after?.dataUrl)
  const canSubmit = hasBefore && hasAfter && repaired

  const existingBefore = (evQ.data ?? []).find((e) => e.id === wo.beforeEvidenceId)
  const existingAfter = (evQ.data ?? []).find((e) => e.id === wo.afterEvidenceId)

  const submit = async () => {
    if (!user) return
    setBusy(true)
    try {
      await submitRepair.mutateAsync({
        workOrderId: wo.id,
        submission: {
          beforeImage: before?.dataUrl ?? null,
          afterImage: after?.dataUrl ?? null,
          repairedFlag: repaired,
          note,
        },
        actor: user,
      })
      toast.success('Repair submitted for verification', { description: `${wo.issueId} is now awaiting inspector review.` })
      navigate('/crew')
    } catch {
      toast.error('Submission failed — please retry')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/crew"><ArrowLeft className="mr-1.5 size-4" /> Today's jobs</Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold capitalize">{wo.category.replace('_', ' ').toLowerCase()}</h1>
            <p className="text-sm text-muted-foreground">{wo.address}</p>
          </div>
          <Badge className={cn('text-[10px]', meta.className)}>{meta.label}</Badge>
        </div>
      </div>

      {/* Facts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border/70 p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Priority</p>
          <p className="text-sm font-bold">{PRIORITY_META[wo.priority].label}</p>
        </div>
        <div className="rounded-lg border border-border/70 p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Issue</p>
          <Link to={`/issues/${wo.issueId}`} className="font-mono text-sm font-bold text-primary underline-offset-2 hover:underline">
            {wo.issueId}
          </Link>
        </div>
        <div className="rounded-lg border border-border/70 p-3">
          <p className="text-[10px] uppercase text-muted-foreground">SLA</p>
          <p className={cn('font-mono text-sm font-bold', h < 0 ? 'text-destructive' : h < 24 ? 'text-warning' : 'text-success')}>
            {h < 0 ? `${Math.abs(Math.round(h))}h overdue` : `${Math.round(h)}h left`}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 p-3">
          <p className="text-[10px] uppercase text-muted-foreground">WO ID</p>
          <p className="font-mono text-sm font-bold">{wo.id}</p>
        </div>
      </div>

      {/* Location + navigate (no external provider dependency) */}
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-primary" aria-hidden /> Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{wo.address}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {wo.point.lat.toFixed(5)}, {wo.point.lng.toFixed(5)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
            >
              <a
                href={`geo:${wo.point.lat},${wo.point.lng}`}
                onClick={(e) => {
                  // desktop browsers have no geo handler — fall back to OSM
                  if (!navigator.userAgent.includes('Mobile')) {
                    e.preventDefault()
                    window.open(`https://www.openstreetmap.org/?mlat=${wo.point.lat}&mlon=${wo.point.lng}#map=18/${wo.point.lat}/${wo.point.lng}`, '_blank', 'noopener')
                  }
                }}
              >
                <Navigation className="mr-2 size-4" aria-hidden /> Navigate
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/city-map?focus=${wo.issueId}`}>View on map</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" aria-hidden /> Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-relaxed">{wo.instructions}</p>
          <p className="text-xs text-muted-foreground">Reported problem: {wo.description}</p>
        </CardContent>
      </Card>

      {/* Evidence workflow */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="size-4 text-primary" aria-hidden /> Repair evidence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold">1 · Upload BEFORE</p>
            {existingBefore ? (
              <div className="overflow-hidden rounded-lg border border-border/70">
                <img src={existingBefore.url} alt="Existing before evidence" className="aspect-[16/9] w-full object-cover" />
                <p className="px-2 py-1.5 text-[10px] text-muted-foreground">BEFORE already uploaded ✓</p>
              </div>
            ) : (
              <ImageUploader label="Before photo" value={before} onChange={setBefore} onError={setImgError} />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">2 · Mark repaired</p>
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors', repaired ? 'border-success/50 bg-success/5' : 'border-border/70')}>
              <input
                type="checkbox"
                checked={repaired}
                onChange={(e) => setRepaired(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-success)]"
              />
              <span>
                <span className="block text-sm font-medium">Repair is physically complete</span>
                <span className="block text-xs text-muted-foreground">Confirm only once the site is genuinely fixed.</span>
              </span>
            </label>
            <div>
              <Label htmlFor="repair-note">Repair note (optional)</Label>
              <Textarea
                id="repair-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Filled 2 layers of hot mix, compacted, cones placed."
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">3 · Upload AFTER</p>
            {existingAfter ? (
              <div className="overflow-hidden rounded-lg border border-border/70">
                <img src={existingAfter.url} alt="Existing after evidence" className="aspect-[16/9] w-full object-cover" />
                <p className="px-2 py-1.5 text-[10px] text-muted-foreground">AFTER already uploaded ✓</p>
              </div>
            ) : (
              <ImageUploader label="After photo" value={after} onChange={setAfter} onError={setImgError} />
            )}
          </div>

          {imgError ? <p className="text-sm text-destructive">{imgError}</p> : null}

          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Submit checklist</p>
            <ul className="space-y-1">
              <li className={cn(hasBefore ? 'text-success' : '')}>{hasBefore ? '✓' : '○'} BEFORE photo uploaded</li>
              <li className={cn(repaired ? 'text-success' : '')}>{repaired ? '✓' : '○'} Repair marked complete</li>
              <li className={cn(hasAfter ? 'text-success' : '')}>{hasAfter ? '✓' : '○'} AFTER photo uploaded</li>
            </ul>
          </div>

          <Button className="w-full" size="lg" disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? (
              <span className="animate-pulse">Submitting…</span>
            ) : (
              <>
                <CheckCircle2 className="mr-2 size-4" aria-hidden /> Submit for verification
              </>
            )}
          </Button>
          {!canSubmit ? (
            <p className="text-center text-xs text-muted-foreground">
              Complete all three steps to submit — verification needs before/after proof.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Distance from crew base: {formatDistance(haversineMeters(wo.point, wo.point))}
      </p>
    </div>
  )
}
