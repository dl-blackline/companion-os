/**
 * gateway/auth.js — Authentication extraction and identity resolution.
 *
 * Centralizes JWT decoding, Supabase token verification, and caller
 * identity resolution so no domain handler needs to touch auth directly.
 */

import { supabase } from "../../../lib/_supabase.js";
import { log } from "../../../lib/_log.js";

/**
 * Decode a JWT payload without verifying the signature.
 * Used as a fallback when Supabase client is unavailable.
 */
export function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Extract and verify the authenticated user from a Netlify event.
 *
 * Prefers Supabase token verification when available, falls back to
 * raw JWT payload decoding for environments without a Supabase client.
 *
 * @param {object} event  Netlify function event
 * @returns {Promise<{id: string, email?: string} | null>}
 */
export async function authenticate(event) {
  const authHeader =
    event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  if (!supabase) {
    const claims = decodeJwtPayload(token);
    return claims?.sub ? { id: claims.sub } : null;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    return user || null;
  } catch (err) {
    log.warn("[auth]", "token verification failed:", err.message);
    return null;
  }
}
