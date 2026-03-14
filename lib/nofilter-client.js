/**
 * NoFilter GPT Client — OpenAI-compatible API client for the NoFilter GPT API.
 *
 * Provides unfiltered AI responses for chat, image generation, video generation,
 * and realtime voice sessions.
 *
 * Configuration (environment variables):
 *   NOFILTER_GPT_API_KEY      — required; your NoFilter API key
 *   NOFILTER_GPT_BASE_URL     — optional; defaults to https://api.nofilter.ai/v1
 *   NOFILTER_GPT_CHAT_MODEL   — optional; chat model name (default: nofilter-gpt)
 *   NOFILTER_GPT_IMAGE_MODEL  — optional; image model name (default: nofilter-image-1)
 *   NOFILTER_GPT_VIDEO_MODEL  — optional; video model name (default: nofilter-video-1)
 */

import OpenAI from "openai";

const DEFAULT_BASE_URL = "https://api.nofilter.ai/v1";

const CHAT_MODEL =
  process.env.NOFILTER_GPT_CHAT_MODEL || "nofilter-gpt";
const IMAGE_MODEL =
  process.env.NOFILTER_GPT_IMAGE_MODEL || "nofilter-image-1";
const VIDEO_MODEL =
  process.env.NOFILTER_GPT_VIDEO_MODEL || "nofilter-video-1";

/**
 * Return true when the given model id belongs to the NoFilter GPT provider.
 * Shared utility used by ai-router, voice-engine, and the AI gateway.
 *
 * @param {string|null|undefined} model - Model id to check.
 * @returns {boolean}
 */
export function isNofilterModel(model) {
  return typeof model === "string" && model.toLowerCase().startsWith("nofilter");
}

/**
 * Return a configured OpenAI SDK client pointed at the NoFilter API endpoint.
 * Throws if NOFILTER_GPT_API_KEY is not set.
 */
function getClient() {
  if (!process.env.NOFILTER_GPT_API_KEY) {
    throw new Error("NOFILTER_GPT_API_KEY is not configured");
  }

  return new OpenAI({
    apiKey: process.env.NOFILTER_GPT_API_KEY,
    baseURL: process.env.NOFILTER_GPT_BASE_URL || DEFAULT_BASE_URL,
  });
}

/**
 * Generate a chat completion via the NoFilter GPT API.
 *
 * @param {object} prompt - Prompt with `system` and `user` fields.
 * @param {string} [model] - Model name to use (defaults to NOFILTER_GPT_CHAT_MODEL).
 * @param {number} [temperature] - Sampling temperature (default: 0.7).
 * @returns {Promise<string>} The AI-generated response text.
 */
export async function generateChatCompletion(prompt, model, temperature) {
  const client = getClient();

  const messages = [];

  if (prompt.system) {
    messages.push({ role: "system", content: prompt.system });
  }

  messages.push({ role: "user", content: prompt.user });

  const response = await client.chat.completions.create({
    model: model || CHAT_MODEL,
    messages,
    temperature: temperature !== undefined ? temperature : 0.7,
    store: false,
  });

  return response.choices[0].message.content;
}

/**
 * Stream a chat completion via the NoFilter GPT API, yielding tokens as they arrive.
 *
 * @param {object} prompt - Prompt with `system` and `user` fields.
 * @param {string} [model] - Model name to use.
 * @param {number} [temperature] - Sampling temperature (default: 0.7).
 * @returns {AsyncGenerator<string>} An async generator that yields token strings.
 */
export async function* streamChatCompletion(prompt, model, temperature) {
  const client = getClient();

  const messages = [];

  if (prompt.system) {
    messages.push({ role: "system", content: prompt.system });
  }

  messages.push({ role: "user", content: prompt.user });

  const stream = await client.chat.completions.create({
    model: model || CHAT_MODEL,
    messages,
    temperature: temperature !== undefined ? temperature : 0.7,
    store: false,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

/**
 * Generate an image via the NoFilter GPT API.
 *
 * @param {string} prompt - Text description of the image to generate.
 * @returns {Promise<{type: string, url: string}>}
 */
export async function generateImage(prompt) {
  const client = getClient();

  const result = await client.images.generate({
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size: "1024x1024",
  });

  const item = result.data[0];
  const url =
    item.url ||
    (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null);

  if (!url) {
    throw new Error(
      "NoFilter image generation completed but no image data returned"
    );
  }

  return { type: "image", url };
}

/**
 * Generate a video via the NoFilter GPT API.
 *
 * The NoFilter API is expected to be OpenAI-compatible. If the API returns a
 * task ID for async generation, it is surfaced as `taskId` on the result.
 *
 * @param {string} prompt - Text description of the video to generate.
 * @returns {Promise<{type: string, url?: string, taskId?: string}>}
 */
export async function generateVideo(prompt) {
  if (!process.env.NOFILTER_GPT_API_KEY) {
    throw new Error("NOFILTER_GPT_API_KEY is not configured");
  }

  const baseURL = process.env.NOFILTER_GPT_BASE_URL || DEFAULT_BASE_URL;

  const res = await fetch(`${baseURL}/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOFILTER_GPT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      prompt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(
      `NoFilter video generation failed: ${res.status} ${errText}`
    );
  }

  const data = await res.json();

  const url = data.url || data.data?.[0]?.url || null;
  const taskId = data.id || data.task_id || null;

  if (!url && !taskId) {
    throw new Error(
      "NoFilter video generation completed but returned neither a URL nor a task ID"
    );
  }

  return {
    type: "video",
    url,
    taskId,
  };
}

/**
 * Create an ephemeral session for the NoFilter realtime voice API.
 *
 * If the NoFilter API exposes an OpenAI-compatible /realtime/sessions endpoint,
 * this will return a client_secret that can be used for a WebRTC connection.
 *
 * @param {object} [params]
 * @param {string} [params.model]  - Realtime model name.
 * @param {string} [params.voice]  - Voice name (e.g. "alloy").
 * @returns {Promise<{client_secret: string}>}
 */
export async function createRealtimeSession({ model, voice } = {}) {
  if (!process.env.NOFILTER_GPT_API_KEY) {
    throw new Error("NOFILTER_GPT_API_KEY is not configured");
  }

  const baseURL = process.env.NOFILTER_GPT_BASE_URL || DEFAULT_BASE_URL;

  const res = await fetch(`${baseURL}/realtime/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOFILTER_GPT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Realtime sessions use the conversational model; fall back to CHAT_MODEL
      // since there is no separate realtime-specific model constant.
      model: model || CHAT_MODEL,
      voice: voice || "alloy",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(
      `NoFilter realtime session creation failed: ${res.status} ${errText}`
    );
  }

  const data = await res.json();

  return {
    client_secret: data.client_secret?.value || data.client_secret,
  };
}
