/**
 * Local model cache — provides instant reads/writes for model preferences
 * and caches the available model list fetched from the backend registry.
 *
 * On first access the registry is loaded from /.netlify/functions/models and
 * stored in localStorage so subsequent page loads are instant.  Env-var
 * overrides (VITE_AI_PRIMARY_MODEL / VITE_AI_FALLBACK_MODEL) are merged in
 * so operators can highlight preferred models without changing the registry.
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
// Available models cache (fetched from backend, with env-override merge)
// ---------------------------------------------------------------------------

const AVAILABLE_MODELS_KEY = 'available_models';

// Minimal built-in fallback — shown only when the backend is unreachable.
const FALLBACK_MODEL_REGISTRY = {
  chat: [
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  ],
  image: [{ id: 'openai-image', name: 'OpenAI Image', provider: 'openai' }],
  video: [{ id: 'sora', name: 'Sora', provider: 'openai' }],
  music: [{ id: 'suno', name: 'Suno', provider: 'suno' }],
  voice: [{ id: 'elevenlabs', name: 'ElevenLabs', provider: 'elevenlabs' }],
};

/**
 * Merge env-var primary/fallback models into the chat list so operator
 * overrides are always visible at the top of the selector.
 */
function mergeEnvModels(registry) {
  const primary = import.meta.env.VITE_AI_PRIMARY_MODEL;
  const fallback = import.meta.env.VITE_AI_FALLBACK_MODEL;
  const envIds = [primary, fallback].filter(Boolean);
  if (envIds.length === 0) return registry;

  const existingIds = new Set((registry.chat || []).map((m) => m.id));
  const envEntries = envIds
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ id, name: id, provider: 'env' }));

  return {
    ...registry,
    chat: [...envEntries, ...(registry.chat || [])],
  };
}

export function getCachedModels() {
  try {
    const raw = localStorage.getItem(AVAILABLE_MODELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return mergeEnvModels(parsed);
    }
  } catch {
    // ignore parse errors
  }
  return mergeEnvModels(FALLBACK_MODEL_REGISTRY);
}

export function setCachedModels(models) {
  try {
    localStorage.setItem(AVAILABLE_MODELS_KEY, JSON.stringify(models));
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Fetch the full model registry from the backend and cache it locally.
 * Falls back to env-based defaults if the fetch fails.
 */
export async function preloadModels() {
  try {
    const res = await fetch('/.netlify/functions/models', { method: 'GET' });
    if (res.ok) {
      const json = await res.json();
      // Backend wraps in { success, data } — unwrap if needed
      const registry = json.data ?? json;
      if (registry && typeof registry === 'object' && registry.chat) {
        setCachedModels(registry);
        return mergeEnvModels(registry);
      }
    }
  } catch {
    // Network unavailable (dev with no local functions, cold start, etc.)
  }
  // Fall back to cached or built-in defaults
  return getCachedModels();
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
