import { useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { syncProductsFromCloud, startSyncEngine } from '@/lib/syncEngine'
import type { Profile, Business } from '@/types'

/**
 * Central auth hook.
 * - Manages Supabase session lifecycle
 * - Loads profile + business on login
 * - Starts the sync engine after successful login
 */
export function useAuth() {
  const { profile, business, isLoading, setProfile, setBusiness, setLoading, clear } = useAuthStore()
  const navigate = useNavigate()
  const cleanupSync = useRef<(() => void) | null>(null)

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .eq('active', true)
        .single()

      if (profileError || !profileData) {
        console.error('Profile not found:', profileError?.message)
        await supabase.auth.signOut()
        clear()
        navigate('/login')
        return
      }

      const nextProfile = profileData as Profile

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', nextProfile.business_id)
        .single()

      if (businessError || !businessData) {
        console.error('Business not found:', businessError?.message)
        clear()
        navigate('/login')
        return
      }

      setProfile(nextProfile)
      setBusiness(businessData as Business)
      await syncProductsFromCloud(nextProfile.business_id)

      if (!cleanupSync.current) {
        cleanupSync.current = startSyncEngine(nextProfile.business_id)
      }
    } catch (err) {
      console.error('Failed to load user data:', err)
      clear()
    } finally {
      setLoading(false)
    }
  }, [setProfile, setBusiness, setLoading, clear, navigate])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        clear()
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          if (event === 'SIGNED_IN') {
            await loadUserData(session.user.id)
          }
        } else if (event === 'SIGNED_OUT') {
          clear()
          cleanupSync.current?.()
          cleanupSync.current = null
          setLoading(false)
          navigate('/login')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      cleanupSync.current?.()
      cleanupSync.current = null
    }
  }, [loadUserData, clear, setLoading, navigate])

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      return { error: error.message }
    }
    return { error: null }
  }, [setLoading])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    cleanupSync.current?.()
    cleanupSync.current = null
    clear()
    navigate('/login')
  }, [clear, navigate])

  return {
    profile,
    business,
    isLoading,
    isOwner: profile?.role === 'OWNER',
    isEmployee: profile?.role === 'EMPLOYEE',
    signIn,
    signOut,
  }
}
