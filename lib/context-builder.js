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

/**
 * Build a unified context object by gathering data from all memory layers,
 * personality, and relationship systems in parallel.
 *
 * @param {object} params
 * @param {number[]} params.embedding - Vector embedding for semantic search.
 * @param {string} params.user_id - User identifier.
 * @param {string} params.conversation_id - Current conversation identifier.
 * @param {Function} [params.getRecentConversation] - Optional callback that retrieves recent messages for a conversation.
 * @returns {Promise<object>} Structured context object suitable for prompt construction.
 */
export async function buildContext({ embedding, user_id, conversation_id, getRecentConversation }) {
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
  };
}

/**
 * Build a complete system prompt from a context object.
 *
 * Convenience wrapper that combines buildContext output with buildSystemPrompt.
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
  });
}
