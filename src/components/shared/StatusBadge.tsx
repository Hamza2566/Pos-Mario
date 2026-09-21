import { cn } from '@/lib/utils'
import type { SyncStatus } from '@/types/local'

interface StatusBadgeProps {
  status: SyncStatus | 'PAID' | 'REFUNDED' | 'COMPLETED' | 'VOIDED' | string
  className?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Sync statuses
  PENDING:    { label: 'Pending',    className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
  SYNCING:    { label: 'Syncing',    className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  SYNCED:     { label: 'Synced',     className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  FAILED:     { label: 'Failed',     className: 'bg-red-500/15 text-red-600 border-red-500/30' },
  // Sale statuses
  DRAFT:      { label: 'Draft',      className: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  PAID:       { label: 'Paid',       className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  COMPLETED:  { label: 'Completed',  className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  REFUNDED:   { label: 'Refunded',   className: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  VOIDED:     { label: 'Voided',     className: 'bg-slate-500/15 text-slate-600 border-slate-500/30' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-slate-500/15 text-slate-600 border-slate-500/30' }
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      config.className,
      className,
    )}>
      {config.label}
    </span>
  )
}
