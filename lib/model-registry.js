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
      name: "GPT-5.4 (Unfiltered)",
      provider: "openai",
      description: "GPT-5.4 — latest and most capable model, unfiltered mode",
      unfiltered: true,
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
    {
      id: "nofilter-gpt",
      name: "NoFilter GPT",
      provider: "nofilter",
      description: "Unfiltered AI chat via NoFilter GPT API",
      unfiltered: true,
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
      id: "gpt-image-1.5",
      name: "GPT Image 1.5",
      provider: "openai",
      modelId: "gpt-image-1.5",
      description: "GPT Image 1.5 — latest OpenAI image generation model",
    },
    {
      id: "flux",
      name: "Flux Image Generation",
      provider: "piapi",
    },
    {
      id: "leonardo",
      name: "Leonardo AI",
      provider: "leonardo",
      description: "High-quality image generation via Leonardo AI",
    },
    {
      id: "lucid-origin",
      name: "Lucid Origin",
      provider: "leonardo",
      modelId: "aa77f04e-3eec-4034-9c07-d0836e65191e",
      description: "Lucid Origin — photorealistic model via Leonardo AI",
    },
    {
      id: "seedream-4.5",
      name: "Seedream 4.5",
      provider: "leonardo",
      modelId: "b24e16ff-06e3-43eb-8d33-4416c2d75876",
      description: "Seedream 4.5 — vivid creative image generation via Leonardo AI",
    },
    {
      id: "nano-banana-2",
      name: "Nano Banana 2",
      provider: "leonardo",
      modelId: "e71a1c2f-4f80-4800-934f-2c68979d1cc6",
      description: "Nano Banana 2 — stylized image generation via Leonardo AI",
    },
    {
      id: "nofilter-image",
      name: "NoFilter Image",
      provider: "nofilter",
      description: "Unrestricted image generation via NoFilter GPT API",
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
    {
      id: "kling-3.0",
      name: "Kling 3.0",
      provider: "kling",
      modelId: "kling-v3",
      description: "Kling 3.0 — high-quality video generation via Kling AI",
    },
    {
      id: "kling-omni",
      name: "Kling Omni",
      provider: "kling",
      modelId: "kling-omni",
      description: "Kling Omni — versatile video generation via Kling AI",
    },
    {
      id: "hailuo-2.3",
      name: "Hailuo 2.3",
      provider: "hailuo",
      modelId: "T2V-01",
      description: "Hailuo 2.3 — fast text-to-video generation via MiniMax",
    },
    {
      id: "veo-3.1",
      name: "Veo 3.1",
      provider: "google",
      modelId: "veo-3.1-generate-preview",
      description: "Veo 3.1 — cinematic video generation via Google",
    },
    {
      id: "nofilter-video",
      name: "NoFilter Video",
      provider: "nofilter",
      description: "Unrestricted video generation via NoFilter GPT API",
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
    {
      id: "nofilter-voice",
      name: "NoFilter Realtime Voice",
      provider: "nofilter",
      description: "Unfiltered realtime voice via NoFilter GPT API",
      unfiltered: true,
    },
  ],

  realtime_voice: [
    {
      id: "marin",
      name: "Marin",
      provider: "openai",
      description: "Professional and expressive — exclusive to gpt-realtime",
    },
    {
      id: "cedar",
      name: "Cedar",
      provider: "openai",
      description: "Natural and conversational — exclusive to gpt-realtime",
    },
    {
      id: "alloy",
      name: "Alloy",
      provider: "openai",
      description: "Neutral and balanced voice",
    },
    {
      id: "echo",
      name: "Echo",
      provider: "openai",
      description: "Warm and engaging voice",
    },
    {
      id: "shimmer",
      name: "Shimmer",
      provider: "openai",
      description: "Energetic and expressive voice",
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

/**
 * Return true if the given chat model id is marked as unfiltered.
 */
export function isUnfilteredModel(modelId) {
  const entry = getModel("chat", modelId);
  return entry ? !!entry.unfiltered : false;
}
