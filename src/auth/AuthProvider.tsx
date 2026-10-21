import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'

type AuthState = {
  configured: boolean
  loading: boolean
  session: Session | null
  isAdmin: boolean
  authError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setSession(null)
        setIsAdmin(false)
        setAuthError(error.message)
        setLoading(false)
        return
      }
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
        window.setTimeout(() => navigate('/reset-password', { replace: true }), 0)
      }
      if (!next) {
        setIsAdmin(false)
        setAuthError(null)
        setLoading(false)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [navigate])

  useEffect(() => {
    if (!supabase || !session) return
    let active = true
    setLoading(true)
    supabase
      .from('admin_accounts')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        setIsAdmin(!error && data?.user_id === session.user.id)
        setAuthError(error ? error.message : null)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  const value = useMemo<AuthState>(
    () => ({
      configured: supabaseConfigured,
      loading,
      session,
      isAdmin,
      authError,
      signOut: async () => {
        await supabase?.auth.signOut()
      },
    }),
    [authError, isAdmin, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
