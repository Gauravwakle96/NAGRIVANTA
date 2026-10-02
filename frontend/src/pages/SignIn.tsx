/** Demo sign-in — role picker issuing a local session (§23, §32). */

import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ROLES, APP_NAME } from '@/config/app'
import { homeForRole } from '@/components/layout/nav'
import { useSession } from '@/stores/session'
import { DemoModeBadge } from '@/components/layout/AppShell'
import type { Role } from '@/types/domain'

export default function SignIn() {
  const signIn = useSession((s) => s.signIn)
  const navigate = useNavigate()

  const handle = (role: Role) => {
    signIn(role)
    navigate(homeForRole(role))
  }

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-muted-foreground">{APP_NAME}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Choose a role</h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Demo sign-in issues a local session only — pick the role you want to experience. Each
              role sees different navigation and permissions.
            </p>
          </div>
          <DemoModeBadge />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <Card key={r.id} className="group cursor-pointer border-border/70 transition-all hover:border-primary/40 hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{r.label}</CardTitle>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
                </div>
                <CardDescription className="text-sm">{r.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Button className="w-full" variant="outline" onClick={() => handle(r.id)}>
                  Continue as {r.label}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <p>
            <span className="font-semibold text-foreground">Demo authentication.</span> No passwords
            are collected and no credentials leave this browser. Server-side role checks still apply
            when the Nagrivanta API is enabled.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px]">PHASE 1</Badge>
          <Button asChild variant="ghost" size="sm">
            <a href="/">Back to home</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
