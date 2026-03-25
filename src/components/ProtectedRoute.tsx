import { Suspense, lazy, useEffect, useState, type ReactNode } from "react"
import { useAuth } from "@/context/auth-context"
import { supabaseConfigured } from "@/lib/supabase-client"

const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

type AuthPage = "login" | "signup" | "forgot-password" | "reset-password"

function isRecoveryNavigation() {
  const pathname = window.location.pathname;
  const hash = window.location.hash || "";
  const search = window.location.search || "";

  return (
    pathname === "/reset-password" ||
    hash.includes("type=recovery") ||
    search.includes("type=recovery")
  );
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, authState } = useAuth()
  const [authPage, setAuthPage] = useState<AuthPage>("login")

  // Skip auth gate when Supabase is not configured.
  // (If a service_role key is used, supabase-client.ts throws at import
  // time, so that case never reaches here.)
  useEffect(() => {
    if (isRecoveryNavigation()) {
      setAuthPage("reset-password")
    }
  }, [])

  if (!supabaseConfigured) {
    return <>{children}</>
  }

  if (loading || authState.status === 'initializing') {
    return <AuthLoadingShell message="Restoring session…" />
  }

  const authFallback = <AuthLoadingShell message="Loading authentication…" />;

  if (authPage === "reset-password") {
    return (
      <Suspense fallback={authFallback}>
        <ResetPassword
          onNavigateToLogin={() => {
            if (window.location.pathname === "/reset-password") {
              window.history.replaceState({}, "", "/")
            }
            setAuthPage("login")
          }}
        />
      </Suspense>
    )
  }

  if (!user) {
    if (authPage === "signup") {
      return (
        <Suspense fallback={authFallback}>
          <Signup onNavigateToLogin={() => setAuthPage("login")} />
        </Suspense>
      )
    }
    if (authPage === "forgot-password") {
      return (
        <Suspense fallback={authFallback}>
          <ForgotPassword onNavigateToLogin={() => setAuthPage("login")} />
        </Suspense>
      )
    }
    return (
      <Suspense fallback={authFallback}>
        <Login
          onNavigateToSignup={() => setAuthPage("signup")}
          onNavigateToForgotPassword={() => setAuthPage("forgot-password")}
        />
      </Suspense>
    )
  }

  return <>{children}</>
}

function AuthLoadingShell({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}
