import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { supabaseKeyError } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ForgotPasswordProps {
  onNavigateToLogin: () => void
}

export default function ForgotPassword({ onNavigateToLogin }: ForgotPasswordProps) {
  const { resetPassword, configured } = useAuth()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(
    supabaseKeyError ?? (configured ? null : "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.")
  )
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!email.trim()) {
      setError("Please enter your email address.")
      setLoading(false)
      return
    }

    const { error } = await resetPassword(email)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <span className="text-2xl">✉</span>
            </div>
          </div>
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Check your email</CardTitle>
              <CardDescription>
                We sent a password reset link to <strong className="text-foreground">{email}</strong>. Please check your inbox and follow the instructions to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={onNavigateToLogin} className="w-full">
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <span className="text-2xl font-bold text-primary">C</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Companion OS</h1>
          <p className="text-sm text-muted-foreground">Reset your password</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Forgot password?</CardTitle>
            <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
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
                  disabled={loading}
                  required
                  aria-describedby={error ? "reset-error" : undefined}
                />
              </div>

              {/* Error state */}
              {error && (
                <div
                  id="reset-error"
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading || !configured} className="w-full mt-1">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Sending…
                  </span>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                >
                  Sign in
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
