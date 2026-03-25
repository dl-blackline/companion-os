import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SignupProps {
  onNavigateToLogin: () => void
}

export default function Signup({ onNavigateToLogin }: SignupProps) {
  const { signup } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
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

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      setLoading(false)
      return
    }

    const { error } = await signup(email, password)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="auth-shell">
        <div className="auth-panel">
          <div className="auth-brand">
            <p className="executive-eyebrow mb-0">Account Provisioning</p>
            <div className="auth-mark">
              <span className="text-2xl">✓</span>
            </div>
          </div>
          <Card className="auth-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl tracking-tight">Check your email</CardTitle>
              <CardDescription>
                We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Please check your inbox to verify your account.
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
    <div className="auth-shell">
      <div className="auth-panel">
        {/* Branding */}
        <div className="auth-brand">
          <p className="executive-eyebrow mb-0">Identity Enrollment</p>
          <div className="auth-mark">
            <span className="text-2xl font-bold text-primary">C</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Companion OS</h1>
          <p className="text-sm text-muted-foreground">Create your secured executive workspace</p>
        </div>

        <Card className="auth-card">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl tracking-tight">Create account</CardTitle>
            <CardDescription>Sign up to start using Companion OS</CardDescription>
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
                  aria-describedby={error ? "signup-error" : undefined}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
              </div>

              {/* Error state */}
              {error && (
                <div
                  id="signup-error"
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full mt-1">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating account…
                  </span>
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
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

        <p className="text-center text-xs text-muted-foreground/70">
          Secured by Supabase Auth · End-to-end encrypted
        </p>
      </div>
    </div>
  )
}
