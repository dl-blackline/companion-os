import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
 * Non-null when VITE_SUPABASE_ANON_KEY was rejected because it contains a
 * service_role JWT.  Exported so the Login page can display a specific error
 * instead of crashing the entire app.
 */
export const supabaseKeyError: string | null =
  supabaseAnonKey && isServiceRoleKey(supabaseAnonKey)
    ? "Forbidden use of secret API key in browser: " +
      "VITE_SUPABASE_ANON_KEY contains a service_role key. " +
      "Use the anon (public) key for frontend code. " +
      "The service_role key must only be used in server-side code (e.g. Netlify functions)."
    : null

if (supabaseKeyError) {
  console.error(`[supabase-client] ${supabaseKeyError}`)
}

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey) && !supabaseKeyError

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
  )
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient)
