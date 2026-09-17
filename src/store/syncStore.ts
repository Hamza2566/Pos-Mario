import { create } from 'zustand'

export type ConnectionStatus = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_ERROR'

interface SyncState {
  status: ConnectionStatus
  pendingCount: number
  failedCount: number
  lastSyncAt: string | null
  setStatus: (status: ConnectionStatus) => void
  setPendingCount: (count: number) => void
  setFailedCount: (count: number) => void
  setLastSyncAt: (at: string) => void
}

export const useSyncStore = create<SyncState>()((set) => ({
  status: navigator.onLine ? 'ONLINE' : 'OFFLINE',
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: null,
  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setFailedCount: (failedCount) => set({ failedCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}))
