import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseClientKey = supabasePublishableKey || supabaseAnonKey

export const supabaseConfigured = Boolean(supabaseUrl && supabaseClientKey)

if (!supabaseConfigured) {
  console.warn(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and either VITE_SUPABASE_PUBLISHABLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY in your .env file."
  )
}

if (supabasePublishableKey && supabaseAnonKey && supabasePublishableKey !== supabaseAnonKey) {
  console.warn(
    "Both VITE_SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_ANON_KEY are set. Using VITE_SUPABASE_PUBLISHABLE_KEY."
  )
}

/**
 * Decode a base64url-encoded string (used in JWTs) to a UTF-8 string.
 * JWTs use base64url encoding which differs from standard base64:
 *   - '-' replaces '+'
 *   - '_' replaces '/'
 *   - padding ('=') is omitted
 */
function base64UrlDecode(str: string): string {
  // Convert base64url → standard base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  // Restore padding
  const pad = base64.length % 4
  if (pad) base64 += "=".repeat(4 - pad)
  return atob(base64)
}

/**
 * Detect if a key is a Supabase service role JWT by inspecting its payload.
 * Service role keys carry `"role":"service_role"` in the JWT claims.
 * This catches the case where someone accidentally sets VITE_SUPABASE_ANON_KEY
 * to a service role key value.
 */
export function isServiceRoleKey(key: string): boolean {
  try {
    const parts = key.split(".")
    if (parts.length !== 3) return false
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    return payload.role === "service_role"
  } catch {
    return false
  }
}

/**
 * Supabase secret keys are prefixed with `sb_secret_` and are server-only.
 * Service role JWTs are also server-only.
 */
export function isForbiddenBrowserSupabaseKey(key: string): boolean {
  return key.startsWith("sb_secret_") || isServiceRoleKey(key)
}

if (supabaseClientKey && isForbiddenBrowserSupabaseKey(supabaseClientKey)) {
  throw new Error(
    "Forbidden use of secret API key in browser: " +
      "VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY contains a server-only Supabase key. " +
      "Use a publishable/anon key for frontend code. " +
      "Secret/service_role keys must only be used in server-side code (e.g. Netlify functions)."
  )
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl, supabaseClientKey)
  : (null as unknown as SupabaseClient)
