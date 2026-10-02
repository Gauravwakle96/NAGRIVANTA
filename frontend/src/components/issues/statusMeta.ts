/** Badge styling for issue and work-order statuses. */

import type { IssueStatus, WorkOrderStatus } from '@/types/domain'

export const STATUS_META: Record<IssueStatus, { label: string; className: string }> = {
  REPORTED: { label: 'Reported', className: 'bg-muted text-muted-foreground' },
  UNDER_REVIEW: { label: 'Under review', className: 'bg-warning/15 text-warning' },
  TRIAGED: { label: 'Triaged', className: 'bg-primary/12 text-primary' },
  ASSIGNED: { label: 'Assigned', className: 'bg-primary/15 text-primary' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-chart-5/15 text-chart-5' },
  AWAITING_VERIFICATION: { label: 'Awaiting verification', className: 'bg-warning/15 text-warning' },
  RESOLVED: { label: 'Resolved', className: 'bg-success/15 text-success' },
  REINSPECTION_REQUIRED: { label: 'Reinspection required', className: 'bg-destructive/15 text-destructive' },
  CLOSED: { label: 'Closed', className: 'bg-success/15 text-success' },
  REJECTED: { label: 'Rejected', className: 'bg-destructive/15 text-destructive' },
}

export const WO_STATUS_META: Record<WorkOrderStatus, { label: string; className: string }> = {
  NEW: { label: 'New', className: 'bg-muted text-muted-foreground' },
  ASSIGNED: { label: 'Assigned', className: 'bg-primary/15 text-primary' },
  ACCEPTED: { label: 'Accepted', className: 'bg-primary/15 text-primary' },
  DISPATCHED: { label: 'Dispatched', className: 'bg-chart-5/15 text-chart-5' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-warning/15 text-warning' },
  REPAIR_SUBMITTED: { label: 'Repair submitted', className: 'bg-warning/15 text-warning' },
  VERIFICATION: { label: 'Verification', className: 'bg-primary/15 text-primary' },
  RESOLVED: { label: 'Resolved', className: 'bg-success/15 text-success' },
  REINSPECTION_REQUIRED: { label: 'Reinspection', className: 'bg-destructive/15 text-destructive' },
  CLOSED: { label: 'Closed', className: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
}
