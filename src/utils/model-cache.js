/**
 * Local model cache — provides instant reads/writes for model preferences
 * and caches the available model list fetched from the backend.
 */

// ---------------------------------------------------------------------------
// Per-type model preference (e.g. "chat", "image", "voice")
// ---------------------------------------------------------------------------

export function getModelSetting(type) {
  try {
    return localStorage.getItem(`model_${type}`);
  } catch {
    return null;
  }
}

export function setModelSetting(type, value) {
  try {
    localStorage.setItem(`model_${type}`, value);
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

// ---------------------------------------------------------------------------
// Available models cache (populated from /.netlify/functions/models)
// ---------------------------------------------------------------------------

const AVAILABLE_MODELS_KEY = 'available_models';

export function getCachedModels() {
  try {
    const raw = localStorage.getItem(AVAILABLE_MODELS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
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
 * Fetch the model registry from the backend and cache it locally.
 * Returns the cached copy immediately if available while refreshing in the
 * background, ensuring the Settings page loads instantly.
 */
export async function preloadModels() {
  try {
    const res = await fetch('/.netlify/functions/models');
    if (!res.ok) throw new Error('Failed to fetch models');
    const models = await res.json();
    setCachedModels(models);
    return models;
  } catch (err) {
    console.warn('preloadModels: using cached fallback', err);
    return getCachedModels();
  }
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
