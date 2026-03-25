/**
 * EmojiOrbCustomizer — Upload an image and generate an emoji-style orb appearance.
 *
 * Full flow:
 *  1. User uploads an image
 *  2. Client-side analysis extracts visual traits
 *  3. Multiple emoji orb style variants are generated
 *  4. User previews and selects a variant
 *  5. User can change the emoji and style mode
 *  6. Save applies the orb appearance globally and persists it
 *  7. Reset reverts to the default orb
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CompanionOrb } from '@/components/CompanionOrb';
import { useOrbAppearance } from '@/context/orb-appearance-context';
import {
  analyzeImageForOrb,
  generateEmojiOrbVariants,
  regenerateOrbConfig,
  readFileAsDataUrl,
} from '@/services/emoji-orb-service';
import type {
  EmojiOrbFlowState,
  EmojiOrbConfig,
  EmojiOrbStyleMode,
  ImageAnalysisTraits,
} from '@/types/emoji-orb';
import {
  EMOJI_ORB_STYLE_LABELS,
  EMOJI_ORB_STYLE_MODES,
  ORB_COLOR_LABELS,
} from '@/types/emoji-orb';
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { FloppyDisk } from '@phosphor-icons/react/FloppyDisk';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { MagicWand } from '@phosphor-icons/react/MagicWand';
import { Spinner } from '@phosphor-icons/react/Spinner';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { XCircle } from '@phosphor-icons/react/XCircle';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { validateMediaFile } from '@/types/media';

export function EmojiOrbCustomizer() {
  const { mode, orbColor, emojiFeatures, applyEmojiOrb, setOrbColor, resetToDefault } = useOrbAppearance();
  const [flowState, setFlowState] = useState<EmojiOrbFlowState>({ status: 'idle' });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (file: File) => {
    // Validate
    const validation = validateMediaFile(file);
    if (!validation.valid || validation.fileType !== 'image') {
      setFlowState({ status: 'error', message: validation.error ?? 'Please upload a valid image file (JPEG, PNG, GIF, or WebP).' });
      return;
    }

    try {
      // Read file as data URL for preview
      setFlowState({ status: 'uploading' });
      const imageDataUrl = await readFileAsDataUrl(file);

      // Analyze
      setFlowState({ status: 'analyzing', imageDataUrl });
      const traits = await analyzeImageForOrb(file);

      // Generate variants
      setFlowState({ status: 'generating', imageDataUrl, traits });
      const variants = generateEmojiOrbVariants(traits);

      setFlowState({
        status: 'preview-ready',
        imageDataUrl,
        traits,
        variants,
        selectedIndex: 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setFlowState({ status: 'error', message: msg });
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [handleFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  // ── Style / emoji selection ────────────────────────────────────────────────
  const selectVariant = useCallback((index: number) => {
    setFlowState(prev => {
      if (prev.status !== 'preview-ready') return prev;
      return { ...prev, selectedIndex: index };
    });
  }, []);

  const changeEmoji = useCallback((emoji: string) => {
    setFlowState(prev => {
      if (prev.status !== 'preview-ready') return prev;
      const selectedConfig = prev.variants[prev.selectedIndex];
      if (!selectedConfig) return prev;
      const updated = regenerateOrbConfig(prev.traits, selectedConfig.styleMode, emoji);
      const newVariants = [...prev.variants];
      newVariants[prev.selectedIndex] = updated;
      return { ...prev, variants: newVariants };
    });
  }, []);

  const changeStyleMode = useCallback((styleMode: EmojiOrbStyleMode, traits: ImageAnalysisTraits, currentEmoji: string) => {
    setFlowState(prev => {
      if (prev.status !== 'preview-ready') return prev;
      const updated = regenerateOrbConfig(traits, styleMode, currentEmoji);
      const idx = EMOJI_ORB_STYLE_MODES.indexOf(styleMode);
      const newVariants = [...prev.variants];
      if (idx >= 0 && idx < newVariants.length) {
        newVariants[idx] = updated;
      }
      return { ...prev, variants: newVariants, selectedIndex: idx >= 0 ? idx : prev.selectedIndex };
    });
  }, []);

  // ── Save / Reset ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (flowState.status !== 'preview-ready') return;
    const config = flowState.variants[flowState.selectedIndex];
    if (!config) return;

    setSaving(true);
    try {
      await applyEmojiOrb(config.features, config.styleMode, config.features.emoji);
      setFlowState({ status: 'idle' });
    } catch {
      // Toast handled by context
    } finally {
      setSaving(false);
    }
  }, [flowState, applyEmojiOrb]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    try {
      await resetToDefault();
      setFlowState({ status: 'idle' });
    } catch {
      // Toast handled by context
    } finally {
      setSaving(false);
    }
  }, [resetToDefault]);

  const handleRestart = useCallback(() => {
    setFlowState({ status: 'idle' });
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isProcessing = flowState.status === 'uploading' || flowState.status === 'analyzing' || flowState.status === 'generating';
  const selectedConfig: EmojiOrbConfig | null =
    flowState.status === 'preview-ready' ? (flowState.variants[flowState.selectedIndex] ?? null) : null;

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Label className="text-sm font-semibold">Orb Color</Label>
          <span className="text-xs text-muted-foreground">{ORB_COLOR_LABELS[orbColor]}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ORB_COLOR_LABELS) as Array<keyof typeof ORB_COLOR_LABELS>).map((theme) => (
            <button
              key={theme}
              onClick={() => setOrbColor(theme)}
              className={cn(
                'focus-ring-lux rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                orbColor === theme
                  ? 'border-primary bg-primary/12 text-foreground'
                  : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border/90'
              )}
              type="button"
            >
              {ORB_COLOR_LABELS[theme]}
            </button>
          ))}
        </div>
      </Card>

      {/* Current Orb Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2.5 h-2.5 rounded-full',
            mode === 'emoji' ? 'bg-green-500' : 'bg-muted-foreground/40',
          )} />
          <span className="text-sm text-muted-foreground">
            {mode === 'emoji' ? 'Emoji orb active' : 'Default orb active'}
          </span>
        </div>
        {mode === 'emoji' && (
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleReset} disabled={saving}>
            <ArrowCounterClockwise size={14} />
            Reset to Default
          </Button>
        )}
      </div>

      {/* Upload Area */}
      <AnimatePresence mode="wait">
        {flowState.status === 'idle' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className="relative border-dashed border-2 border-muted-foreground/20 hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <UploadSimple size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">Upload an image to generate your emoji orb</p>
                <p className="text-xs text-muted-foreground">
                  Drop an image here or click to browse. Supports JPEG, PNG, GIF, WebP (max 10 MB).
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleInputChange}
                aria-label="Upload image for emoji orb"
              />
            </Card>
          </motion.div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-8">
              <div className="flex flex-col items-center gap-4">
                {/* Show uploaded image preview */}
                {(flowState.status === 'analyzing' || flowState.status === 'generating') && (
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                    <img
                      src={flowState.imageDataUrl}
                      alt="Uploaded"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Spinner size={20} className="animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    {flowState.status === 'uploading' && 'Reading image…'}
                    {flowState.status === 'analyzing' && 'Analyzing visual traits…'}
                    {flowState.status === 'generating' && 'Generating emoji orb variants…'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">This happens locally — no data is sent to a server.</p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Error State */}
        {flowState.status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6 border-destructive/40">
              <div className="flex items-start gap-3">
                <XCircle size={20} className="text-destructive shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Analysis Failed</p>
                  <p className="text-xs text-muted-foreground">{flowState.message}</p>
                  <Button variant="outline" size="sm" onClick={handleRestart} className="gap-1.5">
                    <ArrowsClockwise size={14} />
                    Try Again
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Preview Ready */}
        {flowState.status === 'preview-ready' && selectedConfig && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Comparison: Original → Generated Orb */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MagicWand size={18} className="text-primary" />
                <h4 className="text-sm font-semibold">Preview</h4>
              </div>
              <div className="flex items-center justify-center gap-8 flex-wrap">
                {/* Original image */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border shadow-lg">
                    <img
                      src={flowState.imageDataUrl}
                      alt="Original upload"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Original</span>
                </div>

                {/* Arrow */}
                <span className="text-2xl text-muted-foreground/40">→</span>

                {/* Generated orb */}
                <div className="flex flex-col items-center gap-2">
                  <CompanionOrb
                    state="idle"
                    size="sm"
                    previewFeatures={selectedConfig.features}
                    showRipples={false}
                  />
                  <span className="text-xs text-muted-foreground">Emoji Orb</span>
                </div>
              </div>

              {/* Analysis summary */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex flex-wrap gap-2">
                  <AnalysisBadge label="Subject" value={flowState.traits.subjectType} />
                  <AnalysisBadge label="Emotion" value={flowState.traits.emotion} />
                  <AnalysisBadge label="Complexity" value={flowState.traits.visualComplexity} />
                  <AnalysisBadge
                    label="Confidence"
                    value={`${Math.round(flowState.traits.confidence * 100)}%`}
                  />
                </div>
              </div>
            </Card>

            {/* Style Selection */}
            <Card className="p-6">
              <Label className="text-sm font-semibold mb-3 block">Style Mode</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {EMOJI_ORB_STYLE_MODES.map((styleMode, idx) => (
                  <button
                    key={styleMode}
                    onClick={() => selectVariant(idx)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all text-xs',
                      flowState.selectedIndex === idx
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:border-muted-foreground/40'
                    )}
                  >
                    <span className="text-lg">{flowState.variants[idx]?.features.emoji ?? '✨'}</span>
                    <span className={cn(
                      'font-medium',
                      flowState.selectedIndex === idx ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {EMOJI_ORB_STYLE_LABELS[styleMode]}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Emoji Picker */}
            <Card className="p-6">
              <Label className="text-sm font-semibold mb-3 block">Choose Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {selectedConfig.emojiCandidates.map((candidate) => (
                  <button
                    key={candidate.emoji}
                    onClick={() => changeEmoji(candidate.emoji)}
                    className={cn(
                      'w-10 h-10 rounded-lg border flex items-center justify-center text-xl transition-all',
                      selectedConfig.features.emoji === candidate.emoji
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30 scale-110'
                        : 'border-border hover:border-muted-foreground/40 hover:scale-105'
                    )}
                    title={candidate.label}
                  >
                    {candidate.emoji}
                  </button>
                ))}
              </div>
            </Card>

            {/* Color Preview */}
            <Card className="p-6">
              <Label className="text-sm font-semibold mb-3 block">Generated Colors</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Primary', color: selectedConfig.features.gradientFrom },
                  { label: 'Mid', color: selectedConfig.features.gradientMid },
                  { label: 'Deep', color: selectedConfig.features.gradientTo },
                  { label: 'Ring', color: selectedConfig.features.ringColor },
                  { label: 'Glow', color: selectedConfig.features.glowColor },
                ].map(({ label, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 h-8 rounded-full border border-border shadow-sm"
                      style={{ background: color }}
                    />
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Spinner size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                Save &amp; Apply
              </Button>
              <Button variant="outline" onClick={handleRestart} disabled={saving} className="gap-1.5">
                <ArrowsClockwise size={16} />
                Upload New Image
              </Button>
              {mode === 'emoji' && (
                <Button variant="ghost" onClick={handleReset} disabled={saving} className="gap-1.5 text-muted-foreground">
                  <ArrowCounterClockwise size={16} />
                  Reset to Default
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small badge component for showing analysis traits. */
function AnalysisBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium capitalize">{value}</span>
    </span>
  );
}
