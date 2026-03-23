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
] as const;

/**
 * Throws if any secret key is reachable from `import.meta.env`.
 * Checks both bare names and VITE_-prefixed variants.
 * Call once at app startup.
 */
export function assertNoSecrets(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = import.meta.env as Record<string, string | undefined>;

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
}
