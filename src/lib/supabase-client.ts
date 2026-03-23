import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  console.warn(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
  )
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
    const payload = JSON.parse(atob(parts[1]))
    return payload.role === "service_role"
  } catch {
    return false
  }
}

if (supabaseAnonKey && isServiceRoleKey(supabaseAnonKey)) {
  throw new Error(
    "Forbidden use of secret API key in browser: " +
      "VITE_SUPABASE_ANON_KEY contains a service_role key. " +
      "Use the anon (public) key for frontend code. " +
      "The service_role key must only be used in server-side code (e.g. Netlify functions)."
  )
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient)
