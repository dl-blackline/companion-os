/**
 * Model Configuration — environment-driven defaults for all OpenAI model slots.
 *
 * Override any slot via the corresponding environment variable, or let the
 * frontend pass an explicit model name per request.
 *
 * Reads are lazy (via getter) so env vars are resolved at call time, not at import time.
 * This ensures Netlify Functions always pick up the correct values.
 */

export const MODEL_CONFIG = {
  get chat() { return process.env.OPENAI_CHAT_MODEL || "gpt-4.1"; },
  get voice() { return process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview"; },
  get embedding() { return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"; },
};
