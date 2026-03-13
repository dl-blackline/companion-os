/**
 * Model Configuration — environment-driven defaults for all OpenAI model slots.
 *
 * Override any slot via the corresponding environment variable, or let the
 * frontend pass an explicit model name per request.
 */

export const MODEL_CONFIG = {
  chat: process.env.OPENAI_CHAT_MODEL || "gpt-5.4",
  voice: process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview",
  embedding: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
};
