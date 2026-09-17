import { useEffect, useState } from 'react'
import { useSyncStore } from '@/store/syncStore'

/**
 * Reactive online/offline status.
 * Returns the current connection status from the sync store.
 */
export function useOnlineStatus() {
  const status = useSyncStore((s) => s.status)
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const failedCount = useSyncStore((s) => s.failedCount)

  return {
    isOnline: status === 'ONLINE' || status === 'SYNCING',
    isSyncing: status === 'SYNCING',
    isOffline: status === 'OFFLINE',
    hasSyncError: status === 'SYNC_ERROR',
    status,
    pendingCount,
    failedCount,
  }
}

/**
 * Simple hook that returns raw navigator.onLine and listens for changes.
 * Use this for logic that needs raw connectivity status without sync state.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
