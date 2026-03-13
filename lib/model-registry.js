/**
 * Model Registry — single source of truth for all supported AI models.
 *
 * Categories:
 *   chat   – conversational / reasoning models
 *   image  – image generation models
 *   video  – video generation models
 *   music  – music generation models
 *   voice  – voice synthesis models
 */

export const MODEL_REGISTRY = {
  chat: [
    {
      id: "gpt-5.4",
      name: "GPT-5.4",
      provider: "openai",
      description: "GPT-5.4 — latest and most capable model",
    },
    {
      id: "gpt-5.3",
      name: "GPT-5.3",
      provider: "openai",
      description: "GPT-5.3 — highly capable reasoning model",
    },
    {
      id: "gpt-5.2",
      name: "GPT-5.2",
      provider: "openai",
      description: "GPT-5.2 — advanced reasoning and generation",
    },
    {
      id: "gpt-5.1",
      name: "GPT-5.1",
      provider: "openai",
      description: "GPT-5.1 — next-generation language model",
    },
    {
      id: "gpt-4.1",
      name: "GPT-4.1",
      provider: "openai",
      description: "GPT-4.1 flagship model — great for complex tasks",
    },
    {
      id: "gpt-4.1-mini",
      name: "GPT-4.1 Mini",
      provider: "openai",
      description: "Fast and cost-efficient for everyday use",
    },
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      description: "Multimodal model with vision and audio",
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      provider: "openai",
      description: "Lightweight multimodal model",
    },
  ],

  image: [
    {
      id: "openai-image",
      name: "OpenAI Image",
      provider: "openai",
      description: "GPT Image generation via OpenAI",
    },
    {
      id: "flux",
      name: "Flux Image Generation",
      provider: "piapi",
    },
  ],

  video: [
    {
      id: "sora",
      name: "Sora Video",
      provider: "openai",
      description: "OpenAI Sora video generation",
    },
    {
      id: "runway-gen3",
      name: "Runway Gen-3 Video",
      provider: "runway",
    },
  ],

  music: [
    {
      id: "suno",
      name: "Suno Music Generation",
      provider: "suno",
    },
  ],

  voice: [
    {
      id: "elevenlabs",
      name: "ElevenLabs Voice",
      provider: "elevenlabs",
    },
    {
      id: "openai_voice",
      name: "OpenAI Realtime Voice",
      provider: "openai",
    },
  ],

  realtime_voice: [
    {
      id: "alloy",
      name: "Alloy",
      provider: "openai",
      description: "Neutral and balanced voice",
    },
    {
      id: "aria",
      name: "Aria",
      provider: "openai",
      description: "Warm and expressive voice",
    },
    {
      id: "nova",
      name: "Nova",
      provider: "openai",
      description: "Clear and articulate voice",
    },
    {
      id: "verse",
      name: "Verse",
      provider: "openai",
      description: "Dynamic and engaging voice",
    },
  ],
};

/**
 * Return the default model id for a given category.
 */
export function getDefaultModel(category) {
  const models = MODEL_REGISTRY[category];
  return models && models.length > 0 ? models[0].id : null;
}

/**
 * Look up a model entry by category and id.
 */
export function getModel(category, id) {
  const models = MODEL_REGISTRY[category];
  if (!models) return null;
  return models.find((m) => m.id === id) || null;
}
