/**
 * memoryService.js — Memory storage and retrieval service.
 *
 * Provides a unified facade for storing and retrieving:
 *
 *   - Interactions (user messages and AI responses)
 *   - Summaries (condensed conversation summaries)
 *   - Key user facts (preferences, instructions, important data)
 *
 * Wraps lib/memory-layer.js and lib/memory-manager.js.
 *
 * Schema:
 *
 * Interaction:
 *   { user_id, session_id, role, content, metadata?, embedding? }
 *
 * Summary:
 *   { user_id, content, period?, metadata? }
 *
 * UserFact:
 *   { user_id, fact_type, content, source?, metadata? }
 */

import {
  storeShortTerm,
  getShortTerm,
  ingest,
  searchAll,
  saveInteraction,
  getRecentContext,
  summarizeMemory,
} from "../../lib/memory-layer.js";

import {
  classifyMemory,
  storeEpisodicMemory,
  storeRelationshipMemory,
  storeMemorySummary,
  searchEpisodicMemory,
  searchRelationshipMemory,
  searchMemorySummaries,
  getUserProfile,
} from "../../lib/memory-manager.js";

import { embed } from "../../lib/ai-client.js";

// ── Interactions ─────────────────────────────────────────────────────────────

/**
 * Store a single interaction (user turn or assistant turn) in short-term
 * memory for the current session.
 *
 * @param {object} params
 * @param {string} params.user_id
 * @param {string} params.session_id
 * @param {string} params.role        - "user" | "assistant" | "system"
 * @param {string} params.content
 * @param {object} [params.metadata]
 * @returns {Promise<void>}
 */
export async function storeInteraction({ user_id, session_id, role, content, metadata }) {
  await storeShortTerm({ user_id, session_id, role, content, metadata });
}

/**
 * Retrieve recent short-term interactions for a session.
 *
 * @param {object} params
 * @param {string} params.user_id
 * @param {string} params.session_id
 * @param {number} [params.limit=20]
 * @returns {Promise<Array>}
 */
export async function getRecentInteractions({ user_id, session_id, limit = 20 }) {
  return getShortTerm({ user_id, session_id, limit });
}

// ── Long-term ingestion ──────────────────────────────────────────────────────

/**
 * Ingest an interaction into long-term memory. The memory layer classifies it
 * (episodic, relationship, summary, etc.) and stores accordingly.
 *
 * @param {object} params
 * @param {string} params.user_id
 * @param {string} params.content
 * @param {string} [params.role]
 * @param {object} [params.metadata]
 * @returns {Promise<void>}
 */
export async function ingestToLongTerm({ user_id, content, role, metadata }) {
  await ingest({ user_id, content, role, metadata });
}

// ── Summaries ────────────────────────────────────────────────────────────────

/**
 * Create or update a summary for recent interactions.
 *
 * @param {object} params
 * @param {string} params.user_id
 * @param {string} params.content      - The text to summarize.
 * @param {object} [params.metadata]
 * @returns {Promise<object|null>}
 */
export async function storeSummary({ user_id, content, metadata }) {
  const embedding = await embed(content);
  return storeMemorySummary({ user_id, content, embedding, metadata });
}

/**
 * Search stored summaries by semantic similarity.
 *
 * @param {object} params
 * @param {string} params.query
 * @param {string} params.user_id
 * @param {number} [params.limit=5]
 * @returns {Promise<Array>}
 */
export async function searchSummaries({ query, user_id, limit = 5 }) {
  const embedding = await embed(query);
  return searchMemorySummaries(embedding, user_id, limit);
}

// ── Key user facts ───────────────────────────────────────────────────────────

/**
 * Store an episodic memory (key user fact or event).
 *
 * @param {object} params
 * @param {string} params.user_id
 * @param {string} params.content
 * @param {object} [params.metadata]
 * @returns {Promise<object|null>}
 */
export async function storeUserFact({ user_id, content, metadata }) {
  const embedding = await embed(content);
  return storeEpisodicMemory({ user_id, content, embedding, metadata });
}

/**
 * Search episodic memories (key facts / events).
 *
 * @param {object} params
 * @param {string} params.query
 * @param {string} params.user_id
 * @param {number} [params.limit=5]
 * @returns {Promise<Array>}
 */
export async function searchUserFacts({ query, user_id, limit = 5 }) {
  const embedding = await embed(query);
  return searchEpisodicMemory(embedding, user_id, limit);
}

// ── Unified search ───────────────────────────────────────────────────────────

/**
 * Search across all memory types.
 *
 * @param {object} params
 * @param {string} params.query
 * @param {string} params.user_id
 * @param {number} [params.limit=10]
 * @returns {Promise<Array>}
 */
export async function searchMemories({ query, user_id, limit = 10 }) {
  return searchAll({ query, user_id, limit });
}

/**
 * Get the user profile from memory-manager.
 *
 * @param {string} user_id
 * @returns {Promise<object|null>}
 */
export async function getProfile(user_id) {
  return getUserProfile(user_id);
}

// ── Convenience re-exports ───────────────────────────────────────────────────

export {
  saveInteraction,
  getRecentContext,
  summarizeMemory,
  classifyMemory,
};
