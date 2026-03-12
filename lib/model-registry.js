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
      id: "openai",
      name: "OpenAI GPT-4o",
      provider: "openai",
      description: "Best for reasoning and conversation",
    },
    {
      id: "gemini",
      name: "Google Gemini 1.5 Pro",
      provider: "gemini",
      description: "Large context reasoning model",
    },
  ],

  image: [
    {
      id: "flux",
      name: "Flux Image Generation",
      provider: "piapi",
    },
  ],

  video: [
    {
      id: "runway",
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
