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
 * When a specific `model` is requested (e.g. "openai" or "gemini") that
 * model is tried first. If it fails the other configured model is used as
 * a fallback.  When no model is specified the primary/fallback env vars
 * are used (AI_PRIMARY_MODEL / AI_FALLBACK_MODEL).
 *
 * @param {object} messages - Prompt object with `system` and `user` fields.
 * @param {string} [model] - Optional model id ("openai" | "gemini").
 * @returns {Promise<string>} The AI-generated response text.
 */
export async function runAI(messages, model) {
  // Normalize: ensure messages is in the { system, user } format expected by
  // the AI clients.  Accepts a plain string, an OpenAI-style messages array,
  // or the native { system, user } object.
  if (typeof messages === "string") {
    messages = { system: "", user: messages };
  } else if (Array.isArray(messages)) {
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsgs = messages.filter((m) => m.role !== "system");
    messages = {
      system: systemMsg ? systemMsg.content : "",
      user: userMsgs.map((m) => m.content).join("\n"),
    };
  }

  const primary = model || process.env.AI_PRIMARY_MODEL || "openai";

  let fallback;
  if (primary === "openai") {
    fallback = "gemini";
  } else if (primary === "gemini") {
    fallback = "openai";
  } else {
    fallback = process.env.AI_FALLBACK_MODEL || "gemini";
  }

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
 *
 * @param {object} params
 * @param {string} params.task - Task type (e.g. "chat").
 * @param {object} params.prompt - Prompt with `system` and `user` fields.
 * @param {string} [params.model] - Optional model id to route to.
 */
export async function route({ task, prompt, model }) {
  if (!task || !prompt) {
    throw new Error("Missing required parameters: task, prompt");
  }

  return runAI(prompt, model);
}
