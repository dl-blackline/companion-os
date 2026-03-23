/**
 * media-memory.js — Netlify function
 *
 * POST /.netlify/functions/media-memory
 *
 * Actions:
 *   analyze         — run the full pipeline on an already-uploaded media URL
 *   list            — list uploaded media for a user
 *   pending         — list pending memory candidates for a user
 *   approve         — approve a memory candidate
 *   reject          — reject a memory candidate
 *   delete          — soft-delete a media record
 *   search          — semantic search over media memories
 */

import {
  runFullMediaPipeline,
  listMediaForUser,
  getPendingCandidates,
  approveCandidate,
  rejectCandidate,
  deleteMedia,
  searchMediaMemories,
} from "../../lib/media-memory-service.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return fail("Invalid JSON body", "ERR_VALIDATION", 400);
  }

  const { action, user_id } = body;

  if (!action) return fail("Missing required field: action", "ERR_VALIDATION", 400);
  if (!user_id) return fail("Missing required field: user_id", "ERR_VALIDATION", 400);

  try {
    switch (action) {
      /* ── analyze ─────────────────────────────────────────────────────────── */
      case "analyze": {
        const {
          public_url,
          storage_path,
          filename,
          media_type,
          mime_type,
          file_size_bytes,
          user_title,
          user_note,
          model,
        } = body;

        if (!public_url && !storage_path) {
          return fail("Missing required field: public_url or storage_path", "ERR_VALIDATION", 400);
        }
        if (!media_type || !["image", "video"].includes(media_type)) {
          return fail("Invalid media_type; must be 'image' or 'video'", "ERR_VALIDATION", 400);
        }
        if (!filename) return fail("Missing required field: filename", "ERR_VALIDATION", 400);

        const result = await runFullMediaPipeline({
          user_id,
          storage_path: storage_path || public_url,
          public_url: public_url || storage_path,
          filename,
          media_type,
          mime_type,
          file_size_bytes,
          user_title,
          user_note,
          model,
        });

        return ok(result);
      }

      /* ── list ────────────────────────────────────────────────────────────── */
      case "list": {
        const { limit = 50, offset = 0, media_type } = body;
        const media = await listMediaForUser({ user_id, limit, offset, media_type });
        return ok({ media });
      }

      /* ── pending ─────────────────────────────────────────────────────────── */
      case "pending": {
        const candidates = await getPendingCandidates({ user_id });
        return ok({ candidates });
      }

      /* ── approve ─────────────────────────────────────────────────────────── */
      case "approve": {
        const { candidate_id, title_override, content_override } = body;
        if (!candidate_id) return fail("Missing required field: candidate_id", "ERR_VALIDATION", 400);

        const result = await approveCandidate({
          candidate_id,
          user_id,
          title_override,
          content_override,
        });
        return ok(result);
      }

      /* ── reject ──────────────────────────────────────────────────────────── */
      case "reject": {
        const { candidate_id } = body;
        if (!candidate_id) return fail("Missing required field: candidate_id", "ERR_VALIDATION", 400);

        const result = await rejectCandidate({ candidate_id, user_id });
        return ok(result);
      }

      /* ── delete ──────────────────────────────────────────────────────────── */
      case "delete": {
        const { media_id } = body;
        if (!media_id) return fail("Missing required field: media_id", "ERR_VALIDATION", 400);

        const result = await deleteMedia({ media_id, user_id });
        return ok(result);
      }

      /* ── search ──────────────────────────────────────────────────────────── */
      case "search": {
        const { query, limit = 5 } = body;
        if (!query) return fail("Missing required field: query", "ERR_VALIDATION", 400);

        const results = await searchMediaMemories({ query, user_id, limit });
        return ok({ results });
      }

      default:
        return fail(`Unknown action: ${action}`, "ERR_VALIDATION", 400);
    }
  } catch (e) {
    log.error("[media-memory]", `action=${action} error:`, e.message);
    return fail(e.message || "Internal server error", "ERR_INTERNAL", 500);
  }
}
