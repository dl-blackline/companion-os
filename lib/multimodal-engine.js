/**
 * Multimodal Engine — central dispatcher for all AI tasks.
 *
 * Every AI capability (chat, voice, image, video, music, workflow) routes
 * through this single entry point.  Internally it delegates to the
 * Capability Router which resolves the correct provider for each task.
 *
 * Usage:
 *   import { runTask } from "./multimodal-engine.js";
 *
 *   const result = await runTask({
 *     type: "image",
 *     prompt: "a futuristic city skyline",
 *     model: "openai-image",
 *   });
 */

import { routeCapability } from "./capability-router.js";

/**
 * Run an AI task through the multimodal engine.
 *
 * @param {object} params
 * @param {string} params.type    - Task type: "chat" | "voice" | "image" | "video" | "music" | "workflow"
 * @param {string} params.prompt  - The user prompt / input text.
 * @param {string} [params.model] - Optional model id (e.g. "gpt-4.1", "openai-image", "sora").
 * @param {object} [params.options] - Additional options forwarded to the provider.
 * @returns {Promise<object>} Provider-specific result, always includes `{ type }`.
 */
export async function runTask({ type, prompt, model, options = {} }) {
  if (!type) {
    throw new Error("Missing required parameter: type");
  }

  if (!prompt && type !== "workflow") {
    throw new Error("Missing required parameter: prompt");
  }

  return routeCapability({ type, prompt, model, options });
}
