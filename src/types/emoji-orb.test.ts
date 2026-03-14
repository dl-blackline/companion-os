import { describe, it, expect } from 'vitest';
import type {
  EmojiOrbStyleMode,
  SubjectType,
  EmotionTone,
  VisualComplexity,
  RgbColor,
  ImageAnalysisTraits,
  EmojiCandidate,
  EmojiOrbConfig,
  EmojiOrbFeatureSet,
  OrbPreferencePayload,
  OrbAppearanceMode,
  EmojiOrbFlowState,
} from './emoji-orb';
import {
  EMOJI_ORB_STYLE_MODES,
  EMOJI_ORB_STYLE_LABELS,
  DEFAULT_ORB_PREFERENCE,
} from './emoji-orb';

describe('emoji-orb types', () => {
  describe('EMOJI_ORB_STYLE_MODES', () => {
    it('should contain all six style modes', () => {
      expect(EMOJI_ORB_STYLE_MODES).toEqual([
        'classic', 'minimal', 'playful', 'glossy', 'cute', 'symbolic',
      ]);
    });

    it('should have a label for each mode', () => {
      for (const mode of EMOJI_ORB_STYLE_MODES) {
        expect(EMOJI_ORB_STYLE_LABELS[mode]).toBeDefined();
        expect(typeof EMOJI_ORB_STYLE_LABELS[mode]).toBe('string');
        expect(EMOJI_ORB_STYLE_LABELS[mode].length).toBeGreaterThan(0);
      }
    });
  });

  describe('DEFAULT_ORB_PREFERENCE', () => {
    it('should default to "default" mode', () => {
      expect(DEFAULT_ORB_PREFERENCE.mode).toBe('default');
    });

    it('should not have emoji config by default', () => {
      expect(DEFAULT_ORB_PREFERENCE.emojiConfig).toBeUndefined();
      expect(DEFAULT_ORB_PREFERENCE.styleMode).toBeUndefined();
      expect(DEFAULT_ORB_PREFERENCE.emoji).toBeUndefined();
    });
  });

  describe('type assignability', () => {
    it('should allow creating a valid RgbColor', () => {
      const color: RgbColor = { r: 128, g: 64, b: 200 };
      expect(color.r).toBe(128);
      expect(color.g).toBe(64);
      expect(color.b).toBe(200);
    });

    it('should allow creating a valid ImageAnalysisTraits', () => {
      const traits: ImageAnalysisTraits = {
        dominantColors: [{ r: 200, g: 100, b: 50 }],
        brightness: 0.6,
        contrast: 0.4,
        warmth: 0.7,
        subjectType: 'person',
        emotion: 'happy',
        visualComplexity: 'moderate',
        hasFace: true,
        colorfulness: 0.5,
        confidence: 0.8,
      };
      expect(traits.subjectType).toBe('person');
      expect(traits.emotion).toBe('happy');
      expect(traits.hasFace).toBe(true);
    });

    it('should allow creating a valid EmojiOrbFeatureSet', () => {
      const features: EmojiOrbFeatureSet = {
        emoji: '😊',
        gradientFrom: 'oklch(0.70 0.20 30)',
        gradientMid: 'oklch(0.55 0.18 30)',
        gradientTo: 'oklch(0.35 0.12 30)',
        ringColor: 'oklch(0.50 0.18 30 / 0.30)',
        highlightColor: 'oklch(0.85 0.10 30 / 0.50)',
        glowColor: 'oklch(0.60 0.18 30 / 0.20)',
        accentColor: 'oklch(0.55 0.14 30 / 0.60)',
      };
      expect(features.emoji).toBe('😊');
      expect(features.gradientFrom).toContain('oklch');
    });

    it('should allow creating EmojiOrbConfig', () => {
      const config: EmojiOrbConfig = {
        id: 'test-config',
        styleMode: 'classic',
        features: {
          emoji: '✨',
          gradientFrom: 'oklch(0.70 0.20 285)',
          gradientMid: 'oklch(0.50 0.18 285)',
          gradientTo: 'oklch(0.30 0.12 285)',
          ringColor: 'oklch(0.50 0.18 285 / 0.28)',
          highlightColor: 'oklch(0.85 0.12 280 / 0.50)',
          glowColor: 'oklch(0.55 0.18 285 / 0.20)',
          accentColor: 'oklch(0.50 0.14 285 / 0.60)',
        },
        analysis: {
          dominantColors: [{ r: 128, g: 80, b: 200 }],
          brightness: 0.5,
          contrast: 0.5,
          warmth: 0.5,
          subjectType: 'unknown',
          emotion: 'neutral',
          visualComplexity: 'moderate',
          hasFace: false,
          colorfulness: 0.4,
          confidence: 0.6,
        },
        emojiCandidates: [
          { emoji: '✨', label: 'Sparkles', score: 0.9 },
        ],
      };
      expect(config.id).toBe('test-config');
      expect(config.styleMode).toBe('classic');
    });

    it('should allow creating an OrbPreferencePayload in emoji mode', () => {
      const payload: OrbPreferencePayload = {
        mode: 'emoji',
        emojiConfig: {
          emoji: '🔥',
          gradientFrom: 'oklch(0.80 0.20 50)',
          gradientMid: 'oklch(0.60 0.18 50)',
          gradientTo: 'oklch(0.35 0.12 50)',
          ringColor: 'oklch(0.55 0.18 50 / 0.30)',
          highlightColor: 'oklch(0.90 0.10 50 / 0.50)',
          glowColor: 'oklch(0.65 0.18 50 / 0.20)',
          accentColor: 'oklch(0.55 0.14 50 / 0.60)',
        },
        styleMode: 'playful',
        emoji: '🔥',
      };
      expect(payload.mode).toBe('emoji');
      expect(payload.emoji).toBe('🔥');
    });

    it('should support all EmojiOrbFlowState variants', () => {
      const states: EmojiOrbFlowState[] = [
        { status: 'idle' },
        { status: 'uploading' },
        { status: 'analyzing', imageDataUrl: 'data:image/png;base64,...' },
        {
          status: 'generating',
          imageDataUrl: 'data:image/png;base64,...',
          traits: {
            dominantColors: [],
            brightness: 0.5,
            contrast: 0.5,
            warmth: 0.5,
            subjectType: 'unknown',
            emotion: 'neutral',
            visualComplexity: 'simple',
            hasFace: false,
            colorfulness: 0.3,
            confidence: 0.5,
          },
        },
        { status: 'saving' },
        { status: 'error', message: 'Something went wrong' },
      ];
      expect(states).toHaveLength(6);
      expect(states[0].status).toBe('idle');
      expect(states[5].status).toBe('error');
    });
  });

  describe('subject types', () => {
    it('should cover all expected subject types', () => {
      const types: SubjectType[] = ['person', 'animal', 'object', 'scene', 'abstract', 'text', 'unknown'];
      expect(types).toHaveLength(7);
    });
  });

  describe('emotion tones', () => {
    it('should cover all expected emotion tones', () => {
      const tones: EmotionTone[] = ['happy', 'calm', 'energetic', 'serious', 'playful', 'warm', 'cool', 'neutral'];
      expect(tones).toHaveLength(8);
    });
  });

  describe('orb appearance modes', () => {
    it('should support default and emoji modes', () => {
      const modes: OrbAppearanceMode[] = ['default', 'emoji'];
      expect(modes).toHaveLength(2);
    });
  });
});
