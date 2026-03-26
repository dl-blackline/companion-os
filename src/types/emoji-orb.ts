// ─── Emoji Orb Types ──────────────────────────────────────────────────────────
// Types for the emoji-style orb replacement system.
// Covers image analysis, orb generation, style preferences, and persistence.

// ─── Style Modes ──────────────────────────────────────────────────────────────

/** Available visual style modes for the generated emoji orb. */
export type EmojiOrbStyleMode =
  | 'classic'
  | 'minimal'
  | 'playful'
  | 'glossy'
  | 'cute'
  | 'symbolic';

export const EMOJI_ORB_STYLE_MODES: readonly EmojiOrbStyleMode[] = [
  'classic',
  'minimal',
  'playful',
  'glossy',
  'cute',
  'symbolic',
] as const;

export const EMOJI_ORB_STYLE_LABELS: Record<EmojiOrbStyleMode, string> = {
  classic: 'Classic Emoji',
  minimal: 'Minimal',
  playful: 'Playful',
  glossy: 'Premium Glossy',
  cute: 'Cute Mascot',
  symbolic: 'Clean Symbolic',
};

// ─── Image Analysis ───────────────────────────────────────────────────────────

/** Detected subject type from the uploaded image. */
export type SubjectType =
  | 'person'
  | 'animal'
  | 'object'
  | 'scene'
  | 'abstract'
  | 'text'
  | 'unknown';

/** Emotional tone inferred from the image. */
export type EmotionTone =
  | 'happy'
  | 'calm'
  | 'energetic'
  | 'serious'
  | 'playful'
  | 'warm'
  | 'cool'
  | 'neutral';

/** Visual complexity level. */
export type VisualComplexity = 'simple' | 'moderate' | 'complex';

/** RGB color representation. */
export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Result of analyzing an uploaded image for orb generation. */
export interface ImageAnalysisTraits {
  readonly dominantColors: readonly RgbColor[];
  readonly brightness: number;       // 0-1
  readonly contrast: number;         // 0-1
  readonly warmth: number;           // 0 (cool) to 1 (warm)
  readonly subjectType: SubjectType;
  readonly emotion: EmotionTone;
  readonly visualComplexity: VisualComplexity;
  readonly hasFace: boolean;
  readonly colorfulness: number;     // 0-1
  readonly confidence: number;       // 0-1 overall confidence
}

// ─── Emoji Mapping ────────────────────────────────────────────────────────────

/** An emoji candidate for the orb face/symbol. */
export interface EmojiCandidate {
  readonly emoji: string;
  readonly label: string;
  readonly score: number; // 0-1 relevance score
}

// ─── Orb Feature Set ──────────────────────────────────────────────────────────

/** Features that define the visual appearance of the emoji orb. */
export interface EmojiOrbFeatureSet {
  /** Primary emoji displayed on the orb face. */
  readonly emoji: string;
  /** Background gradient colors (OKLch strings). */
  readonly gradientFrom: string;
  readonly gradientMid: string;
  readonly gradientTo: string;
  /** Ring accent color. */
  readonly ringColor: string;
  /** Highlight color for 3D depth. */
  readonly highlightColor: string;
  /** Ambient glow color. */
  readonly glowColor: string;
  /** Optional secondary accent for decorative elements. */
  readonly accentColor: string;
}

// ─── Orb Config ───────────────────────────────────────────────────────────────

/** Complete configuration for a generated emoji orb variant. */
export interface EmojiOrbConfig {
  readonly id: string;
  readonly styleMode: EmojiOrbStyleMode;
  readonly features: EmojiOrbFeatureSet;
  readonly analysis: ImageAnalysisTraits;
  readonly emojiCandidates: readonly EmojiCandidate[];
}

// ─── Orb Appearance Mode ──────────────────────────────────────────────────────

/** The active appearance mode for the companion orb. */
export type OrbAppearanceMode = 'default' | 'emoji';

/** User-selectable orb color theme. */
export type OrbColorTheme = 'silver' | 'sapphire' | 'emerald' | 'violet' | 'crimson';

export const ORB_COLOR_LABELS: Record<OrbColorTheme, string> = {
  silver: 'Silver',
  sapphire: 'Sapphire',
  emerald: 'Emerald',
  violet: 'Violet',
  crimson: 'Crimson',
};

// ─── Flow States ──────────────────────────────────────────────────────────────

/** Discriminated union tracking the emoji orb customization flow. */
export type EmojiOrbFlowState =
  | { readonly status: 'idle' }
  | { readonly status: 'uploading' }
  | { readonly status: 'analyzing'; readonly imageDataUrl: string }
  | { readonly status: 'generating'; readonly imageDataUrl: string; readonly traits: ImageAnalysisTraits }
  | {
      readonly status: 'preview-ready';
      readonly imageDataUrl: string;
      readonly traits: ImageAnalysisTraits;
      readonly variants: readonly EmojiOrbConfig[];
      readonly selectedIndex: number;
    }
  | { readonly status: 'saving' }
  | { readonly status: 'error'; readonly message: string };

// ─── Persistence ──────────────────────────────────────────────────────────────

/** The orb preference payload stored in the user_preferences prefs JSONB. */
export interface OrbPreferencePayload {
  readonly mode: OrbAppearanceMode;
  readonly orbColor?: OrbColorTheme;
  readonly emojiConfig?: EmojiOrbFeatureSet;
  readonly styleMode?: EmojiOrbStyleMode;
  readonly emoji?: string;
}

export const DEFAULT_ORB_PREFERENCE: OrbPreferencePayload = {
  mode: 'default',
  orbColor: 'silver',
};
