import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react"
import type { User, Session, AuthError } from "@supabase/supabase-js"
import { supabase, supabaseConfigured } from "@/lib/supabase-client"
import type { UserRole, EntitlementPlan, AuthState } from "@/types"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  role: UserRole
  plan: EntitlementPlan
  isAdmin: boolean
  authState: AuthState
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signup: (email: string, password: string) => Promise<{ error: AuthError | null }>
  logout: () => Promise<void>
  refreshRole: () => Promise<void>
  /** Returns the current access token, or null if not authenticated.  Uses
   *  the in-memory session cached by onAuthStateChange — avoids an extra
   *  async round-trip and the race-condition with getSession(). */
  getAccessToken: () => string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [role, setRole] = useState<UserRole>('user')
  const [plan, setPlan] = useState<EntitlementPlan>('free')
  const [authState, setAuthState] = useState<AuthState>(
    supabaseConfigured ? { status: 'initializing' } : { status: 'unauthenticated' }
  )

  const isAdmin = role === 'admin'

  // Keep a ref so getAccessToken() is always synchronous & current
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session

  const getAccessToken = useCallback((): string | null => {
    return sessionRef.current?.access_token ?? null
  }, [])

  const fetchRoleAndPlan = async (userId: string) => {
    if (!supabaseConfigured) return
    try {
      const [{ data: roleData }, { data: planData }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).single(),
        supabase.from('user_entitlements').select('plan').eq('user_id', userId).single(),
      ])
      if (roleData?.role) setRole(roleData.role as UserRole)
      if (planData?.plan) setPlan(planData.plan as EntitlementPlan)
    } catch {
      // Tables may not exist yet; default to 'user'/'free'
    }
  }

  const refreshRole = async () => {
    if (user) await fetchRoleAndPlan(user.id)
  }

  useEffect(() => {
    if (!supabaseConfigured) return

    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      setSession(restored)
      setUser(restored?.user ?? null)
      if (restored?.user) {
        setAuthState({ status: 'authenticated', userId: restored.user.id, email: restored.user.email ?? '' })
        fetchRoleAndPlan(restored.user.id)
      } else {
        setAuthState({ status: 'unauthenticated' })
      }
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, updated) => {
      setSession(updated)
      setUser(updated?.user ?? null)
      if (updated?.user) {
        setAuthState({ status: 'authenticated', userId: updated.user.id, email: updated.user.email ?? '' })
        fetchRoleAndPlan(updated.user.id)
      } else {
        setRole('user')
        setPlan('free')
        setAuthState({ status: 'unauthenticated' })
      }
      setLoading(false)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    if (!supabaseConfigured) {
      return { error: { message: "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." } as AuthError }
    }
    setAuthState({ status: 'authenticating' })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthState({ status: 'error', error: error.message })
    }
    // On success, onAuthStateChange will set the authenticated state
    return { error }
  }

  const signup = async (email: string, password: string) => {
    if (!supabaseConfigured) {
      return { error: { message: "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." } as AuthError }
    }
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  const logout = async () => {
    if (!supabaseConfigured) return
    await supabase.auth.signOut()
    // Clear state immediately (onAuthStateChange will also fire, but this
    // prevents any window where getAccessToken could return a stale token)
    setSession(null)
    setUser(null)
    setRole('user')
    setPlan('free')
    setAuthState({ status: 'unauthenticated' })
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, configured: supabaseConfigured, role, plan, isAdmin, authState, login, signup, logout, refreshRole, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
