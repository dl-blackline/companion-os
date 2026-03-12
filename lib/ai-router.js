import * as openaiClient from "./openai-client.js";
import * as geminiClient from "./gemini-client.js";

/**
 * Call the specified AI provider.
 */
async function runModel(provider, messages) {
  if (provider === "openai") {
    return await openaiClient.generateChatCompletion(messages);
  }
  if (provider === "gemini") {
    return await geminiClient.generateChatCompletion(messages);
  }
  throw new Error(`Unknown AI provider: ${provider}`);
}

/**
 * Resilient AI routing with automatic model fallback.
 *
 * Routes requests to the primary AI model (AI_PRIMARY_MODEL env var).
 * If the primary model fails, automatically retries using the fallback
 * model (AI_FALLBACK_MODEL env var).
 *
 * @param {object} messages - Prompt object with `system` and `user` fields.
 * @returns {Promise<string>} The AI-generated response text.
 */
export async function runAI(messages) {
  const primary = process.env.AI_PRIMARY_MODEL || "openai";
  const fallback = process.env.AI_FALLBACK_MODEL || "gemini";

  try {
    return await runModel(primary, messages);
  } catch (error) {
    console.warn(
      `Primary model (${primary}) failed, switching to fallback (${fallback}):`,
      error.message
    );

    if (fallback === primary) {
      throw error;
    }

    return await runModel(fallback, messages);
  }
}

/**
 * Task-based routing interface (backward-compatible).
 * Delegates to runAI for resilient primary/fallback routing.
 */
export async function route({ task, prompt }) {
  if (!task || !prompt) {
    throw new Error("Missing required parameters: task, prompt");
  }

  return runAI(prompt);
}
