/**
 * _security.js — Input validation and sanitization layer.
 *
 * Provides reusable guards for Netlify function endpoints:
 *
 *   - Payload size enforcement
 *   - String sanitization (strip control chars, trim)
 *   - UUID format validation
 *   - Common field presence checks
 *
 * Usage:
 *   import { validatePayloadSize, sanitize, isUUID, validateAIPayload } from "./_security.js";
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Default maximum request body size in bytes (256 KB). */
export const MAX_PAYLOAD_BYTES = 256 * 1024;

/** Maximum length for a single user message string. */
export const MAX_MESSAGE_LENGTH = 12_000;

/** UUID v4 regex. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Payload size ─────────────────────────────────────────────────────────────

/**
 * Check whether a raw body string exceeds the size limit.
 *
 * @param {string|null|undefined} raw  - The raw request body string.
 * @param {number} [limit]             - Max bytes (default: MAX_PAYLOAD_BYTES).
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePayloadSize(raw, limit = MAX_PAYLOAD_BYTES) {
  if (!raw) return { valid: true };
  const size = new TextEncoder().encode(raw).length;
  if (size > limit) {
    return {
      valid: false,
      error: `Payload too large (${size} bytes). Maximum allowed: ${limit} bytes.`,
    };
  }
  return { valid: true };
}

// ── String sanitization ──────────────────────────────────────────────────────

/**
 * Sanitize a string value:
 *   - Trim leading/trailing whitespace
 *   - Strip ASCII control characters (except newline, tab)
 *   - Collapse excessive whitespace runs
 *
 * Returns the original value unchanged if it is not a string.
 *
 * @param {*} value
 * @returns {*}
 */
export function sanitize(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars (keep \n \t \r)
    .trim();
}

/**
 * Recursively sanitize all string values in an object or array.
 *
 * @param {*} obj
 * @returns {*}
 */
export function sanitizeDeep(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeDeep);
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = sanitizeDeep(v);
    }
    return out;
  }
  return obj;
}

// ── UUID validation ──────────────────────────────────────────────────────────

/**
 * Check whether a value looks like a valid UUID v4.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isUUID(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

// ── AI endpoint validation ───────────────────────────────────────────────────

/**
 * Validate the common fields expected by AI endpoints.
 *
 * Returns `null` when the payload is valid, or an error string describing the
 * first problem found.
 *
 * @param {object} body               - Parsed request body.
 * @param {object} [opts]
 * @param {boolean} [opts.requireMessage=true]  - Whether `message` is required.
 * @param {boolean} [opts.requireUserId=true]   - Whether `user_id` is required.
 * @returns {string|null}  Error message or null if valid.
 */
export function validateAIPayload(body, opts = {}) {
  const { requireMessage = true, requireUserId = true } = opts;

  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object.";
  }

  if (requireUserId) {
    if (!body.user_id) return "Missing required field: user_id";
    if (!isUUID(body.user_id)) return "Invalid user_id format — expected UUID.";
  }

  if (requireMessage) {
    if (!body.message) return "Missing required field: message";
    if (typeof body.message !== "string") return "Field 'message' must be a string.";
    if (body.message.length > MAX_MESSAGE_LENGTH) {
      return `Message too long (${body.message.length} chars). Maximum: ${MAX_MESSAGE_LENGTH}.`;
    }
  }

  if (body.conversation_id && !isUUID(body.conversation_id)) {
    return "Invalid conversation_id format — expected UUID.";
  }

  return null;
}

// ── Safe JSON parse ──────────────────────────────────────────────────────────

/**
 * Safely parse a JSON body string.  Returns `{ data }` on success or
 * `{ error }` on failure.
 *
 * @param {string|null|undefined} raw
 * @returns {{ data?: object, error?: string }}
 */
export function safeParseJSON(raw) {
  try {
    return { data: JSON.parse(raw || "{}") };
  } catch {
    return { error: "Invalid JSON body." };
  }
}
