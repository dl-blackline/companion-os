import {
  searchEpisodicMemory,
  searchRelationshipMemory,
  searchMemorySummaries,
  getUserProfile,
} from "./memory-manager.js";
import { buildKnowledgeGraphContext } from "./knowledge-graph.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { getPersonalityProfile, buildStyleInstructions } from "./personality-engine.js";
import { getRecentEmotionalSignals } from "./emotion-detector.js";
import { getRelationshipEvents, buildRelationshipContext } from "./relationship-manager.js";
import { getRelevantMediaContext } from "./media-memory-service.js";

/**
 * Build a unified context object by gathering data from all memory layers,
 * personality, and relationship systems in parallel.
 *
 * Enhanced to include media memory context and support memory obedience.
 *
 * @param {object} params
 * @param {number[]} params.embedding - Vector embedding for semantic search.
 * @param {string} params.user_id - User identifier.
 * @param {string} params.conversation_id - Current conversation identifier.
 * @param {string} [params.message] - Current user message text (for media context matching).
 * @param {Function} [params.getRecentConversation] - Optional callback that retrieves recent messages for a conversation.
 * @param {boolean} [params.unfiltered] - Whether unfiltered mode is active.
 * @param {string} [params.aiMood] - Optional AI mood/tone instructions.
 * @param {string} [params.customInstructions] - Optional user-defined custom instructions.
 * @returns {Promise<object>} Structured context object suitable for prompt construction.
 */
export async function buildContext({ embedding, user_id, conversation_id, message, getRecentConversation, unfiltered, aiMood, customInstructions }) {
  const [
    episodicMemories,
    relationshipMemories,
    memorySummaries,
    userProfile,
    knowledgeGraphContext,
    recentConversation,
    personalityProfile,
    recentEmotionalSignals,
    relationshipEvents,
    mediaMemoryContext,
  ] = await Promise.all([
    searchEpisodicMemory(embedding, user_id).catch((err) => {
      console.error("Context builder – episodic memory error:", err.message);
      return [];
    }),
    searchRelationshipMemory(embedding, user_id).catch((err) => {
      console.error("Context builder – relationship memory error:", err.message);
      return [];
    }),
    searchMemorySummaries(embedding, user_id).catch((err) => {
      console.error("Context builder – memory summaries error:", err.message);
      return [];
    }),
    getUserProfile(user_id).catch((err) => {
      console.error("Context builder – user profile error:", err.message);
      return null;
    }),
    buildKnowledgeGraphContext(user_id).catch((err) => {
      console.error("Context builder – knowledge graph error:", err.message);
      return "";
    }),
    typeof getRecentConversation === "function"
      ? getRecentConversation(conversation_id).catch((err) => {
          console.error("Context builder – recent conversation error:", err.message);
          return [];
        })
      : Promise.resolve([]),
    getPersonalityProfile(user_id).catch((err) => {
      console.error("Context builder – personality profile error:", err.message);
      return null;
    }),
    getRecentEmotionalSignals(user_id).catch((err) => {
      console.error("Context builder – emotional signals error:", err.message);
      return [];
    }),
    getRelationshipEvents(user_id).catch((err) => {
      console.error("Context builder – relationship events error:", err.message);
      return [];
    }),
    // Retrieve media memory context when a message is available
    message
      ? getRelevantMediaContext({ message, user_id, limit: 3 }).catch((err) => {
          console.error("Context builder – media memory error:", err.message);
          return "";
        })
      : Promise.resolve(""),
  ]);

  const personalityInstructions = buildStyleInstructions(
    personalityProfile,
    recentEmotionalSignals
  );
  const relationshipContext = buildRelationshipContext(relationshipEvents);

  return {
    episodicMemories,
    relationshipMemories,
    memorySummaries,
    userProfile,
    knowledgeGraphContext,
    recentConversation,
    personalityProfile,
    personalityInstructions,
    recentEmotionalSignals,
    relationshipContext,
    mediaMemoryContext,
    unfiltered: unfiltered || false,
    aiMood: aiMood || null,
    customInstructions: customInstructions || null,
  };
}

/**
 * Build a complete system prompt from a context object.
 *
 * Convenience wrapper that combines buildContext output with buildSystemPrompt.
 * Now passes through memory obedience fields (aiMood, customInstructions, unfiltered).
 */
export function buildSystemPromptFromContext(context) {
  return buildSystemPrompt({
    userProfile: context.userProfile,
    personalityInstructions: context.personalityInstructions,
    relationshipContext: context.relationshipContext,
    relationshipMemories: context.relationshipMemories,
    episodicMemories: context.episodicMemories,
    memorySummaries: context.memorySummaries,
    knowledgeGraphContext: context.knowledgeGraphContext,
    recentConversation: context.recentConversation,
    mediaMemoryContext: context.mediaMemoryContext,
    unfiltered: context.unfiltered,
    aiMood: context.aiMood,
    customInstructions: context.customInstructions,
  });
}
