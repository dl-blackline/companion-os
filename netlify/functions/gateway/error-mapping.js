/**
 * gateway/error-mapping.js — Centralized error → API response mapping.
 *
 * Translates internal exceptions into client-safe API responses with
 * canonical status codes and error shapes.
 */

import { fail, raw, CORS_HEADERS } from "../../../lib/_responses.js";
import { log } from "../../../lib/_log.js";

/**
 * Map a caught error into a Netlify-compatible API response.
 *
 * Known coded errors (err.code / err.statusCode) are forwarded as-is.
 * Unknown errors produce a soft-fail 200 for backward compatibility so
 * the frontend can display a friendly fallback message.
 *
 * @param {Error} err
 * @returns {object} Netlify function response
 */
export function mapGatewayError(err) {
  // Coded domain / validation errors — respect their status
  if (err.code && err.statusCode) {
    log.warn("[gateway]", `coded error [${err.code}]:`, err.message);
    return fail(err.message, err.code, err.statusCode);
  }

  // JSON parse failures
  if (err instanceof SyntaxError && err.message.includes("JSON")) {
    log.warn("[gateway]", "bad JSON body:", err.message);
    return fail("Invalid JSON body", "ERR_VALIDATION", 400);
  }

  // Unexpected errors — soft-fail 200 for backward compat
  log.error("[ai-orchestrator]", "gateway error:", err.message);
  return raw(200, {
    response: "I'm having trouble connecting to the AI service right now.",
  });
}
