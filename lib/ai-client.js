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

// ── Configuration ───────────────────────────────────────────────────────────

/** Maximum number of retry attempts for transient failures. */
const MAX_RETRIES = parseInt(process.env.AI_MAX_RETRIES || "2", 10);

/** Base delay (ms) for exponential back-off between retries. */
const RETRY_BASE_DELAY_MS = parseInt(process.env.AI_RETRY_BASE_DELAY_MS || "500", 10);

/** Default request timeout in milliseconds (0 = no timeout). */
const DEFAULT_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "30000", 10);

// ── Cost tracking ───────────────────────────────────────────────────────────

/**
 * @typedef {object} CostEvent
 * @property {string}  task       - Logical task label.
 * @property {string}  model      - Model id used.
 * @property {number}  durationMs - Wall-clock time of the call in ms.
 * @property {boolean} fromRetry  - Whether this result came from a retry.
 */

/** @type {Array<(event: CostEvent) => void>} */
const _costHooks = [];

/**
 * Register a hook that is called after every successful AI completion.
 * Useful for logging, billing, or analytics.
 *
 * @param {(event: CostEvent) => void} fn
 */
export function onCost(fn) {
  if (typeof fn === "function") _costHooks.push(fn);
}

/**
 * Remove a previously registered cost hook.
 *
 * @param {(event: CostEvent) => void} fn
 */
export function offCost(fn) {
  const idx = _costHooks.indexOf(fn);
  if (idx !== -1) _costHooks.splice(idx, 1);
}

/** Fire all registered cost hooks (best-effort, errors are logged but not thrown). */
function _emitCost(event) {
  for (const fn of _costHooks) {
    try { fn(event); } catch (err) { console.debug("Cost hook error:", err); }
  }
}

// ── Retry + timeout helpers ─────────────────────────────────────────────────

/**
 * Determine whether an error is transient and worth retrying.
 *
 * @param {Error} err
 * @returns {boolean}
 */
export function isRetryable(err) {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const status = err.status || err.statusCode;
  // Retry on rate-limit (429), server errors (5xx), and network issues.
  if (status === 429 || (status >= 500 && status < 600)) return true;
  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("network")) return true;
  return false;
}

/**
 * Run an async function with exponential-backoff retry and an optional timeout.
 *
 * @param {() => Promise<T>} fn         - The async operation.
 * @param {{ retries?: number, timeoutMs?: number, task?: string, model?: string }} opts
 * @returns {Promise<T>}
 * @template T
 */
async function withResiliency(fn, { retries = MAX_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS, task = "chat", model = "" } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const start = Date.now();
      const result = timeoutMs > 0
        ? await Promise.race([
            fn(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("AI request timed out")), timeoutMs)
            ),
          ])
        : await fn();
      _emitCost({ task, model: model || "default", durationMs: Date.now() - start, fromRetry: attempt > 0 });
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < retries && isRetryable(err)) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ── Chat completions ────────────────────────────────────────────────────────

/**
 * Generate a non-streaming chat completion.
 *
 * Includes automatic retry with exponential back-off for transient failures
 * and an optional per-request timeout.
 *
 * @param {object} params
 * @param {{ system: string, user: string }} params.prompt - System + user prompt.
 * @param {string}  [params.model]       - Model id (resolved via ai-router).
 * @param {string}  [params.task="chat"] - Logical task label for routing.
 * @param {number}  [params.timeoutMs]   - Per-request timeout override (ms).
 * @param {number}  [params.retries]     - Retry count override.
 * @returns {Promise<string>} The assistant response text.
 */
export async function chat({ prompt, model, task = "chat", timeoutMs, retries }) {
  return withResiliency(
    () => route({ task, prompt, model }),
    { retries, timeoutMs, task, model },
  );
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
      } catch { /* extracted JSON also invalid — will throw below */ }
    }
    throw new Error(`Failed to parse AI response as JSON: ${(raw || "").slice(0, 200)}`);
  }
}

// ── Re-exports for convenience ──────────────────────────────────────────────

export { runAI, streamAI, generateEmbedding };
