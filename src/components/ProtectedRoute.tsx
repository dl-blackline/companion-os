import { useState, type ReactNode } from "react"
import { useAuth } from "@/context/auth-context"
import { supabaseConfigured } from "@/lib/supabase-client"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"

type AuthPage = "login" | "signup"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [authPage, setAuthPage] = useState<AuthPage>("login")

  // Skip auth gate when Supabase is not configured
  if (!supabaseConfigured) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
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
