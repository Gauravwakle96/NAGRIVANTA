/** In-app notification center (§22 Phase 1). */

import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useMarkNotificationRead, useNotifications } from '@/hooks/useService'
import { BASE_PATH } from '@/config/app'
import { useSession } from '@/stores/session'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function Notifications() {
  const user = useSession((s) => s.user)
  const q = useNotifications()
  const markRead = useMarkNotificationRead()

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see notifications"
        description="Notifications are delivered per role — choose a role to continue."
        action={<Button asChild><a href={`${BASE_PATH}/signin`}>Sign In</a></Button>}
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Notifications</p>
          <h1 className="text-2xl font-bold">Notification center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            In-app channel only in Phase 1. Email / SMS / WhatsApp are provider interfaces, not integrated.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            for (const n of q.data ?? []) if (!n.read) void markRead.mutate(n.id)
          }}
        >
          <CheckCheck className="mr-2 size-4" aria-hidden /> Mark all read
        </Button>
      </div>

      {q.isLoading ? (
        <LoadingState label="Loading notifications…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Bell className="size-8" />}
          title="No notifications"
          description="Assignment, dispatch and resolution updates will land here."
        />
      ) : (
        <Card className="border-border/70">
          <CardContent className="divide-y divide-border/60 p-0">
            {(q.data ?? []).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void markRead.mutate(n.id)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50',
                  'focus-visible:outline-2 focus-visible:outline-ring',
                )}
              >
                <span
                  className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-border' : 'bg-primary')}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-sm', n.read ? 'text-foreground/80' : 'font-semibold')}>{n.title}</span>
                    {!n.read ? <Badge className="px-1.5 py-0 text-[9px]">NEW</Badge> : null}
                    {n.issueId ? (
                      <span className="font-mono text-[10px] text-primary">{n.issueId}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
                </span>
                <time className="shrink-0 font-mono text-[10px] text-muted-foreground" dateTime={n.createdAt}>
                  {timeAgo(n.createdAt)}
                </time>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="mt-6 rounded-lg border border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
        Provider boundary: <span className="font-mono">NotificationProvider</span> →
        DemoNotificationProvider (in-app) · FutureEmailProvider · FutureSMSProvider · FutureWhatsAppProvider
      </p>
    </div>
  )
}
