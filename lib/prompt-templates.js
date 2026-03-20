/**
 * Centralized prompt template service.
 *
 * All AI prompts across the Companion Brain are defined here so they can be
 * composed, versioned, and tested in one place.
 *
 * Templates are simple functions that accept a context object and return a
 * `{ system, user }` prompt pair consumable by the AI client.
 */

// ── Intent detection ────────────────────────────────────────────────────────

const INTENT_LIST = [
  "chat",
  "roleplay",
  "planning",
  "research",
  "analysis",
  "knowledge_lookup",
  "media_generation",
  "workflow_execution",
  "goal_management",
  "web_search",
  "location",
];

/**
 * Build a prompt for intent classification.
 *
 * @param {{ message: string }} ctx
 * @returns {{ system: string, user: string }}
 */
export function intentClassification({ message }) {
  return {
    system: `You are an intent classification system. Analyze the user message and determine the primary intent.

Respond with valid JSON only. No markdown, no explanation.

{
  "intent": "string",
  "confidence": number between 0 and 1,
  "domain": "string or null"
}

Supported intents:
${INTENT_LIST.map((i) => `- ${i}`).join("\n")}

Rules:
- Choose the single most likely intent.
- confidence reflects how certain you are that this is the correct intent.
- domain is a short label for the subject area (e.g. "fitness", "finance", "personal") or null if unclear.
- Default to "chat" if the intent is unclear.`,
    user: message,
  };
}

// ── Planning ────────────────────────────────────────────────────────────────

/**
 * Build a prompt for the planner agent.
 *
 * @param {{ message: string, intent: object, toolDescriptions: string, contextSummary: string }} ctx
 * @returns {{ system: string, user: string }}
 */
export function plannerAgent({ message, intent, toolDescriptions, contextSummary }) {
  return {
    system: `You are a planning agent. Given a user message, detected intent, available tools, and context, produce a concise execution plan.

Respond with valid JSON only. No markdown, no explanation.

{
  "steps": [
    { "tool": "tool_name", "action": "brief description of what to do" }
  ]
}

Available tools:
${toolDescriptions}

Rules:
- Select only the tools necessary to fulfill the request.
- Order steps logically.
- If the intent is "chat" or "roleplay", you may return an empty steps array (the AI router handles it directly).
- Keep plans concise — typically 1-3 steps.`,
    user: `Intent: ${intent.intent} (confidence: ${intent.confidence})
User message: ${message}
Context summary: ${contextSummary}`,
  };
}

// ── Critic ───────────────────────────────────────────────────────────────────

/**
 * Build a prompt for the critic / quality-review agent.
 *
 * @param {{ message: string, response: string, intent: object }} ctx
 * @returns {{ system: string, user: string }}
 */
export function criticAgent({ message, response, intent }) {
  return {
    system: `You are a response quality critic. Review the assistant's response for accuracy, relevance, and helpfulness.

If the response is good, return it unchanged.
If it can be meaningfully improved, return the improved version.

Return ONLY the final response text. No meta-commentary, no labels, no explanation.`,
    user: `User message: ${message}
Intent: ${intent.intent}
Assistant response:
${response}`,
  };
}

// ── Memory classification ───────────────────────────────────────────────────

/**
 * Build a prompt for memory classification.
 *
 * @param {{ message: string, conversationHistory: string }} ctx
 * @returns {{ system: string, user: string }}
 */
export function memoryClassification({ message, conversationHistory }) {
  return {
    system: `You are an advanced memory classification system. Analyze the user message and conversation context to determine what types of memory should be stored.

Respond with valid JSON only. No markdown, no explanation.

{
  "episodic": { "store": boolean, "event": "string or null" },
  "relationship": { "store": boolean, "memory": "string or null" },
  "instruction": { "store": boolean, "content": "string or null" },
  "preference": { "store": boolean, "content": "string or null" },
  "summary": { "store": boolean },
  "importance_score": number between 0 and 1,
  "key_facts": ["string"],
  "is_behavioral_directive": boolean,
  "memory_type": "fact|instruction|preference|episodic|relationship|workflow|context|correction"
}

Rules:
- episodic.store = true when the message references major life events, important projects, new long-term goals, milestones, or significant changes.
- relationship.store = true when the message reveals user preferences, values, communication style, recurring patterns, or personal insights.
- instruction.store = true when the user gives an explicit directive about how the AI should behave, respond, format output, or handle tasks.
- preference.store = true when the user states a preference or like/dislike.
- summary.store = true when the conversation is long or contains important planning/analysis.
- key_facts is an array of the most important factual statements extracted from the message.
- importance_score reflects how significant this is for long-term user understanding.`,
    user: `Conversation context (last messages):
${conversationHistory || "No prior context."}

Current message:
${message}`,
  };
}

// ── Conversation summary ────────────────────────────────────────────────────

/**
 * Build a prompt for generating a conversation summary.
 *
 * @param {{ conversationHistory: string }} ctx
 * @returns {{ system: string, user: string }}
 */
export function conversationSummary({ conversationHistory }) {
  return {
    system: `You are a conversation summarizer. Create a concise but comprehensive summary of the conversation that captures key topics, decisions, insights, and any action items. Keep it under 500 words.`,
    user: conversationHistory,
  };
}

// ── Roleplay ────────────────────────────────────────────────────────────────

/**
 * Build a system prompt for a roleplay session.
 *
 * @param {{ character: string, scenario: string, contextBlock: string }} ctx
 * @returns {{ system: string, user: string }}
 */
export function roleplaySession({ character, scenario, contextBlock, message }) {
  return {
    system: `You are now role-playing as: ${character}

Scenario: ${scenario}

Stay in character at all times. Respond naturally as this character would.

${contextBlock}`,
    user: message,
  };
}

// ── Daily planning ──────────────────────────────────────────────────────────

/**
 * Build a prompt for generating a daily plan.
 *
 * @param {{ contextBlock: string, message: string }} ctx
 * @returns {{ system: string, user: string }}
 */
export function dailyPlan({ contextBlock, message }) {
  return {
    system: `You are a productivity and life planning assistant. Use the user's context to create a personalized, actionable daily plan. Consider their goals, constraints, recent activity, and preferences.

${contextBlock}`,
    user: message,
  };
}

// ── Research ────────────────────────────────────────────────────────────────

/**
 * Build a prompt for a research task.
 *
 * @param {{ contextBlock: string, message: string, toolContext: string }} ctx
 * @returns {{ system: string, user: string }}
 */
export function researchTask({ contextBlock, message, toolContext }) {
  const augmented = toolContext
    ? `${message}\n\n[Research data]:\n${toolContext}`
    : message;

  return {
    system: `You are a thorough research assistant. Analyze the user's question, synthesize available information, and provide a well-structured, sourced response.

${contextBlock}`,
    user: augmented,
  };
}

// ── Generic context-aware chat ──────────────────────────────────────────────

/**
 * Build the main chat prompt with full context injection.
 *
 * @param {{ systemPrompt: string, message: string, toolContext: string }} ctx
 * @returns {{ system: string, user: string }}
 */
export function contextAwareChat({ systemPrompt, message, toolContext }) {
  const augmented = toolContext
    ? `${message}\n\n[Tool context]:\n${toolContext}`
    : message;

  return {
    system: systemPrompt,
    user: augmented,
  };
}

// ── Template registry (for dynamic lookup) ──────────────────────────────────

export const templates = {
  intentClassification,
  plannerAgent,
  criticAgent,
  memoryClassification,
  conversationSummary,
  roleplaySession,
  dailyPlan,
  researchTask,
  contextAwareChat,
};

/**
 * Get a prompt template by name.
 *
 * @param {string} name - Template name (key in `templates`).
 * @returns {Function|undefined}
 */
export function getTemplate(name) {
  return templates[name];
}

/**
 * List all available template names.
 *
 * @returns {string[]}
 */
export function listTemplates() {
  return Object.keys(templates);
}
