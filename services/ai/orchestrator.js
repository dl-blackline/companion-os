/**
 * orchestrator.js — Unified AI Orchestrator.
 *
 * Single entry point for ALL AI interactions in the application.
 * Every Netlify function that needs AI capabilities should call through
 * this orchestrator instead of importing ai-client or companion-brain directly.
 *
 * Responsibilities:
 *   1. Env validation — fail fast with clear messages before any AI call
 *   2. Prompt handling — standardize prompt shape for all providers
 *   3. Model selection — resolve model from request or defaults
 *   4. Context + memory injection — enrich prompts with recent interactions
 *   5. Structured logging — consistent request/response/error logging
 *   6. Error normalization — all failures map to { success: false, error, code }
 *   7. Streaming flags — mark responses as streaming-capable
 *
 * Usage from Netlify functions:
 *
 *   import { orchestrate, orchestrateStream } from "../../services/ai/orchestrator.js";
 *
 *   const result = await orchestrate({
 *     task: "chat",
 *     message: "Hello",
 *     user_id: "...",
 *     conversation_id: "...",
 *     model: "gpt-4.1",
 *   });
 */

import { chat, chatStream, chatJSON, embed } from "../../lib/ai-client.js";
import { think } from "../../lib/companion-brain.js";
import { MODEL_CONFIG } from "../../lib/model-config.js";
import { log } from "../../lib/_log.js";
import { buildFullContext } from "../context/contextEngine.js";
import {
  storeInteraction,
  getRecentInteractions,
} from "../memory/memoryService.js";

// ── Context + Memory injection ──────────────────────────────────────────────

/**
 * Enrich a prompt with recent context and memory for a given user.
 *
 * Called internally by orchestrateStream() and orchestrateSimple() so that
 * even lightweight operations benefit from conversational history.
 *
 * @param {{ system: string, user: string }} prompt
 * @param {object}  opts
 * @param {string}  [opts.user_id]
 * @param {string}  [opts.conversation_id]
 * @param {string}  [opts.session_id]
 * @returns {Promise<{ system: string, user: string }>}
 */
export async function injectContext(prompt, { user_id, conversation_id, session_id } = {}) {
  if (!user_id || !prompt) return prompt;

  try {
    const [fullCtx, recentMemory] = await Promise.all([
      buildFullContext({
        user_id,
        conversation_id: conversation_id || "",
        message: prompt.user,
        session_id,
      }).catch((err) => {
        log.warn("[orchestrator]", "context assembly failed (non-fatal):", err.message);
        return null;
      }),
      getRecentInteractions({ user_id, session_id: session_id || "default", limit: 10 }).catch(
        () => [],
      ),
    ]);

    const contextBlock = fullCtx?.formatted || "";
    const memoryBlock =
      recentMemory.length > 0
        ? recentMemory
            .map((m) => `[${m.role}] ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
            .join("\n")
        : "";

    const sections = [prompt.system];
    if (contextBlock) sections.push(`\n<context>\n${contextBlock}\n</context>`);
    if (memoryBlock) sections.push(`\n<recent_memory>\n${memoryBlock}\n</recent_memory>`);

    return { system: sections.join("\n"), user: prompt.user };
  } catch (err) {
    log.warn("[orchestrator]", "context injection failed (non-fatal):", err.message);
    return prompt;
  }
}

/**
 * Persist an interaction into the memory layer.
 *
 * @param {object} params
 * @param {string} params.user_id
 * @param {string} [params.session_id]
 * @param {string} params.role
 * @param {string} params.content
 * @returns {Promise<void>}
 */
export async function recordInteraction({ user_id, session_id, role, content }) {
  if (!user_id || !content) return;
  try {
    await storeInteraction({ user_id, session_id: session_id || "default", role, content });
  } catch (err) {
    log.warn("[orchestrator]", "memory store failed (non-fatal):", err.message);
  }
}

// ── Env validation ──────────────────────────────────────────────────────────

/**
 * Validate that the required env vars are present for an AI request.
 * Throws a descriptive Error if anything is missing.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.requireOpenAI=true]
 */
export function validateAIEnv({ requireOpenAI = true } = {}) {
  if (requireOpenAI && !process.env.OPENAI_API_KEY) {
    throw Object.assign(
      new Error("OPENAI_API_KEY is not configured"),
      { code: "ERR_CONFIG" },
    );
  }
}

// ── Orchestrate (non-streaming) ─────────────────────────────────────────────

/**
 * Run a full AI interaction through the Companion Brain pipeline.
 *
 * This is the recommended entry point for all non-streaming AI requests.
 *
 * @param {object} params
 * @param {string}   params.task              - Logical task label: "chat", "roleplay", "planning", etc.
 * @param {string}   params.message           - User message text.
 * @param {string}   params.user_id           - User identifier.
 * @param {string}   params.conversation_id   - Conversation identifier.
 * @param {string}   [params.model]           - AI model to use (defaults from MODEL_CONFIG).
 * @param {string}   [params.capability]      - Brain capability override.
 * @param {Function} [params.getRecentConversation] - Callback to fetch recent messages.
 * @param {object}   [params.extra]           - Additional params forwarded to brain.
 * @returns {Promise<{ response: string, intent?: string, isMedia?: boolean, model: string, task: string }>}
 */
export async function orchestrate({
  task = "chat",
  message,
  user_id,
  conversation_id,
  model,
  capability,
  getRecentConversation,
  extra,
  ...rest
}) {
  const resolvedModel = model || MODEL_CONFIG.chat;
  const startMs = Date.now();

  log.info("[orchestrator]", `task=${task}`, `model=${resolvedModel}`, `user=${user_id?.slice(0, 8) ?? "anon"}`);

  try {
    validateAIEnv();

    const result = await think({
      message,
      user_id,
      conversation_id,
      model: resolvedModel,
      capability: capability || task,
      getRecentConversation,
      extra,
      ...rest,
    });

    const durationMs = Date.now() - startMs;
    log.info("[orchestrator]", `completed task=${task} in ${durationMs}ms`, `intent=${result.intent ?? "none"}`);

    return {
      response: result.response,
      intent: result.intent,
      isMedia: result.isMedia || false,
      context: result.context,
      toolResults: result.toolResults,
      model: resolvedModel,
      task,
    };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    log.error("[orchestrator]", `failed task=${task} after ${durationMs}ms:`, err.message);
    throw err;
  }
}

// ── Orchestrate Streaming ───────────────────────────────────────────────────

/**
 * Stream an AI response token-by-token via an async generator.
 *
 * When `user_id` is provided the prompt is enriched with recent context
 * and memory before streaming begins.
 *
 * @param {object} params
 * @param {string}   params.task    - Logical task label.
 * @param {{ system: string, user: string }} params.prompt - Prompt object.
 * @param {string}   [params.model] - Model to use.
 * @param {string}   [params.user_id] - User id for context injection.
 * @param {string}   [params.conversation_id] - Conversation id for context injection.
 * @param {string}   [params.session_id] - Session id for memory lookup.
 * @returns {AsyncGenerator<string>} Yields individual tokens.
 */
export async function* orchestrateStream({ task = "chat", prompt, model, user_id, conversation_id, session_id }) {
  const resolvedModel = model || MODEL_CONFIG.chat;
  const startMs = Date.now();

  log.info("[orchestrator]", `stream task=${task}`, `model=${resolvedModel}`);

  try {
    validateAIEnv();

    const enrichedPrompt = user_id
      ? await injectContext(prompt, { user_id, conversation_id, session_id })
      : prompt;

    yield* chatStream({ prompt: enrichedPrompt, model: resolvedModel });

    const durationMs = Date.now() - startMs;
    log.info("[orchestrator]", `stream completed task=${task} in ${durationMs}ms`);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    log.error("[orchestrator]", `stream failed task=${task} after ${durationMs}ms:`, err.message);
    throw err;
  }
}

// ── Simple completions (bypass Brain) ───────────────────────────────────────

/**
 * Run a direct chat completion without the full Brain pipeline.
 * Useful for lightweight tasks like classification or summarization.
 *
 * When `user_id` is provided the prompt is enriched with recent context
 * and memory before the completion runs.
 *
 * @param {object} params
 * @param {{ system: string, user: string }} params.prompt
 * @param {string} [params.model]
 * @param {string} [params.task="chat"]
 * @param {string} [params.user_id] - User id for context injection.
 * @param {string} [params.conversation_id] - Conversation id for context injection.
 * @param {string} [params.session_id] - Session id for memory lookup.
 * @returns {Promise<string>}
 */
export async function orchestrateSimple({ prompt, model, task = "chat", user_id, conversation_id, session_id }) {
  const resolvedModel = model || MODEL_CONFIG.chat;
  log.info("[orchestrator]", `simple task=${task}`, `model=${resolvedModel}`);

  try {
    validateAIEnv();

    const enrichedPrompt = user_id
      ? await injectContext(prompt, { user_id, conversation_id, session_id })
      : prompt;

    return await chat({ prompt: enrichedPrompt, model: resolvedModel, task });
  } catch (err) {
    log.error("[orchestrator]", `simple failed task=${task}:`, err.message);
    throw err;
  }
}

/**
 * Run a direct chat completion and parse the result as JSON.
 *
 * @param {object} params
 * @param {{ system: string, user: string }} params.prompt
 * @param {string} [params.model]
 * @returns {Promise<object>}
 */
export async function orchestrateJSON({ prompt, model }) {
  const resolvedModel = model || MODEL_CONFIG.chat;
  log.info("[orchestrator]", `json-parse`, `model=${resolvedModel}`);

  try {
    validateAIEnv();
    return await chatJSON({ prompt, model: resolvedModel });
  } catch (err) {
    log.error("[orchestrator]", `json-parse failed:`, err.message);
    throw err;
  }
}

/**
 * Generate an embedding vector.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function orchestrateEmbed(text) {
  try {
    validateAIEnv();
    return await embed(text);
  } catch (err) {
    log.error("[orchestrator]", "embed failed:", err.message);
    throw err;
  }
}
