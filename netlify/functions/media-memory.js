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

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function ok(body) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function err(statusCode, message) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return err(405, "Method not allowed");
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const { action, user_id } = body;

  if (!action) return err(400, "Missing required field: action");
  if (!user_id) return err(400, "Missing required field: user_id");

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
          return err(400, "Missing required field: public_url or storage_path");
        }
        if (!media_type || !["image", "video"].includes(media_type)) {
          return err(400, "Invalid media_type; must be 'image' or 'video'");
        }
        if (!filename) return err(400, "Missing required field: filename");

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
        if (!candidate_id) return err(400, "Missing required field: candidate_id");

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
        if (!candidate_id) return err(400, "Missing required field: candidate_id");

        const result = await rejectCandidate({ candidate_id, user_id });
        return ok(result);
      }

      /* ── delete ──────────────────────────────────────────────────────────── */
      case "delete": {
        const { media_id } = body;
        if (!media_id) return err(400, "Missing required field: media_id");

        const result = await deleteMedia({ media_id, user_id });
        return ok(result);
      }

      /* ── search ──────────────────────────────────────────────────────────── */
      case "search": {
        const { query, limit = 5 } = body;
        if (!query) return err(400, "Missing required field: query");

        const results = await searchMediaMemories({ query, user_id, limit });
        return ok({ results });
      }

      default:
        return err(400, `Unknown action: ${action}`);
    }
  } catch (e) {
    console.error(`media-memory [${action}] error:`, e.message);
    return err(500, e.message || "Internal server error");
  }
}
