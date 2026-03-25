import * as openaiClient from "./openai-client.js";
import * as nofilterClient from "./nofilter-client.js";
import * as geminiClient from "./gemini-client.js";
import { getModel } from "./model-registry.js";

/**
 * Resolve which provider should handle the given chat model.
 *
 * Falls back to "openai" when the model id is not found in the registry
 * (e.g. when called with a raw OpenAI model name such as "gpt-4.1-mini").
 */
function resolveProvider(model) {
  if (typeof model === "string" && model.toLowerCase().startsWith("gemini")) {
    return "gemini";
  }
  if (!model) return "openai";
  const entry = getModel("chat", model);
  if (!entry) {
    console.debug(`[ai-router] model "${model}" not found in registry — defaulting to openai`);
    return "openai";
  }
  return entry.provider;
}

function hasGeminiFallback() {
  return Boolean(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
}

/**
 * Resilient AI routing — supports OpenAI and NoFilter GPT providers.
 *
 * @param {object} messages - Prompt object with `system` and `user` fields.
 * @param {string} [model] - Optional model name (e.g. "gpt-4.1", "nofilter-gpt").
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

  const provider = resolveProvider(model);

  try {
    if (provider === "nofilter") {
      return await nofilterClient.generateChatCompletion(messages, model);
    }
    if (provider === "gemini") {
      return await geminiClient.generateChatCompletion(messages, model);
    }
    return await openaiClient.generateChatCompletion(messages, model);
  } catch (error) {
    console.error(`${provider} AI failed:`, error);
    if (provider !== "gemini" && hasGeminiFallback()) {
      try {
        console.warn(`[ai-router] falling back from ${provider} to gemini`);
        return await geminiClient.generateChatCompletion(messages, model);
      } catch (geminiError) {
        console.error("gemini AI fallback failed:", geminiError);
      }
    }
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

  const provider = resolveProvider(model);

  try {
    if (provider === "nofilter") {
      yield* nofilterClient.streamChatCompletion(messages, model);
      return;
    }
    if (provider === "gemini") {
      yield await geminiClient.generateChatCompletion(messages, model);
      return;
    }
    yield* openaiClient.streamChatCompletion(messages, model);
  } catch (error) {
    console.error(`${provider} AI stream failed:`, error);
    if (provider !== "gemini" && hasGeminiFallback()) {
      console.warn(`[ai-router] falling back from ${provider} stream to gemini`);
      yield await geminiClient.generateChatCompletion(messages, model);
      return;
    }
    throw error;
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
