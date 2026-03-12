import { route } from "./ai-router.js";

/**
 * Supported intents for the orchestrator.
 */
export const INTENTS = [
  "chat",
  "knowledge_lookup",
  "media_generation",
  "workflow_execution",
  "goal_management",
  "research",
  "analysis",
];

/**
 * Detect the intent of a user message using AI classification.
 * Returns { intent, confidence }.
 */
export async function detectIntent(message) {
  if (!message) {
    return { intent: "chat", confidence: 1.0 };
  }

  const classificationPrompt = {
    system: `You are an intent classification system. Analyze the user message and determine the primary intent.

Respond with valid JSON only. No markdown, no explanation.

{
  "intent": "string",
  "confidence": number between 0 and 1
}

Supported intents:
- chat: General conversation, greetings, opinions, casual discussion.
- knowledge_lookup: User is asking for information retrieval, facts, or memory recall.
- media_generation: User wants to create an image, video, music, or voice content.
- workflow_execution: User wants to trigger a multi-step content production workflow.
- goal_management: User wants to set, update, review, or track goals.
- research: User wants in-depth research, comparison, or exploration of a topic.
- analysis: User wants data analysis, evaluation, or structured assessment.

Rules:
- Choose the single most likely intent.
- confidence reflects how certain you are that this is the correct intent.
- Default to "chat" if the intent is unclear.`,
    user: message,
  };

  try {
    const result = await route({
      task: "chat",
      prompt: classificationPrompt,
    });

    const parsed = JSON.parse(result);

    const intent = INTENTS.includes(parsed.intent) ? parsed.intent : "chat";
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5;

    return { intent, confidence };
  } catch (err) {
    console.error("Intent detection error:", err.message);
    return { intent: "chat", confidence: 0.5 };
  }
}
