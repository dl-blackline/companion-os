/**
 * Local model cache — provides instant reads/writes for model preferences
 * and caches the available model list built from local defaults/env.
 */

// ---------------------------------------------------------------------------
// Storage key mapping — aligns with MODEL_STORAGE_KEYS in SettingsView
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  chat: 'chat_model',
  fallback: 'fallback_model',
  image: 'image_model',
  video: 'video_model',
  music: 'music_model',
  voice: 'voice_model',
};

function storageKeyFor(type) {
  return STORAGE_KEYS[type] || `model_${type}`;
}

// ---------------------------------------------------------------------------
// Per-type model preference (e.g. "chat", "image", "voice")
// ---------------------------------------------------------------------------

export function getModelSetting(type) {
  try {
    return localStorage.getItem(storageKeyFor(type));
  } catch {
    return null;
  }
}

export function setModelSetting(type, value) {
  try {
    localStorage.setItem(storageKeyFor(type), value);
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

// ---------------------------------------------------------------------------
// Available models cache (built locally from env/defaults)
// ---------------------------------------------------------------------------

const AVAILABLE_MODELS_KEY = 'available_models';

const DEFAULT_CHAT_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
];

const DEFAULT_MODEL_REGISTRY = {
  chat: DEFAULT_CHAT_MODELS,
  image: [{ id: 'openai-image', name: 'OpenAI Image', provider: 'openai' }],
  video: [{ id: 'sora', name: 'Sora', provider: 'openai' }],
  music: [{ id: 'suno', name: 'Suno', provider: 'suno' }],
  voice: [{ id: 'elevenlabs', name: 'ElevenLabs', provider: 'elevenlabs' }],
};

function toLabel(modelId) {
  return modelId
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join('-');
}

function buildChatModelsFromEnv() {
  const primary = import.meta.env.VITE_AI_PRIMARY_MODEL;
  const fallback = import.meta.env.VITE_AI_FALLBACK_MODEL;
  const ids = [primary, fallback].filter(Boolean);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return DEFAULT_CHAT_MODELS;
  return uniqueIds.map((id) => ({
    id,
    name: toLabel(id),
    provider: 'env',
  }));
}

function buildLocalModelRegistry() {
  return {
    ...DEFAULT_MODEL_REGISTRY,
    chat: buildChatModelsFromEnv(),
  };
}

export function getCachedModels() {
  try {
    const raw = localStorage.getItem(AVAILABLE_MODELS_KEY);
    return raw ? JSON.parse(raw) : buildLocalModelRegistry();
  } catch {
    return buildLocalModelRegistry();
  }
}

export function setCachedModels(models) {
  try {
    localStorage.setItem(AVAILABLE_MODELS_KEY, JSON.stringify(models));
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Build the model registry from env/defaults and cache it locally.
 */
export async function preloadModels() {
  const models = buildLocalModelRegistry();
  setCachedModels(models);
  return models;
}

// ---------------------------------------------------------------------------
// Helpers for looking up human-readable model names
// ---------------------------------------------------------------------------

/**
 * Return the display name for a stored model id.
 * Falls back to the raw id (capitalised) when the registry is not cached.
 */
export function getModelDisplayName(type, id) {
  const registry = getCachedModels();
  if (registry && registry[type]) {
    const entry = registry[type].find((m) => m.id === id);
    if (entry) return entry.name;
  }
  // Readable fallback
  if (!id) return 'Default';
  return id.charAt(0).toUpperCase() + id.slice(1);
}
