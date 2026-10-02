import { ReportWizard } from '@/components/workflow/ReportWizard'
import { DemoModeBadge } from '@/components/layout/AppShell'
import { APP_NAME } from '@/config/app'

export default function ReportIssue() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{APP_NAME} · Citizen</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Report a civic problem</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Photo, location, one line of description — the platform handles classification, trust,
            duplicates and priority.
          </p>
        </div>
        <DemoModeBadge />
      </div>
      <ReportWizard />
    </div>
  )
}
