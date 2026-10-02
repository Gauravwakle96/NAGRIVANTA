/** Reusable loading / empty / error states (§36). No blank screens. */

import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 rounded-xl border border-border/60 bg-card/60 py-14 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
  icon,
}: {
  title?: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-14 text-center">
      <div className="mb-3 text-muted-foreground/70" aria-hidden>
        {icon ?? <Inbox className="size-8" />}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'The request failed. You can retry — demo data is always available.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center"
      role="alert"
    >
      <AlertTriangle className="mb-3 size-8 text-destructive" aria-hidden />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="mr-2 size-4" aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function RetryButton({ onRetry, label = 'Retry' }: { onRetry: () => void; label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onRetry}>
      <RefreshCw className="mr-2 size-4" aria-hidden />
      {label}
    </Button>
  )
}

/** Card-shaped skeleton used while tables/dashboards hydrate. */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-5 w-1/3" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Wraps async query state into the three mandated states (§36).
 */
export function AsyncBoundary<T>({
  isLoading,
  isError,
  onRetry,
  loadingLabel,
  empty,
  isEmpty,
  children,
}: {
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
  loadingLabel?: string
  isEmpty?: boolean
  empty?: ReactNode
  children: ReactNode | ((data: T) => ReactNode)
}) {
  if (isLoading) return <LoadingState label={loadingLabel} />
  if (isError) return <ErrorState onRetry={onRetry} />
  if (isEmpty && empty) return <>{empty}</>
  return <>{typeof children === 'function' ? (children as (d: T) => ReactNode)(undefined as T) : children}</>
}
