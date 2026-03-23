/**
 * env-guard.ts — Runtime safety checks for frontend environment variables.
 *
 * Import this module early (e.g. in main.tsx) to catch accidental exposure
 * of secret API keys in the browser bundle.  Vite only embeds VITE_*
 * variables by default, but a misconfigured `define` or `envPrefix` could
 * leak secrets.  This guard fails fast so the problem is caught immediately
 * in development rather than silently shipping credentials to production.
 */

/** Keys that must NEVER appear in frontend code (with or without VITE_ prefix). */
const FORBIDDEN_KEYS = [
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "NOFILTER_GPT_API_KEY",
  "PIAPI_API_KEY",
  "LEONARDO_API_KEY",
  "RUNWAY_API_KEY",
  "KLING_ACCESS_KEY",
  "KLING_SECRET_KEY",
  "HAILUO_API_KEY",
  "ELEVENLABS_API_KEY",
  "SUNO_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "GOOGLE_MAPS_API_KEY",
] as const;

/**
 * Matches values that look like OpenAI secret API keys (`sk-` followed by
 * 20+ alphanumeric characters).  Short `sk-` substrings in CSS class names
 * or unrelated tokens won't match.
 */
const OPENAI_KEY_PATTERN = /^sk-[A-Za-z0-9]{20,}/;
const SUPABASE_SECRET_KEY_PATTERN = /^sb_secret_[A-Za-z0-9]+/;

/**
 * Detect if a string is a JWT whose payload contains `"role":"service_role"`.
 * Returns false for non-JWT strings or JWTs with a different role.
 */
function looksLikeServiceRoleJwt(value: string): boolean {
  try {
    const parts = value.split(".");
    if (parts.length !== 3) return false;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const payload = JSON.parse(atob(base64));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

/**
 * Throws if any secret key is reachable from `import.meta.env`.
 *
 * Performs two layers of checks:
 * 1. **Name-based** — forbidden key names (bare and VITE_-prefixed).
 * 2. **Value-based** — scans every VITE_* value for patterns that look like
 *    actual secret keys (OpenAI `sk-` keys, Supabase service_role JWTs).
 *
 * Call once at app startup.
 */
export function assertNoSecrets(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = import.meta.env as Record<string, string | undefined>;

  // ── Layer 1: Name-based checks ──
  for (const key of FORBIDDEN_KEYS) {
    // Check bare key (e.g. SUPABASE_SERVICE_ROLE_KEY)
    if (env[key]) {
      throw new Error(
        `Forbidden use of secret API key: ${key} was found in the frontend bundle. ` +
          "Secret keys must only be used in server-side code (e.g. Netlify functions). " +
          "Remove it from your Vite config or env prefix."
      );
    }

    // Check VITE_-prefixed variant (e.g. VITE_SUPABASE_SERVICE_ROLE_KEY)
    const vitePrefixed = `VITE_${key}`;
    if (env[vitePrefixed]) {
      throw new Error(
        `Forbidden use of secret API key: ${vitePrefixed} was found in the frontend bundle. ` +
          "Secret keys must only be used in server-side code (e.g. Netlify functions). " +
          "Remove it from your Vite config or env prefix."
      );
    }
  }

  // ── Layer 2: Value-based checks ──
  // Scan every VITE_* env var for values that look like actual secret keys,
  // regardless of the variable name.
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("VITE_") || !value) continue;

    if (OPENAI_KEY_PATTERN.test(value)) {
      throw new Error(
        `Forbidden secret value in ${key}: value looks like an OpenAI API key (sk-…). ` +
          "Secret keys must only be used in server-side code (e.g. Netlify functions)."
      );
    }

    if (SUPABASE_SECRET_KEY_PATTERN.test(value)) {
      throw new Error(
        `Forbidden secret value in ${key}: value looks like a Supabase secret key (sb_secret_…). ` +
          "Use a publishable/anon key in frontend code and keep secret keys server-side only."
      );
    }

    if (looksLikeServiceRoleJwt(value)) {
      throw new Error(
        `Forbidden secret value in ${key}: value is a Supabase service_role JWT. ` +
          "The service_role key must only be used in server-side code (e.g. Netlify functions). " +
          "Use the anon (public) key for frontend code."
      );
    }
  }
}
