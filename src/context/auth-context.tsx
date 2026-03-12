import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { User, Session, AuthError } from "@supabase/supabase-js"
import { supabase, supabaseConfigured } from "@/lib/supabase-client"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signup: (email: string, password: string) => Promise<{ error: AuthError | null }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabaseConfigured) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
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
    <AuthContext.Provider value={{ user, session, loading, configured: supabaseConfigured, login, signup, logout }}>
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
