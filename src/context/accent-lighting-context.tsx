/**
 * AccentLightingContext — Vuk OS customizable accent lighting system.
 *
 * Provides a centralized accent color theme that controls all glow, edge-lighting,
 * active states, and neon highlights throughout the product. Users can select from
 * preset accent themes or configure custom colors via Settings.
 *
 * Accent colors are expressed as OKLCh values for precise perceptual control.
 * The system sets CSS custom properties on :root so the entire UI responds reactively.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

// ── Accent Presets ──────────────────────────────────────────────────────────

export type AccentThemeId =
  | 'ice-white'
  | 'crimson'
  | 'electric-blue'
  | 'cockpit-cyan'
  | 'amber'
  | 'violet'
  | 'emerald'
  | 'stealth'
  | 'rose-gold';

export interface AccentTheme {
  id: AccentThemeId;
  label: string;
  /** Primary accent hue for glow/borders (OKLCh hue angle) */
  hue: number;
  /** Chroma (saturation) for the primary accent */
  chroma: number;
  /** Lightness of the accent at full intensity */
  lightness: number;
  /** CSS color string for preview swatches */
  preview: string;
  /** Optional second hue for gradient effects */
  hue2?: number;
}

export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: 'ice-white',
    label: 'Ice White',
    hue: 240,
    chroma: 0.02,
    lightness: 0.92,
    preview: 'oklch(0.92 0.02 240)',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    hue: 15,
    chroma: 0.2,
    lightness: 0.6,
    preview: 'oklch(0.6 0.2 15)',
  },
  {
    id: 'electric-blue',
    label: 'Electric Blue',
    hue: 230,
    chroma: 0.18,
    lightness: 0.65,
    preview: 'oklch(0.65 0.18 230)',
  },
  {
    id: 'cockpit-cyan',
    label: 'Cockpit Cyan',
    hue: 200,
    chroma: 0.14,
    lightness: 0.78,
    preview: 'oklch(0.78 0.14 200)',
  },
  {
    id: 'amber',
    label: 'Amber',
    hue: 70,
    chroma: 0.16,
    lightness: 0.72,
    preview: 'oklch(0.72 0.16 70)',
  },
  {
    id: 'violet',
    label: 'Violet',
    hue: 290,
    chroma: 0.17,
    lightness: 0.6,
    preview: 'oklch(0.6 0.17 290)',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    hue: 155,
    chroma: 0.14,
    lightness: 0.62,
    preview: 'oklch(0.62 0.14 155)',
  },
  {
    id: 'stealth',
    label: 'Stealth',
    hue: 250,
    chroma: 0.005,
    lightness: 0.55,
    preview: 'oklch(0.55 0.005 250)',
  },
  {
    id: 'rose-gold',
    label: 'Rose Gold',
    hue: 30,
    chroma: 0.1,
    lightness: 0.7,
    preview: 'oklch(0.7 0.1 30)',
  },
];

const DEFAULT_ACCENT: AccentThemeId = 'cockpit-cyan';
const STORAGE_KEY = 'vuk-accent-theme';

// ── Apply CSS custom properties ─────────────────────────────────────────────

function applyAccentToDOM(theme: AccentTheme) {
  const root = document.documentElement;
  const { hue, chroma, lightness } = theme;

  // Primary accent
  root.style.setProperty('--vuk-accent-h', String(hue));
  root.style.setProperty('--vuk-accent-c', String(chroma));
  root.style.setProperty('--vuk-accent-l', String(lightness));
  root.style.setProperty('--vuk-accent', `oklch(${lightness} ${chroma} ${hue})`);

  // Lighter variant for text-on-dark
  root.style.setProperty('--vuk-accent-light', `oklch(${Math.min(lightness + 0.2, 0.95)} ${chroma * 0.7} ${hue})`);

  // Dimmer variant for subtle borders/surfaces
  root.style.setProperty('--vuk-accent-dim', `oklch(${lightness * 0.6} ${chroma * 0.5} ${hue})`);

  // Glow colors at various opacities
  root.style.setProperty('--vuk-glow-strong', `oklch(${lightness} ${chroma} ${hue} / 0.45)`);
  root.style.setProperty('--vuk-glow-medium', `oklch(${lightness} ${chroma} ${hue} / 0.25)`);
  root.style.setProperty('--vuk-glow-subtle', `oklch(${lightness} ${chroma} ${hue} / 0.12)`);
  root.style.setProperty('--vuk-glow-faint', `oklch(${lightness} ${chroma} ${hue} / 0.06)`);

  // Border with accent
  root.style.setProperty('--vuk-border-accent', `oklch(${lightness * 0.7} ${chroma * 0.6} ${hue} / 0.5)`);

  // Active nav / selected state
  root.style.setProperty('--vuk-active-bg', `oklch(${lightness * 0.25} ${chroma * 0.3} ${hue} / 0.6)`);
  root.style.setProperty('--vuk-active-border', `oklch(${lightness * 0.8} ${chroma * 0.7} ${hue} / 0.6)`);

  // Shadow glow for box-shadow usage
  root.style.setProperty('--vuk-shadow-glow', `0 0 20px oklch(${lightness} ${chroma} ${hue} / 0.2), 0 0 40px oklch(${lightness} ${chroma} ${hue} / 0.08)`);
}

// ── Context ─────────────────────────────────────────────────────────────────

interface AccentLightingContextType {
  activeTheme: AccentTheme;
  activeThemeId: AccentThemeId;
  setAccentTheme: (id: AccentThemeId) => void;
  themes: AccentTheme[];
}

const AccentLightingContext = createContext<AccentLightingContextType | null>(null);

function loadSavedTheme(): AccentThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ACCENT_THEMES.some((t) => t.id === saved)) {
      return saved as AccentThemeId;
    }
  } catch { /* ignore */ }
  return DEFAULT_ACCENT;
}

export function AccentLightingProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<AccentThemeId>(loadSavedTheme);

  const activeTheme = ACCENT_THEMES.find((t) => t.id === themeId) ?? ACCENT_THEMES[0];

  // Apply to DOM on mount and theme change
  useEffect(() => {
    applyAccentToDOM(activeTheme);
  }, [activeTheme]);

  const setAccentTheme = useCallback((id: AccentThemeId) => {
    setThemeId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch { /* ignore */ }
  }, []);

  return (
    <AccentLightingContext.Provider
      value={{
        activeTheme,
        activeThemeId: themeId,
        setAccentTheme,
        themes: ACCENT_THEMES,
      }}
    >
      {children}
    </AccentLightingContext.Provider>
  );
}

export function useAccentLighting() {
  const ctx = useContext(AccentLightingContext);
  if (!ctx) {
    throw new Error('useAccentLighting must be used within an AccentLightingProvider');
  }
  return ctx;
}
