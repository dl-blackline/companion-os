/**
 * _supabase.js — Shared Supabase client for all backend code.
 *
 * Every Netlify function and lib module should import from here
 * instead of calling createClient() directly.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** true when both required env vars are present */
export const supabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
);

if (supabaseConfigured) {
  console.log("[supabase] Client initialized for", SUPABASE_URL);
} else {
  console.warn(
    "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — database features unavailable"
  );
}

/**
 * Shared Supabase client (service-role).
 * null when credentials are not configured.
 */
export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

/**
 * Return the Supabase client or throw if not configured.
 * Use in code paths where Supabase is required.
 */
export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }
  return supabase;
}
