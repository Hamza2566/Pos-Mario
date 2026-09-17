import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Business } from '@/types'

interface AuthState {
  profile: Profile | null
  business: Business | null
  isLoading: boolean
  setProfile: (profile: Profile | null) => void
  setBusiness: (business: Business | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      profile: null,
      business: null,
      isLoading: true,
      setProfile: (profile) => set({ profile }),
      setBusiness: (business) => set({ business }),
      setLoading: (isLoading) => set({ isLoading }),
      clear: () => set({ profile: null, business: null, isLoading: false }),
    }),
    {
      name: 'pos-mario-auth-store',
      // Only persist profile and business, not loading state
      partialize: (state) => ({
        profile: state.profile,
        business: state.business,
      }),
    }
  )
)
