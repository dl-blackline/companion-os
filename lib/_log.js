/**
 * _log.js — Structured logging helpers for Netlify Functions and lib modules.
 *
 * All log output goes through console.* (which surfaces in the Netlify
 * Functions dashboard). The helpers add a consistent JSON-ish prefix so
 * logs can be filtered and searched in production.
 *
 * Usage:
 *   import { log } from "./_log.js";
 *   log.info("[chat]", "request received", { user_id });
 *   log.error("[chat]", "handler failed:", err.message);
 */

/**
 * Flatten mixed arguments into a single loggable string.
 * Objects are JSON-serialized; everything else is stringified.
 *
 * @param {unknown[]} args
 * @returns {string}
 */
function formatArgs(args) {
  return args
    .map((a) => {
      if (a === null || a === undefined) return String(a);
      if (typeof a === "object") {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    })
    .join(" ");
}

export const log = Object.freeze({
  /** Informational messages — request lifecycle, config resolution. */
  info(...args) {
    console.log(formatArgs(args));
  },

  /** Warnings — degraded service, fallback behavior. */
  warn(...args) {
    console.warn(formatArgs(args));
  },

  /** Errors — failed requests, missing config, exceptions. */
  error(...args) {
    console.error(formatArgs(args));
  },

  /** Debug — verbose tracing, only visible when log level is set. */
  debug(...args) {
    console.debug(formatArgs(args));
  },
});
