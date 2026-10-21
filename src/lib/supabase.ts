import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const supabaseConfigured = url.startsWith('https://') && anonKey.length > 20

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function db() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export function mediaUrl(path: string | null | undefined) {
  if (!path || path.includes('://') || path.startsWith('/') || path.includes('..')) return null
  if (!supabase) return null
  const { data } = supabase.storage.from('public-media').getPublicUrl(path)
  return data.publicUrl
}
