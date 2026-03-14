/**
 * Emoji Orb Service
 *
 * Client-side image analysis and emoji orb generation.
 * Analyzes uploaded images using Canvas API to extract visual traits,
 * then transforms those traits into stylized emoji orb configurations.
 */

import type {
  ImageAnalysisTraits,
  RgbColor,
  SubjectType,
  EmotionTone,
  VisualComplexity,
  EmojiCandidate,
  EmojiOrbConfig,
  EmojiOrbFeatureSet,
  EmojiOrbStyleMode,
} from '@/types/emoji-orb';

// ─── Image Analysis ───────────────────────────────────────────────────────────

/**
 * Load an image file and return its pixel data via an offscreen canvas.
 * Resizes large images to a 200×200 sample for efficient analysis.
 */
function loadImageData(file: File): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const sampleSize = 200;
      const canvas = document.createElement('canvas');
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      resolve({ data: imageData.data, width: sampleSize, height: sampleSize });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/** Extract the top N dominant colors by frequency from pixel data using quantization. */
function extractDominantColors(data: Uint8ClampedArray, topN: number = 5): RgbColor[] {
  const bucketSize = 32; // Quantize to reduce unique colors
  const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = Math.round(data[i] / bucketSize) * bucketSize;
    const g = Math.round(data[i + 1] / bucketSize) * bucketSize;
    const b = Math.round(data[i + 2] / bucketSize) * bucketSize;
    const key = `${r},${g},${b}`;
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r, g, b, count: 1 });
    }
  }

  return Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map(({ r, g, b }) => ({ r, g, b }));
}

/** Compute average brightness (0-1) from pixel data. */
function computeBrightness(data: Uint8ClampedArray): number {
  let total = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    // Perceived luminance
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (pixelCount * 255);
}

/** Compute contrast (0-1) as the standard deviation of luminance values. */
function computeContrast(data: Uint8ClampedArray): number {
  const pixelCount = data.length / 4;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    sum += lum;
    sumSq += lum * lum;
  }
  const mean = sum / pixelCount;
  const variance = sumSq / pixelCount - mean * mean;
  // Normalize: typical stddev rarely exceeds 0.3, so scale to 0-1
  return Math.min(1, Math.sqrt(Math.max(0, variance)) / 0.3);
}

/** Compute color warmth (0=cool, 1=warm) based on red/blue channel ratio. */
function computeWarmth(data: Uint8ClampedArray): number {
  let rTotal = 0;
  let bTotal = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    rTotal += data[i];
    bTotal += data[i + 2];
  }
  const rAvg = rTotal / pixelCount;
  const bAvg = bTotal / pixelCount;
  if (rAvg + bAvg === 0) return 0.5;
  return rAvg / (rAvg + bAvg);
}

/** Compute colorfulness (0-1) using saturation distribution. */
function computeColorfulness(data: Uint8ClampedArray): number {
  let satTotal = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    satTotal += sat;
  }
  return satTotal / pixelCount;
}

/** Estimate visual complexity by counting unique color buckets. */
function estimateComplexity(data: Uint8ClampedArray): VisualComplexity {
  const bucketSize = 64;
  const seen = new Set<string>();
  for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
    const r = Math.round(data[i] / bucketSize);
    const g = Math.round(data[i + 1] / bucketSize);
    const b = Math.round(data[i + 2] / bucketSize);
    seen.add(`${r},${g},${b}`);
  }
  if (seen.size < 15) return 'simple';
  if (seen.size < 40) return 'moderate';
  return 'complex';
}

/** Detect likely skin tone pixels — heuristic for face/person presence. */
function detectSkinToneRatio(data: Uint8ClampedArray): number {
  let skinPixels = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Simple skin-tone heuristic (RGB-based)
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && Math.abs(r - b) > 15) {
      skinPixels++;
    }
  }
  return skinPixels / pixelCount;
}

/** Infer the subject type from pixel analysis heuristics. */
function inferSubjectType(
  skinRatio: number,
  brightness: number,
  colorfulness: number,
  complexity: VisualComplexity,
): SubjectType {
  if (skinRatio > 0.15) return 'person';
  if (colorfulness > 0.5 && complexity === 'complex') return 'scene';
  if (colorfulness < 0.15 && complexity === 'simple') return 'text';
  if (complexity === 'simple' && brightness > 0.6) return 'object';
  if (colorfulness < 0.2) return 'abstract';
  return 'unknown';
}

/** Infer emotional tone from visual traits. */
function inferEmotion(
  brightness: number,
  warmth: number,
  colorfulness: number,
  subjectType: SubjectType,
): EmotionTone {
  if (subjectType === 'person' && brightness > 0.5 && warmth > 0.55) return 'happy';
  if (warmth > 0.6 && colorfulness > 0.4) return 'energetic';
  if (warmth > 0.55 && brightness > 0.5) return 'warm';
  if (warmth < 0.45 && brightness > 0.5) return 'cool';
  if (brightness > 0.6 && colorfulness > 0.3) return 'playful';
  if (brightness < 0.35) return 'serious';
  if (brightness > 0.5 && colorfulness < 0.25) return 'calm';
  return 'neutral';
}

/**
 * Analyze an image file and extract visual traits for orb generation.
 * This runs entirely client-side using the Canvas API.
 */
export async function analyzeImageForOrb(file: File): Promise<ImageAnalysisTraits> {
  const { data } = await loadImageData(file);

  const dominantColors = extractDominantColors(data);
  const brightness = computeBrightness(data);
  const contrast = computeContrast(data);
  const warmth = computeWarmth(data);
  const colorfulness = computeColorfulness(data);
  const visualComplexity = estimateComplexity(data);
  const skinRatio = detectSkinToneRatio(data);
  const hasFace = skinRatio > 0.15;
  const subjectType = inferSubjectType(skinRatio, brightness, colorfulness, visualComplexity);
  const emotion = inferEmotion(brightness, warmth, colorfulness, subjectType);

  // Confidence based on how decisive the analysis was
  const confidence = Math.min(1, 0.5 + colorfulness * 0.2 + contrast * 0.15 + (hasFace ? 0.15 : 0));

  return {
    dominantColors,
    brightness,
    contrast,
    warmth,
    subjectType,
    emotion,
    visualComplexity,
    hasFace,
    colorfulness,
    confidence,
  };
}

// ─── Emoji Mapping ────────────────────────────────────────────────────────────

/** Map analysis traits to emoji candidates sorted by relevance. */
export function mapToEmojiCandidates(traits: ImageAnalysisTraits): EmojiCandidate[] {
  const candidates: EmojiCandidate[] = [];

  // Subject-type based mapping
  const subjectEmojis: Record<SubjectType, Array<{ emoji: string; label: string }>> = {
    person: [
      { emoji: '😊', label: 'Smiling Face' },
      { emoji: '🙂', label: 'Slightly Smiling' },
      { emoji: '😎', label: 'Cool Face' },
      { emoji: '🤗', label: 'Hugging Face' },
    ],
    animal: [
      { emoji: '🐾', label: 'Paw Prints' },
      { emoji: '🦊', label: 'Fox' },
      { emoji: '🐱', label: 'Cat' },
      { emoji: '🐶', label: 'Dog' },
    ],
    object: [
      { emoji: '✨', label: 'Sparkles' },
      { emoji: '💎', label: 'Gem' },
      { emoji: '🔮', label: 'Crystal Ball' },
      { emoji: '⚡', label: 'Lightning' },
    ],
    scene: [
      { emoji: '🌅', label: 'Sunrise' },
      { emoji: '🏔️', label: 'Mountain' },
      { emoji: '🌊', label: 'Wave' },
      { emoji: '🌈', label: 'Rainbow' },
    ],
    abstract: [
      { emoji: '🎨', label: 'Art Palette' },
      { emoji: '💫', label: 'Dizzy Star' },
      { emoji: '🌀', label: 'Cyclone' },
      { emoji: '♾️', label: 'Infinity' },
    ],
    text: [
      { emoji: '📝', label: 'Memo' },
      { emoji: '💬', label: 'Speech Bubble' },
      { emoji: '📖', label: 'Book' },
      { emoji: '✏️', label: 'Pencil' },
    ],
    unknown: [
      { emoji: '✨', label: 'Sparkles' },
      { emoji: '🌟', label: 'Glowing Star' },
      { emoji: '💠', label: 'Diamond' },
      { emoji: '🔵', label: 'Blue Circle' },
    ],
  };

  // Add subject-type emojis
  const subjectList = subjectEmojis[traits.subjectType];
  subjectList.forEach((e, i) => {
    candidates.push({ ...e, score: 0.9 - i * 0.1 });
  });

  // Emotion-based overlays
  const emotionEmojis: Partial<Record<EmotionTone, { emoji: string; label: string }>> = {
    happy: { emoji: '😄', label: 'Grinning Face' },
    energetic: { emoji: '🔥', label: 'Fire' },
    calm: { emoji: '🌙', label: 'Moon' },
    playful: { emoji: '🎉', label: 'Party' },
    warm: { emoji: '☀️', label: 'Sun' },
    cool: { emoji: '❄️', label: 'Snowflake' },
    serious: { emoji: '🖤', label: 'Black Heart' },
  };
  const emotionEmoji = emotionEmojis[traits.emotion];
  if (emotionEmoji) {
    candidates.push({ ...emotionEmoji, score: 0.75 });
  }

  // Deduplicate by emoji
  const seen = new Set<string>();
  return candidates.filter(c => {
    if (seen.has(c.emoji)) return false;
    seen.add(c.emoji);
    return true;
  }).sort((a, b) => b.score - a.score);
}

// ─── Color Conversion ─────────────────────────────────────────────────────────

/** Convert RGB to OKLch-approximate CSS string. Uses oklch() via HSL approximation. */
function rgbToOklchApprox(color: RgbColor, lightness: number, chroma: number, alphaOverride?: number): string {
  const { r, g, b } = color;
  // Convert to HSL for hue extraction
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  const hue = Math.round(h * 360);
  const alpha = alphaOverride !== undefined ? ` / ${alphaOverride.toFixed(2)}` : '';
  return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} ${hue}${alpha})`;
}

// ─── Orb Generation ───────────────────────────────────────────────────────────

/** Style-specific adjustments for orb features. */
interface StyleAdjustments {
  lightnessBoost: number;
  chromaMultiplier: number;
  highlightOpacity: number;
  ringOpacity: number;
  glowIntensity: number;
}

const STYLE_ADJUSTMENTS: Record<EmojiOrbStyleMode, StyleAdjustments> = {
  classic: { lightnessBoost: 0, chromaMultiplier: 1.0, highlightOpacity: 0.50, ringOpacity: 0.30, glowIntensity: 0.20 },
  minimal: { lightnessBoost: 0.05, chromaMultiplier: 0.7, highlightOpacity: 0.35, ringOpacity: 0.20, glowIntensity: 0.12 },
  playful: { lightnessBoost: 0.05, chromaMultiplier: 1.3, highlightOpacity: 0.60, ringOpacity: 0.40, glowIntensity: 0.30 },
  glossy: { lightnessBoost: 0.08, chromaMultiplier: 1.1, highlightOpacity: 0.70, ringOpacity: 0.35, glowIntensity: 0.25 },
  cute: { lightnessBoost: 0.10, chromaMultiplier: 1.2, highlightOpacity: 0.55, ringOpacity: 0.35, glowIntensity: 0.28 },
  symbolic: { lightnessBoost: -0.02, chromaMultiplier: 0.8, highlightOpacity: 0.40, ringOpacity: 0.25, glowIntensity: 0.15 },
};

/** Generate the orb feature set from traits and a style mode. */
function generateFeatureSet(
  traits: ImageAnalysisTraits,
  styleMode: EmojiOrbStyleMode,
  emoji: string,
): EmojiOrbFeatureSet {
  const primary = traits.dominantColors[0] ?? { r: 128, g: 80, b: 200 };
  const secondary = traits.dominantColors[1] ?? { r: primary.r * 0.7, g: primary.g * 0.7, b: primary.b * 0.7 };
  const adj = STYLE_ADJUSTMENTS[styleMode];

  const baseL = 0.55 + traits.brightness * 0.2 + adj.lightnessBoost;
  const baseC = 0.18 * adj.chromaMultiplier;

  return {
    emoji,
    gradientFrom: rgbToOklchApprox(primary, Math.min(0.95, baseL + 0.15), baseC + 0.04),
    gradientMid: rgbToOklchApprox(primary, baseL, baseC),
    gradientTo: rgbToOklchApprox(secondary, Math.max(0.25, baseL - 0.20), Math.max(0.10, baseC - 0.06)),
    ringColor: rgbToOklchApprox(primary, baseL - 0.05, baseC, adj.ringOpacity),
    highlightColor: rgbToOklchApprox(primary, Math.min(0.95, baseL + 0.25), baseC * 0.6, adj.highlightOpacity),
    glowColor: rgbToOklchApprox(primary, baseL + 0.10, baseC, adj.glowIntensity),
    accentColor: rgbToOklchApprox(secondary, baseL, baseC * 0.8, 0.60),
  };
}

/**
 * Generate multiple emoji orb config variants from image analysis traits.
 * Produces one variant per style mode, each with the top emoji candidate.
 */
export function generateEmojiOrbVariants(traits: ImageAnalysisTraits): EmojiOrbConfig[] {
  const candidates = mapToEmojiCandidates(traits);
  const topEmoji = candidates[0]?.emoji ?? '✨';

  const styles: EmojiOrbStyleMode[] = ['classic', 'minimal', 'playful', 'glossy', 'cute', 'symbolic'];

  return styles.map((styleMode, idx) => ({
    id: `emoji-orb-${styleMode}-${idx}`,
    styleMode,
    features: generateFeatureSet(traits, styleMode, topEmoji),
    analysis: traits,
    emojiCandidates: candidates,
  }));
}

/**
 * Regenerate a single orb config with a specific emoji and style mode.
 */
export function regenerateOrbConfig(
  traits: ImageAnalysisTraits,
  styleMode: EmojiOrbStyleMode,
  emoji: string,
): EmojiOrbConfig {
  const candidates = mapToEmojiCandidates(traits);
  return {
    id: `emoji-orb-${styleMode}-custom`,
    styleMode,
    features: generateFeatureSet(traits, styleMode, emoji),
    analysis: traits,
    emojiCandidates: candidates,
  };
}

/** Read a File as a data URL string. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
