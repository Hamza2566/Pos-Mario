/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Supabase browser client.
 *
 * SECURITY NOTE:
 * Only the public anon key is used here. The service role key must never
 * appear in any VITE_* environment variable or frontend code. All data
 * access is governed by Row Level Security policies on the database.
 */
export const supabase = createClient(
  supabaseUrl || 'https://unavailable.supabase.co',
  supabaseAnonKey || 'public-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'pos-mario-auth',
    },
  },
)
