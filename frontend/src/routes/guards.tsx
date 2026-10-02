/** Route guards — role checks before render (§23, §32). */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { canAccess, useSession } from '@/stores/session'
import { Button } from '@/components/ui/button'

export function RequireRole({ section, children }: { section: string; children: ReactNode }) {
  const user = useSession((s) => s.user)
  const signedIn = useSession((s) => s.signedIn)

  if (!signedIn || !user) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center">
        <ShieldAlert className="mb-3 size-8 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">Sign in required</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          This area is role-restricted. Choose a role to continue — demo sign-in issues a local session only.
        </p>
        <Button asChild className="mt-5">
          <Link to="/signin">Sign In</Link>
        </Button>
      </div>
    )
  }

  if (!canAccess(section, user.role)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-20 text-center">
        <ShieldAlert className="mb-3 size-8 text-destructive" aria-hidden />
        <h2 className="text-lg font-semibold">Not authorized</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Your role ({user.role.replaceAll('_', ' ')}) does not have access to this section.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
