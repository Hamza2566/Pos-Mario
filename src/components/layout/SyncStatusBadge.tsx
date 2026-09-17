import { useSyncStore } from '@/store/syncStore'
import { cn } from '@/lib/utils'
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function SyncStatusBadge() {
  const { status, pendingCount, failedCount, lastSyncAt } = useSyncStore()

  const config = {
    ONLINE: {
      icon: Wifi,
      label: 'Online',
      dot: 'bg-emerald-500',
      text: 'text-emerald-600',
      tooltip: lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Connected',
    },
    OFFLINE: {
      icon: WifiOff,
      label: `Offline${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`,
      dot: 'bg-red-500',
      text: 'text-red-600',
      tooltip: `No internet connection. ${pendingCount} sale${pendingCount !== 1 ? 's' : ''} will sync when reconnected.`,
    },
    SYNCING: {
      icon: Loader2,
      label: 'Syncing…',
      dot: 'bg-blue-500',
      text: 'text-blue-600',
      tooltip: `Uploading ${pendingCount} pending sale${pendingCount !== 1 ? 's' : ''}…`,
    },
    SYNC_ERROR: {
      icon: AlertTriangle,
      label: `Sync error · ${failedCount} failed`,
      dot: 'bg-amber-500',
      text: 'text-amber-600',
      tooltip: `${failedCount} sale${failedCount !== 1 ? 's' : ''} failed to sync. Will retry automatically.`,
    },
  }[status]

  const Icon = config.icon
  const isSpinning = status === 'SYNCING'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
            'bg-background/60 backdrop-blur-sm border border-border/50 cursor-default select-none',
            config.text,
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', config.dot, isSpinning && 'animate-pulse')} />
            <Icon className={cn('h-3.5 w-3.5', isSpinning && 'animate-spin')} />
            <span>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
