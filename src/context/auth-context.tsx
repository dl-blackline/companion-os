import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { User, Session, AuthError } from "@supabase/supabase-js"
import { supabase, supabaseConfigured } from "@/lib/supabase-client"
import type { UserRole, EntitlementPlan } from "@/types"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  role: UserRole
  plan: EntitlementPlan
  isAdmin: boolean
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signup: (email: string, password: string) => Promise<{ error: AuthError | null }>
  logout: () => Promise<void>
  refreshRole: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [role, setRole] = useState<UserRole>('user')
  const [plan, setPlan] = useState<EntitlementPlan>('free')

  const isAdmin = role === 'admin'

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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchRoleAndPlan(session.user.id)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchRoleAndPlan(session.user.id)
      else { setRole('user'); setPlan('free') }
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
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
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, configured: supabaseConfigured, role, plan, isAdmin, login, signup, logout, refreshRole }}>
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
