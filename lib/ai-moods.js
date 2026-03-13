/**
 * Canonical AI mood definitions for backend (Netlify function bundles).
 *
 * Keep mood IDs and descriptions in sync with src/lib/ai-moods.ts (the
 * frontend copy imported by SettingsView).
 */
export const AI_MOODS = [
  { value: "neutral",      label: "Neutral",       description: "Balanced and adaptive — match the user's energy and adjust naturally." },
  { value: "friendly",     label: "Friendly",      description: "Warm, approachable, and supportive." },
  { value: "professional", label: "Professional",  description: "Formal, precise, and focused." },
  { value: "playful",      label: "Playful",       description: "Fun, witty, and light-hearted." },
  { value: "romantic",     label: "Romantic",      description: "Warm, sensual, and intimate." },
  { value: "direct",       label: "Direct",        description: "Blunt and concise — get to the point fast." },
  { value: "empathetic",   label: "Empathetic",    description: "Compassionate and nurturing." },
  { value: "creative",     label: "Creative",      description: "Imaginative and expressive." },
];

/** Map of mood value → system-prompt description. */
export const MOOD_DESCRIPTIONS = Object.fromEntries(
  AI_MOODS.map((m) => [m.value, m.description])
);
