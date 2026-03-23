import { useState, type ReactNode } from "react"
import { useAuth } from "@/context/auth-context"
import { supabaseConfigured, supabaseKeyError } from "@/lib/supabase-client"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"
import ForgotPassword from "@/pages/ForgotPassword"

type AuthPage = "login" | "signup" | "forgot-password"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, authState } = useAuth()
  const [authPage, setAuthPage] = useState<AuthPage>("login")

  // Skip auth gate when Supabase is not configured (but NOT when it was
  // blocked due to a service_role key — in that case show the login page
  // so the misconfiguration error is visible to the operator).
  if (!supabaseConfigured && !supabaseKeyError) {
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
    if (authPage === "forgot-password") {
      return <ForgotPassword onNavigateToLogin={() => setAuthPage("login")} />
    }
    return (
      <Login
        onNavigateToSignup={() => setAuthPage("signup")}
        onNavigateToForgotPassword={() => setAuthPage("forgot-password")}
      />
    )
  }

  return <>{children}</>
}
