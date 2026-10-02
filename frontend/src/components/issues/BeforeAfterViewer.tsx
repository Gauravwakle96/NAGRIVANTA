/**
 * BeforeAfterViewer + VerificationPanel — §20.
 * Side-by-side evidence with explicit check results and both outcomes.
 */

import { useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/states'
import { cn } from '@/lib/utils'
import type { Evidence, Verification, VerificationResult } from '@/types/domain'
import { verifyRepair } from '@/services/engines'
import { timeAgo } from '@/lib/format'

function Pane({ ev, label }: { ev: Evidence | null | undefined; label: string }) {
  if (!ev) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-center">
        <XCircle className="mb-2 size-6 text-muted-foreground/60" aria-hidden />
        <p className="text-xs font-semibold text-muted-foreground">{label} missing</p>
        <p className="mt-0.5 px-3 text-[10px] text-muted-foreground/70">Crew must upload this photo</p>
      </div>
    )
  }
  return (
    <figure className="overflow-hidden rounded-lg border border-border/70 bg-muted">
      <img src={ev.url} alt={`${label} evidence`} className="aspect-[4/3] w-full object-cover" />
      <figcaption className="flex items-center justify-between px-2 py-1.5 text-[10px] text-muted-foreground">
        <span className="font-mono font-bold text-foreground">{label}</span>
        <span>{timeAgo(ev.uploadedAt)}</span>
      </figcaption>
    </figure>
  )
}

export function BeforeAfterViewer({ before, after }: { before: Evidence | null; after: Evidence | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Pane ev={before} label="BEFORE" />
      <Pane ev={after} label="AFTER" />
    </div>
  )
}

export interface VerifyInput {
  hasBefore: boolean
  hasAfter: boolean
  repairedFlag: boolean
  hoursSinceRepair: number
  citizenReopened: boolean
  beforePoint?: { lat: number; lng: number } | null
  afterPoint?: { lat: number; lng: number } | null
}

export function VerificationPanel({
  input,
  existing,
  onDecide,
  busy,
}: {
  input: VerifyInput
  existing?: Verification | null
  onDecide: (result: VerificationResult, notes: string) => void
  busy?: boolean
}) {
  const [notes, setNotes] = useState('')
  const engine = verifyRepair({
    hasBefore: input.hasBefore,
    hasAfter: input.hasAfter,
    beforePoint: input.beforePoint ?? null,
    afterPoint: input.afterPoint ?? null,
    repairedFlag: input.repairedFlag,
    hoursSinceRepair: input.hoursSinceRepair,
    citizenReopened: input.citizenReopened,
  })

  const passed = engine.checks.filter((c) => c.pass).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Verification checks</p>
        <Badge variant="outline" className={cn(passed === engine.checks.length ? 'text-success' : 'text-warning')}>
          {passed}/{engine.checks.length} passing
        </Badge>
      </div>

      <ul className="space-y-2">
        {engine.checks.map((c) => (
          <li
            key={c.key}
            className={cn(
              'flex items-start gap-2.5 rounded-lg border p-2.5 text-xs',
              c.pass ? 'border-success/30 bg-success/5' : 'border-warning/40 bg-warning/5',
            )}
          >
            {c.pass ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            )}
            <span>
              <span className="block font-semibold">{c.label}</span>
              <span className="text-muted-foreground">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {existing && existing.result ? (
        <div
          className={cn(
            'rounded-lg border p-3 text-sm',
            existing.result === 'RESOLVED' ? 'border-success/40 bg-success/10' : 'border-destructive/40 bg-destructive/5',
          )}
        >
          <p className="font-bold">{existing.result === 'RESOLVED' ? 'RESOLVED' : 'REINSPECTION REQUIRED'}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{existing.notes}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="verify-notes">Inspector notes</Label>
            <Textarea
              id="verify-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you observe?"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onDecide('RESOLVED', notes || 'Evidence accepted — defect corrected.')}
              disabled={busy || !input.hasBefore || !input.hasAfter}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-2 size-4" aria-hidden />}
              Accept — RESOLVED
            </Button>
            <Button
              variant="outline"
              onClick={() => onDecide('REINSPECTION_REQUIRED', notes || 'Defect persists — reinspect.')}
              disabled={busy}
            >
              <XCircle className="mr-2 size-4" aria-hidden /> Require reinspection
            </Button>
          </div>
          {!input.hasBefore || !input.hasAfter ? (
            <p className="text-xs text-warning">Both BEFORE and AFTER evidence are required to accept.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function EvidenceMissing({ what }: { what: string }) {
  return <EmptyState title={`${what} evidence missing`} description="The crew still needs to upload it." />
}
