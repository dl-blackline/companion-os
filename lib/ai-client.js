import { generateChatCompletion, streamChatCompletion, generateEmbedding } from "./openai-client.js";
import { route, runAI, streamAI } from "./ai-router.js";

/**
 * Centralized AI client.
 *
 * Every module in the Companion Brain should call through this client instead
 * of importing openai-client or ai-router directly.  This single chokepoint
 * gives us one place to add logging, token budgeting, rate-limiting, or
 * provider-switching in the future.
 */

// ── Chat completions ────────────────────────────────────────────────────────

/**
 * Generate a non-streaming chat completion.
 *
 * @param {object} params
 * @param {{ system: string, user: string }} params.prompt - System + user prompt.
 * @param {string}  [params.model]       - Model id (resolved via ai-router).
 * @param {string}  [params.task="chat"] - Logical task label for routing.
 * @returns {Promise<string>} The assistant response text.
 */
export async function chat({ prompt, model, task = "chat" }) {
  return route({ task, prompt, model });
}

/**
 * Stream a chat completion, yielding tokens as they arrive.
 *
 * @param {object} params
 * @param {{ system: string, user: string }} params.prompt
 * @param {string} [params.model]
 * @returns {AsyncGenerator<string>}
 */
export async function* chatStream({ prompt, model }) {
  yield* streamAI(prompt, model);
}

// ── Embeddings ──────────────────────────────────────────────────────────────

/**
 * Generate a vector embedding for the given text.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  return generateEmbedding(text);
}

// ── Structured output helpers ───────────────────────────────────────────────

/**
 * Send a prompt and parse the response as JSON.
 *
 * Attempts to extract a JSON object from the response even when the model
 * wraps it in markdown fences or extra prose.
 *
 * @param {object} params
 * @param {{ system: string, user: string }} params.prompt
 * @param {string} [params.model]
 * @returns {Promise<object>}
 */
export async function chatJSON({ prompt, model }) {
  const raw = await chat({ prompt, model });
  try {
    return JSON.parse(raw);
  } catch {
    const match = (raw || "").match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch { /* fall through */ }
    }
    throw new Error(`Failed to parse AI response as JSON: ${(raw || "").slice(0, 200)}`);
  }
}

// ── Re-exports for convenience ──────────────────────────────────────────────

export { runAI, streamAI, generateEmbedding };
