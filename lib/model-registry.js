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
      id: "gpt-4.1",
      name: "GPT-4.1",
      provider: "openai",
      description: "Latest flagship model — great for complex tasks",
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
