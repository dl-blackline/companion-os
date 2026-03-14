import { describe, it, expect } from 'vitest';
import {
  mapToEmojiCandidates,
  generateEmojiOrbVariants,
  regenerateOrbConfig,
} from './emoji-orb-service';
import type { ImageAnalysisTraits } from '@/types/emoji-orb';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeTraits(overrides: Partial<ImageAnalysisTraits> = {}): ImageAnalysisTraits {
  return {
    dominantColors: [
      { r: 200, g: 100, b: 50 },
      { r: 80, g: 120, b: 180 },
    ],
    brightness: 0.6,
    contrast: 0.4,
    warmth: 0.65,
    subjectType: 'person',
    emotion: 'happy',
    visualComplexity: 'moderate',
    hasface: true,
    colorfulness: 0.5,
    confidence: 0.8,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('emoji-orb-service', () => {
  describe('mapToEmojiCandidates', () => {
    it('should return emoji candidates for a person subject', () => {
      const traits = makeTraits({ subjectType: 'person' });
      const candidates = mapToEmojiCandidates(traits);
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      // Should contain at least one face emoji
      const emojis = candidates.map(c => c.emoji);
      expect(emojis).toContain('😊');
    });

    it('should return emoji candidates for an object subject', () => {
      const traits = makeTraits({ subjectType: 'object', emotion: 'calm' });
      const candidates = mapToEmojiCandidates(traits);
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      const emojis = candidates.map(c => c.emoji);
      expect(emojis).toContain('✨');
    });

    it('should return emoji candidates for a scene subject', () => {
      const traits = makeTraits({ subjectType: 'scene', emotion: 'energetic' });
      const candidates = mapToEmojiCandidates(traits);
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      const emojis = candidates.map(c => c.emoji);
      expect(emojis).toContain('🌅');
    });

    it('should return emoji candidates for an unknown subject', () => {
      const traits = makeTraits({ subjectType: 'unknown', emotion: 'neutral' });
      const candidates = mapToEmojiCandidates(traits);
      expect(candidates.length).toBeGreaterThanOrEqual(1);
    });

    it('should add emotion-based emoji when applicable', () => {
      const traits = makeTraits({ subjectType: 'abstract', emotion: 'energetic' });
      const candidates = mapToEmojiCandidates(traits);
      const emojis = candidates.map(c => c.emoji);
      expect(emojis).toContain('🔥');
    });

    it('should deduplicate emojis', () => {
      const traits = makeTraits({ subjectType: 'person', emotion: 'happy' });
      const candidates = mapToEmojiCandidates(traits);
      const emojis = candidates.map(c => c.emoji);
      const unique = new Set(emojis);
      expect(unique.size).toBe(emojis.length);
    });

    it('should sort candidates by score descending', () => {
      const traits = makeTraits();
      const candidates = mapToEmojiCandidates(traits);
      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i].score).toBeLessThanOrEqual(candidates[i - 1].score);
      }
    });

    it('should have a label for each candidate', () => {
      const traits = makeTraits();
      const candidates = mapToEmojiCandidates(traits);
      for (const c of candidates) {
        expect(c.label.length).toBeGreaterThan(0);
      }
    });
  });

  describe('generateEmojiOrbVariants', () => {
    it('should generate 6 variants (one per style mode)', () => {
      const traits = makeTraits();
      const variants = generateEmojiOrbVariants(traits);
      expect(variants).toHaveLength(6);
    });

    it('should assign different style modes to each variant', () => {
      const traits = makeTraits();
      const variants = generateEmojiOrbVariants(traits);
      const modes = variants.map(v => v.styleMode);
      expect(new Set(modes).size).toBe(6);
      expect(modes).toContain('classic');
      expect(modes).toContain('minimal');
      expect(modes).toContain('playful');
      expect(modes).toContain('glossy');
      expect(modes).toContain('cute');
      expect(modes).toContain('symbolic');
    });

    it('should include valid feature sets with oklch colors', () => {
      const traits = makeTraits();
      const variants = generateEmojiOrbVariants(traits);
      for (const v of variants) {
        expect(v.features.gradientFrom).toContain('oklch');
        expect(v.features.gradientMid).toContain('oklch');
        expect(v.features.gradientTo).toContain('oklch');
        expect(v.features.ringColor).toContain('oklch');
        expect(v.features.highlightColor).toContain('oklch');
        expect(v.features.glowColor).toContain('oklch');
        expect(v.features.accentColor).toContain('oklch');
      }
    });

    it('should include emoji candidates on each variant', () => {
      const traits = makeTraits();
      const variants = generateEmojiOrbVariants(traits);
      for (const v of variants) {
        expect(v.emojiCandidates.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should include the analysis on each variant', () => {
      const traits = makeTraits();
      const variants = generateEmojiOrbVariants(traits);
      for (const v of variants) {
        expect(v.analysis).toEqual(traits);
      }
    });

    it('should have unique IDs for each variant', () => {
      const traits = makeTraits();
      const variants = generateEmojiOrbVariants(traits);
      const ids = variants.map(v => v.id);
      expect(new Set(ids).size).toBe(6);
    });

    it('should assign the top emoji candidate to all variants', () => {
      const traits = makeTraits();
      const variants = generateEmojiOrbVariants(traits);
      const candidates = mapToEmojiCandidates(traits);
      const topEmoji = candidates[0]?.emoji;
      for (const v of variants) {
        expect(v.features.emoji).toBe(topEmoji);
      }
    });

    it('should produce different colors for different dominant colors', () => {
      const warm = makeTraits({ dominantColors: [{ r: 255, g: 50, b: 20 }] });
      const cool = makeTraits({ dominantColors: [{ r: 20, g: 50, b: 255 }] });
      const warmVariants = generateEmojiOrbVariants(warm);
      const coolVariants = generateEmojiOrbVariants(cool);
      // The hue values should differ
      expect(warmVariants[0].features.gradientFrom).not.toBe(coolVariants[0].features.gradientFrom);
    });
  });

  describe('regenerateOrbConfig', () => {
    it('should generate a config with the specified style and emoji', () => {
      const traits = makeTraits();
      const config = regenerateOrbConfig(traits, 'glossy', '🔥');
      expect(config.styleMode).toBe('glossy');
      expect(config.features.emoji).toBe('🔥');
    });

    it('should include oklch gradient colors', () => {
      const traits = makeTraits();
      const config = regenerateOrbConfig(traits, 'cute', '🐱');
      expect(config.features.gradientFrom).toContain('oklch');
      expect(config.features.gradientMid).toContain('oklch');
      expect(config.features.gradientTo).toContain('oklch');
    });

    it('should preserve the analysis and candidates', () => {
      const traits = makeTraits();
      const config = regenerateOrbConfig(traits, 'minimal', '🌙');
      expect(config.analysis).toEqual(traits);
      expect(config.emojiCandidates.length).toBeGreaterThanOrEqual(1);
    });

    it('should produce different features for different styles', () => {
      const traits = makeTraits();
      const playful = regenerateOrbConfig(traits, 'playful', '✨');
      const minimal = regenerateOrbConfig(traits, 'minimal', '✨');
      // Different style adjustments should produce different highlight colors
      expect(playful.features.highlightColor).not.toBe(minimal.features.highlightColor);
    });
  });
});
