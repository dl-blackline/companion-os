/**
 * contextEngine.js — Context aggregation service for all AI calls.
 *
 * Sits between endpoints and the AI layer, assembling a structured context
 * object from multiple sources:
 *
 *   1. Recent interactions (conversation history + session memory)
 *   2. User settings (preferences, constraints, personality)
 *   3. Relevant domain data (goals, knowledge graph, companion context)
 *
 * This module re-uses the existing lib/context-engine.js and lib/companion-engine.js
 * while adding a higher-level facade that any endpoint can call.
 */

import { assembleContext, summarizeContext, formatContextBlock } from "../../lib/context-engine.js";
import {
  buildCompanionContext,
  formatCompanionContext,
} from "../../lib/companion-engine.js";

// ── Schema / shape documentation ─────────────────────────────────────────────
//
// A ContextResult looks like:
//
// {
//   raw: {                         ← full context object from assembleContext()
//     userProfile, episodicMemories, relationshipMemories, memorySummaries,
//     knowledgeGraphContext, recentConversation, personalityInstructions,
//     shortTermMemory, companionContext, systemPrompt, ...
//   },
//   summary:    string,            ← one-liner context summary for planner agents
//   formatted:  string,            ← full multi-section text block for system prompt
//   companion: {                   ← companion engine context (goals, constraints, etc.)
//     context:   object,
//     formatted: string,
//   },
// }

/**
 * Build the full structured context for an AI call.
 *
 * @param {object}   params
 * @param {string}   params.user_id            - User identifier.
 * @param {string}   params.conversation_id    - Current conversation.
 * @param {string}   params.message            - Current user message.
 * @param {string}   [params.session_id]       - Session id for short-term memory.
 * @param {Function} [params.getRecentConversation] - Retrieves recent messages.
 * @param {boolean}  [params.unfiltered]       - Unfiltered-model flag.
 * @param {string}   [params.aiMood]           - Mood/tone hint.
 * @param {string}   [params.customInstructions] - User custom instructions.
 * @param {string}   [params.domain]           - Intent domain hint.
 * @returns {Promise<ContextResult>}
 */
export async function buildFullContext({
  user_id,
  conversation_id,
  message,
  session_id,
  getRecentConversation,
  unfiltered,
  aiMood,
  customInstructions,
  domain,
}) {
  // Run context assembly and companion context in parallel
  const [raw, companionCtx] = await Promise.all([
    assembleContext({
      user_id,
      conversation_id,
      message,
      session_id,
      getRecentConversation,
      unfiltered,
      aiMood,
      customInstructions,
      domain,
    }),
    safeCompanionContext(user_id),
  ]);

  return {
    raw,
    summary: summarizeContext(raw),
    formatted: formatContextBlock(raw),
    companion: companionCtx,
  };
}

/**
 * Safely build companion context, returning null on error so
 * it doesn't break the entire context pipeline.
 *
 * @param {string} user_id
 * @returns {Promise<{ context: object, formatted: string } | null>}
 */
async function safeCompanionContext(user_id) {
  try {
    const ctx = await buildCompanionContext(user_id);
    return { context: ctx, formatted: formatCompanionContext(ctx) };
  } catch (err) {
    console.error("Companion context error (non-fatal):", err.message);
    return null;
  }
}

// Re-export commonly used utilities so consumers don't need multiple imports.
export { summarizeContext, formatContextBlock };
