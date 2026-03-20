import { buildContext, buildSystemPromptFromContext } from "./context-builder.js";
import { buildCompanionContext, formatCompanionContext } from "./companion-engine.js";
import { embed } from "./ai-client.js";
import { getShortTerm } from "./memory-layer.js";

/**
 * Context Engine — single entry-point for assembling all context required
 * before an AI call.
 *
 * Responsibilities:
 *  1. Aggregate user profile, memory layers, active tasks/leads, recent interactions.
 *  2. Inject structured context into a system prompt.
 *  3. Return both the raw context object and the rendered system prompt.
 *
 * This wraps and extends the existing context-builder with:
 *  - Short-term session memory injection
 *  - Domain-specific context hints
 *  - A compact "context summary" for planner agents
 */

/**
 * Assemble the full context object for a user interaction.
 *
 * @param {object} params
 * @param {string}   params.user_id          - User identifier.
 * @param {string}   params.conversation_id  - Current conversation identifier.
 * @param {string}   params.message          - Current user message text.
 * @param {string}   [params.session_id]     - Current session id (for short-term memory).
 * @param {Function} [params.getRecentConversation] - Callback that retrieves recent messages.
 * @param {boolean}  [params.unfiltered]     - Whether unfiltered mode is active.
 * @param {string}   [params.aiMood]         - Optional AI mood/tone.
 * @param {string}   [params.customInstructions] - User-defined instructions.
 * @param {string}   [params.domain]         - Intent domain hint (e.g. "fitness").
 * @returns {Promise<object>} Full context object including systemPrompt.
 */
export async function assembleContext({
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
  // Generate embedding for the current message
  const embedding = await embed(message);

  // Retrieve hierarchical + companion context in parallel with short-term memory
  const [baseContext, shortTermMemory] = await Promise.all([
    buildContext({
      embedding,
      user_id,
      conversation_id,
      message,
      getRecentConversation,
      unfiltered,
      aiMood,
      customInstructions,
    }),
    session_id
      ? getShortTerm({ session_id }).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Merge short-term memory into context
  const context = {
    ...baseContext,
    embedding,
    shortTermMemory,
    domain: domain || null,
  };

  // Build the system prompt from the assembled context
  const systemPrompt = buildSystemPromptFromContext(context);

  return {
    ...context,
    systemPrompt,
  };
}

/**
 * Build a compact context summary string for planner / classification agents.
 *
 * @param {object} context - Full context object from assembleContext.
 * @returns {string}
 */
export function summarizeContext(context) {
  const parts = [];
  if (context.userProfile) {
    parts.push(`User: ${context.userProfile.name || "unknown"}`);
  }
  if (context.domain) {
    parts.push(`Domain: ${context.domain}`);
  }
  if (context.episodicMemories?.length) {
    parts.push(`${context.episodicMemories.length} episodic memories`);
  }
  if (context.relationshipMemories?.length) {
    parts.push(`${context.relationshipMemories.length} relationship memories`);
  }
  if (context.knowledgeGraphContext) {
    parts.push("KG available");
  }
  if (context.shortTermMemory?.length) {
    parts.push(`${context.shortTermMemory.length} short-term entries`);
  }
  if (context.companionContext) {
    parts.push("Companion engine active");
  }
  return parts.join(", ") || "No context available";
}

/**
 * Format a context block suitable for direct injection into a prompt template.
 *
 * @param {object} context
 * @returns {string}
 */
export function formatContextBlock(context) {
  const sections = [];

  if (context.userProfile) {
    const profile = context.userProfile;
    const parts = [];
    if (profile.name) parts.push(`Name: ${profile.name}`);
    if (profile.communication_style) parts.push(`Style: ${profile.communication_style}`);
    if (profile.goals?.length) parts.push(`Goals: ${JSON.stringify(profile.goals)}`);
    if (parts.length) sections.push(`USER PROFILE\n${parts.join("\n")}`);
  }

  if (context.companionContext) {
    sections.push(`COMPANION CONTEXT\n${context.companionContext}`);
  }

  if (context.episodicMemories?.length) {
    sections.push(
      `EPISODIC MEMORY\n${context.episodicMemories.map((e) => `- ${e.event}`).join("\n")}`
    );
  }

  if (context.shortTermMemory?.length) {
    sections.push(
      `RECENT SESSION\n${context.shortTermMemory.map((m) => `[${m.role}]: ${m.content}`).join("\n")}`
    );
  }

  if (context.knowledgeGraphContext) {
    sections.push(`KNOWLEDGE GRAPH\n${context.knowledgeGraphContext}`);
  }

  return sections.join("\n\n");
}
