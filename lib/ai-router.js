import * as openaiClient from "./openai-client.js";

/**
 * Resilient AI routing — currently OpenAI-only.
 *
 * Gemini support has been temporarily removed to stabilise the platform.
 * The architecture is kept intact so Gemini can be re-enabled later.
 *
 * @param {object} messages - Prompt object with `system` and `user` fields.
 * @param {string} [model] - Optional OpenAI model name (e.g. "gpt-4.1"). Falls back to MODEL_CONFIG.chat when omitted.
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

  try {
    return await openaiClient.generateChatCompletion(messages, model);
  } catch (error) {
    console.error("OpenAI failed:", error);
    throw new Error("AI provider temporarily unavailable");
  }
}

/**
 * Stream AI tokens via an async generator.
 *
 * Same normalisation logic as runAI but yields tokens incrementally
 * instead of waiting for the full completion.
 *
 * @param {object} messages - Prompt (string, array, or {system,user}).
 * @param {string} [model] - Optional model name.
 * @returns {AsyncGenerator<string>}
 */
export async function* streamAI(messages, model) {
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

  yield* openaiClient.streamChatCompletion(messages, model);
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
