/**
 * AppShell — sidebar (desktop) / sheet (mobile) / topbar (§29).
 * Role-aware: navigation is derived from the session role, never shared.
 */

import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  CircleUserRound,
  LogOut,
  Menu,
  Moon,
  Route as RouteIcon,
  Sun,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_NAME } from '@/config/app'
import { navForRole } from '@/components/layout/nav'
import { useSession } from '@/stores/session'
import { useNotifications, useServiceMode } from '@/hooks/useService'
import { cn } from '@/lib/utils'

export function DemoModeBadge() {
  const mode = useServiceMode()
  const label = mode === 'API' ? 'LIVE API' : mode === 'FALLBACK' ? 'DEMO MODE · API OFFLINE' : 'DEMO MODE'
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 px-2 py-0.5 font-mono text-[10px] tracking-wider',
        mode === 'API'
          ? 'border-success/40 text-success'
          : 'border-warning/50 bg-warning/10 text-warning',
      )}
      title={
        mode === 'API'
          ? 'Connected to the Nagrivanta API'
          : 'Running on deterministic synthetic data — no external services required'
      }
    >
      <span className={cn('size-1.5 rounded-full', mode === 'API' ? 'bg-success' : 'bg-warning')} aria-hidden />
      {label}
    </Badge>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void; mobile?: boolean }) {
  const user = useSession((s) => s.user)
  const signedIn = useSession((s) => s.signedIn)
  const items = navForRole(user?.role, signedIn)
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink
          key={`${item.to}-${item.label}`}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-ring',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('size-4 shrink-0', isActive ? 'text-sidebar-primary' : 'opacity-70')} aria-hidden />
              <span className="truncate">{item.label}</span>
              {isActive ? <ChevronRight className="ml-auto size-3.5 opacity-60" aria-hidden /> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-ring">
      <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <RouteIcon className="size-4.5" aria-hidden />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-[0.18em] text-sidebar-foreground">{APP_NAME}</span>
        <span className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-sidebar-foreground/50">
          City Intelligence
        </span>
      </span>
    </Link>
  )
}

function NotificationCenter() {
  const { data } = useNotifications()
  const unread = (data ?? []).filter((n) => !n.read).length
  return (
    <Link
      to="/citizen/notifications"
      className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
    >
      <Bell className="size-4.5" aria-hidden />
      {unread > 0 ? (
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" aria-hidden />
      ) : null}
    </Link>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 text-muted-foreground"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setDark((d) => !d)}
    >
      {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
  )
}

function UserMenu() {
  const { user, signOut } = useSession()
  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/signin">Sign In</Link>
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {user.avatarLabel}
          </span>
          <span className="hidden max-w-[140px] truncate text-sm md:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate">{user.name}</span>
          <span className="block text-xs font-normal text-muted-foreground">{user.role.replaceAll('_', ' ')}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/citizen/notifications">
            <Bell className="mr-2 size-4" aria-hidden /> Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/signin">
            <CircleUserRound className="mr-2 size-4" aria-hidden /> Switch role
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 size-4" aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useSession((s) => s.user)
  const signedIn = useSession((s) => s.signedIn)
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const items = navForRole(user?.role, signedIn)

  // close the mobile sheet on navigation
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-svh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-3">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <p className="px-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
            Report → Verify → Group → Prioritize → Resolve → Prevent
          </p>
        </div>
      </aside>

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-3 top-3 z-40 size-9 bg-background/90 shadow-sm lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
          <SheetHeader className="h-14 justify-center border-b border-sidebar-border px-4 text-left">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Brand />
          </SheetHeader>
          <div className="p-3">
            <NavLinks onNavigate={() => setOpen(false)} mobile />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <span className="lg:hidden" aria-hidden />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold">
              {items.find((i) => location.pathname.startsWith(i.to) && i.to !== '/')?.label ?? APP_NAME}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DemoModeBadge />
            <ThemeToggle />
            <NotificationCenter />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
          <footer className="mt-12 border-t border-border/60 pt-6 pb-4 text-center text-xs text-muted-foreground">
            <X className="mx-auto mb-2 size-3.5 opacity-40" aria-hidden />
            Nagrivanta · synthetic demo data · predictions are simulated, not measured
          </footer>
        </main>
      </div>
    </div>
  )
}
