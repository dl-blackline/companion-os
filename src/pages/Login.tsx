import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface LoginProps {
  onNavigateToSignup: () => void
  onNavigateToForgotPassword: () => void
}

export default function Login({ onNavigateToSignup, onNavigateToForgotPassword }: LoginProps) {
  const { login, configured, authState } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(
    configured
      ? null
      : "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) environment variables."
  )
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setSuccess(false)

    if (!email.trim()) {
      setError("Please enter your email address.")
      setLoading(false)
      return
    }

    if (!password) {
      setError("Please enter your password.")
      setLoading(false)
      return
    }

    const { error } = await login(email, password)
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Invalid email or password. Please try again."
          : error.message
      )
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  const isAuthenticating = loading || authState.status === 'authenticating'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <span className="text-2xl font-bold text-primary">C</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Companion OS</h1>
          <p className="text-sm text-muted-foreground">Your AI-powered personal operating system</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={isAuthenticating}
                  required
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={onNavigateToForgotPassword}
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isAuthenticating}
                  required
                />
              </div>

              {/* Error state */}
              {error && (
                <div
                  id="login-error"
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              {/* Success state */}
              {success && !error && (
                <div
                  role="status"
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
                >
                  Signed in successfully. Loading your workspace…
                </div>
              )}

              <Button type="submit" disabled={isAuthenticating || !configured} className="w-full mt-1">
                {isAuthenticating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={onNavigateToSignup}
                  className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                >
                  Create account
                </button>
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60">
          Secured by Supabase Auth · End-to-end encrypted
        </p>
      </div>
    </div>
  )
}
