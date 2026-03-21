/**
 * validation.js — Reusable validation utilities for backend services.
 *
 * Provides schema-like validation helpers that complement _security.js.
 * Focused on domain-specific rules for the Companion platform.
 */

import {
  isUUID,
  sanitize,
  sanitizeDeep,
  validatePayloadSize,
  validateAIPayload,
  safeParseJSON,
  MAX_PAYLOAD_BYTES,
  MAX_MESSAGE_LENGTH,
} from "./_security.js";

// Re-export all security utilities so consumers only need one import.
export {
  isUUID,
  sanitize,
  sanitizeDeep,
  validatePayloadSize,
  validateAIPayload,
  safeParseJSON,
  MAX_PAYLOAD_BYTES,
  MAX_MESSAGE_LENGTH,
};

// ── Domain helpers ───────────────────────────────────────────────────────────

const VALID_MEDIA_TYPES = new Set(["image", "video", "music", "voice"]);
const VALID_AI_MODES = new Set(["chat", "roleplay", "planning", "research"]);

/**
 * Validate that a value is one of the supported AI modes.
 *
 * @param {string} mode
 * @returns {boolean}
 */
export function isValidAIMode(mode) {
  return VALID_AI_MODES.has(mode);
}

/**
 * Validate that a value is a supported media type.
 *
 * @param {string} type
 * @returns {boolean}
 */
export function isValidMediaType(type) {
  return VALID_MEDIA_TYPES.has(type);
}

/**
 * Validate a pagination parameter.
 *
 * @param {*} value    - Raw value (string or number).
 * @param {number} max - Maximum allowed value.
 * @param {number} fallback - Default when value is falsy.
 * @returns {number}
 */
export function clampPage(value, max = 100, fallback = 1) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/**
 * Validate and clamp a limit/per-page parameter.
 *
 * @param {*} value
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export function clampLimit(value, max = 100, fallback = 50) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
}
