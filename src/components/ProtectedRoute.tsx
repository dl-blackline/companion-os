import { useState, type ReactNode } from "react"
import { useAuth } from "@/context/auth-context"
import { supabaseConfigured } from "@/lib/supabase-client"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"

type AuthPage = "login" | "signup"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, authState } = useAuth()
  const [authPage, setAuthPage] = useState<AuthPage>("login")

  // Skip auth gate when Supabase is not configured
  if (!supabaseConfigured) {
    return <>{children}</>
  }

  if (loading || authState.status === 'initializing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Restoring session…</p>
      </div>
    )
  }

  if (!user) {
    if (authPage === "signup") {
      return <Signup onNavigateToLogin={() => setAuthPage("login")} />
    }
    return <Login onNavigateToSignup={() => setAuthPage("signup")} />
  }

  return <>{children}</>
}
