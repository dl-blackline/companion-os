/**
 * search-memory.js — Netlify function
 *
 * POST /.netlify/functions/search-memory
 *
 * Actions:
 *   save    — Classify and persist a memory to episodic_memory or relationship_memory
 *   search  — Semantic search over episodic + relationship memories for a user
 *
 * Legacy (no action): accepts { content } and does a match_messages search for
 * backward compatibility with older callers.
 */

import { supabase } from "../../lib/_supabase.js";
import { orchestrateEmbed } from "../../services/ai/orchestrator.js";
import {
  storeEpisodicMemory,
  storeRelationshipMemory,
  searchEpisodicMemory,
  searchRelationshipMemory,
} from "../../lib/memory-manager.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

/* ─── Determine which memory table to use based on memory_type/category ───── */
function resolveMemoryTable(memory_type, category) {
  const relationshipTypes = new Set([
    "relationship", "instruction", "preference", "correction", "workflow", "context",
  ]);
  if (relationshipTypes.has(memory_type) || category === "identity" || category === "relationship") {
    return "relationship";
  }
  return "episodic";
}

/* ─── Map a raw DB episodic/relationship row to the frontend Memory shape ─── */
function rowToMemory(row, memoryType, category) {
  const text = row.event || row.memory || "";
  // Split "Title: content" if the text was stored that way, else use whole text
  const colonIdx = text.indexOf(": ");
  const title = colonIdx > 0 ? text.slice(0, colonIdx) : text.slice(0, 80);
  const content = colonIdx > 0 ? text.slice(colonIdx + 2) : text;

  return {
    id: row.id,
    title,
    content,
    category: category || (memoryType === "relationship" ? "identity" : "episodic"),
    confidence: typeof row.importance_score === "number" ? row.importance_score : 0.7,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.created_at).getTime(),
    source: "auto_captured",
    privacyLevel: "private",
    isPinned: false,
    tags: [],
    relatedMemories: [],
  };
}

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

  const { action } = body;

  try {
    /* ── save ─────────────────────────────────────────────────────────────── */
    if (action === "save") {
      const { user_id, title, content, category, memory_type, confidence } = body;

      if (!user_id) return fail("Missing required field: user_id", "ERR_VALIDATION", 400);
      if (!content) return fail("Missing required field: content", "ERR_VALIDATION", 400);

      const memoryTable = resolveMemoryTable(memory_type, category);
      const memoryText = title ? `${title}: ${content}` : content;
      const importanceScore = typeof confidence === "number" ? confidence : 0.7;

      if (memoryTable === "relationship") {
        await storeRelationshipMemory({
          user_id,
          memory: memoryText,
          importance_score: importanceScore,
        });
      } else {
        await storeEpisodicMemory({
          user_id,
          event: memoryText,
          importance_score: importanceScore,
        });
      }

      // Return a minimal Memory shape the frontend expects.
      // crypto.randomUUID() is available in Node 14.17+ and all modern runtimes.
      const savedMemory = {
        id: crypto.randomUUID(),
        title: title || content.slice(0, 80),
        content,
        category: category || (memoryTable === "relationship" ? "identity" : "episodic"),
        confidence: importanceScore,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: body.source || "user_explicit",
        privacyLevel: body.privacy_level || "private",
        isPinned: false,
        tags: Array.isArray(body.tags) ? body.tags : [],
        relatedMemories: [],
      };

      return ok({ memory: savedMemory });
    }

    /* ── search ───────────────────────────────────────────────────────────── */
    if (action === "search") {
      const { user_id, query, limit = 10 } = body;

      if (!user_id) return fail("Missing required field: user_id", "ERR_VALIDATION", 400);
      if (!query) return fail("Missing required field: query", "ERR_VALIDATION", 400);

      const embedding = await orchestrateEmbed(query);

      const [episodicRows, relationshipRows] = await Promise.all([
        searchEpisodicMemory(embedding, user_id).catch(() => []),
        searchRelationshipMemory(embedding, user_id).catch(() => []),
      ]);

      const results = [
        ...episodicRows.map((row) => ({
          memory: rowToMemory(row, "episodic", "episodic"),
          similarity: row.similarity ?? 0.5,
        })),
        ...relationshipRows.map((row) => ({
          memory: rowToMemory(row, "relationship", "identity"),
          similarity: row.similarity ?? 0.5,
        })),
      ]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return ok({ results });
    }

    /* ── legacy: no action — semantic search over messages ───────────────── */
    {
      const { content } = body;

      if (!content) {
        return fail("Missing required field: action or content", "ERR_VALIDATION", 400);
      }

      const embedding = await orchestrateEmbed(content);

      const { data, error: rpcError } = await supabase.rpc("match_messages", {
        query_embedding: embedding,
        match_count: 5,
      });

      if (rpcError) {
        return fail(rpcError.message, "ERR_DB", 500);
      }

      return ok({ results: data });
    }
  } catch (e) {
    log.error("[search-memory]", `action=${action || "legacy"} error:`, e.message);
    return fail(e.message || "Internal server error", "ERR_INTERNAL", 500);
  }
}
