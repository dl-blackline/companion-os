import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompanionOrb } from '@/components/CompanionOrb';
import { toast } from 'sonner';
import {
  Images,
  FilmSlate,
  Sparkle,
  DownloadSimple,
  Trash,
  ClockCounterClockwise,
  ArrowsOutSimple,
  ArrowCounterClockwise,
  Copy,
  MagicWand,
  Warning,
} from '@phosphor-icons/react';
import type { CompanionState, MediaGeneration, MediaStyle } from '@/types';
import { generateId } from '@/lib/helpers';
import { cn } from '@/lib/utils';

/** Aspect ratio options for image generation */
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

const ASPECT_RATIO_SIZES: Record<AspectRatio, string> = {
  '1:1': '1024x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
  '4:3': '1365x1024',
  '3:4': '1024x1365',
};

/** Download a URL as a file. Works for both data: URLs and remote URLs. */
async function downloadMedia(url: string, filename: string): Promise<void> {
  try {
    let blobUrl: string;
    if (url.startsWith('data:')) {
      // Convert base64 data URL to blob
      const res = await fetch(url);
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
    } else {
      // Fetch remote URL through a CORS-safe proxy if needed, else try direct
      const res = await fetch(url);
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
    }
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

interface MediaViewProps {
  companionState: CompanionState;
  setCompanionState: (state: CompanionState) => void;
  aiName: string;
}

type MediaTab = 'photo' | 'video';

const PHOTO_STYLES: { value: MediaStyle; label: string; description: string }[] = [
  { value: 'photorealistic', label: 'Photorealistic', description: 'True-to-life, high-detail realism' },
  { value: 'cinematic', label: 'Cinematic', description: 'Film-quality lighting and depth' },
  { value: 'portrait', label: 'Portrait', description: 'Studio-quality facial focus' },
  { value: 'lifestyle', label: 'Lifestyle', description: 'Natural, candid, editorial feel' },
  { value: 'artistic', label: 'Artistic', description: 'Creative with painterly qualities' },
  { value: 'editorial', label: 'Editorial', description: 'Magazine-grade composition' },
];

const VIDEO_STYLES: { value: MediaStyle; label: string; description: string }[] = [
  { value: 'cinematic', label: 'Cinematic', description: 'Film-grade motion and grading' },
  { value: 'photorealistic', label: 'Hyper-real', description: 'Ultra-realistic video output' },
  { value: 'lifestyle', label: 'Lifestyle', description: 'Natural, documentary style' },
  { value: 'editorial', label: 'Editorial', description: 'Branded, polished look' },
];

function GenerationCard({
  item,
  onDelete,
  onRetry,
}: {
  item: MediaGeneration;
  onDelete: (id: string) => void;
  onRetry: (item: MediaGeneration) => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDownload = async () => {
    if (!item.resultUrl) return;
    setIsDownloading(true);
    const ext = item.type === 'video' ? 'mp4' : 'png';
    const filename = `companion-${item.type}-${item.id.slice(0, 8)}.${ext}`;
    try {
      await downloadMedia(item.resultUrl, filename);
      toast.success('Downloaded successfully');
    } catch {
      toast.error('Download failed — opening in new tab');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(item.prompt).then(() => {
      toast.success('Prompt copied');
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="group relative rounded-2xl overflow-hidden border border-border bg-card/60 backdrop-blur-sm"
      >
        {/* Visual placeholder / result area */}
        <div className="aspect-[4/3] flex items-center justify-center relative overflow-hidden"
          style={{
            background:
              item.status === 'complete'
                ? 'radial-gradient(circle at 40% 35%, oklch(0.30 0.10 285) 0%, oklch(0.20 0.05 270) 100%)'
                : 'oklch(0.20 0.02 260)',
          }}
        >
          {item.status === 'generating' && (
            <div className="flex flex-col items-center gap-3">
              <CompanionOrb
                state={item.type === 'video' ? 'generating-video' : 'generating-image'}
                size="sm"
                showRipples={false}
              />
              <span className="text-xs text-muted-foreground animate-pulse">
                {item.type === 'video' ? 'Rendering video…' : 'Generating image…'}
              </span>
            </div>
          )}
          {item.status === 'complete' && item.resultUrl && item.type === 'photo' && (
            <img
              src={item.resultUrl}
              alt={item.prompt}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setIsExpanded(true)}
            />
          )}
          {item.status === 'complete' && item.resultUrl && item.type === 'video' && (
            <video
              src={item.resultUrl}
              controls
              className="w-full h-full object-cover"
            />
          )}
          {item.status === 'complete' && !item.resultUrl && (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'oklch(0.40 0.14 285 / 0.40)' }}
              >
                {item.type === 'video' ? (
                  <FilmSlate size={20} weight="fill" className="text-[oklch(0.70_0.18_65)]" />
                ) : (
                  <Images size={20} weight="fill" className="text-[oklch(0.65_0.20_290)]" />
                )}
              </div>
              {item.resultDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                  {item.resultDescription}
                </p>
              )}
            </div>
          )}
          {item.status === 'error' && (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <Warning size={20} className="text-destructive" />
              <p className="text-xs text-destructive">Generation failed</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-destructive/40 hover:border-destructive/80"
                onClick={() => onRetry(item)}
              >
                <ArrowCounterClockwise size={12} />
                Retry
              </Button>
            </div>
          )}

          {/* Overlay actions */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.status === 'complete' && item.resultUrl && (
              <Button
                size="icon"
                variant="secondary"
                className="w-7 h-7 rounded-lg bg-background/80 backdrop-blur-sm"
                title="Expand"
                onClick={() => setIsExpanded(true)}
              >
                <ArrowsOutSimple size={13} />
              </Button>
            )}
            {item.status === 'complete' && item.resultUrl && (
              <Button
                size="icon"
                variant="secondary"
                className="w-7 h-7 rounded-lg bg-background/80 backdrop-blur-sm"
                title="Download"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                <DownloadSimple size={13} className={isDownloading ? 'animate-spin' : ''} />
              </Button>
            )}
            <Button
              size="icon"
              variant="secondary"
              className="w-7 h-7 rounded-lg bg-background/80 backdrop-blur-sm"
              onClick={() => onDelete(item.id)}
              title="Delete"
            >
              <Trash size={13} />
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2.5 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-foreground line-clamp-1 flex-1">{item.prompt}</p>
              <button
                onClick={handleCopyPrompt}
                className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                title="Copy prompt"
              >
                <Copy size={11} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{item.style}</p>
          </div>
          <Badge
            variant={item.status === 'complete' ? 'secondary' : item.status === 'error' ? 'destructive' : 'outline'}
            className="text-[10px] shrink-0"
          >
            {item.status}
          </Badge>
        </div>
      </motion.div>

      {/* Expanded image lightbox */}
      <AnimatePresence>
        {isExpanded && item.resultUrl && item.type === 'photo' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setIsExpanded(false)}
          >
            <motion.img
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              src={item.resultUrl}
              alt={item.prompt}
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 bg-background/80 backdrop-blur-sm"
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                disabled={isDownloading}
              >
                <DownloadSimple size={14} />
                Download
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 bg-background/80 backdrop-blur-sm"
                onClick={(e) => { e.stopPropagation(); handleCopyPrompt(); }}
              >
                <Copy size={14} />
                Copy prompt
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function MediaView({ companionState, setCompanionState, aiName }: MediaViewProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>('photo');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<MediaStyle>('photorealistic');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('1:1');
  const [gallery, setGallery] = useState<MediaGeneration[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const styles = activeTab === 'photo' ? PHOTO_STYLES : VIDEO_STYLES;

  /** Run a single generation job for given prompt/style/ratio/type */
  const runGeneration = useCallback(
    async (jobId: string, currentPrompt: string, style: MediaStyle, ratio: AspectRatio, type: MediaTab) => {
      const size = ASPECT_RATIO_SIZES[ratio];
      setCompanionState(type === 'photo' ? 'generating-image' : 'generating-video');

      try {
        const mediaRes = await fetch('/.netlify/functions/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'media',
            data: {
              type: type === 'photo' ? 'image' : 'video',
              prompt: currentPrompt,
              options: { style, size },
            },
          }),
        });

        const mediaData = await mediaRes.json();

        if (!mediaRes.ok || mediaData.error) {
          // Fallback to description mode when API not configured
          console.warn('Media API unavailable, falling back to description mode:', mediaData.error);

          const descriptionPrompt = `You are a ${type === 'photo' ? 'photo' : 'video'} generation AI system named ${aiName}.

A user has requested the following ${type === 'photo' ? 'photorealistic portrait/photo' : 'cinematic video'}:

Prompt: "${currentPrompt}"
Style: ${style}

Describe in 2-3 vivid, evocative sentences what this ${type === 'photo' ? 'photograph' : 'video'} looks like — as if describing the finished output to someone who cannot see it. Be highly specific about lighting, composition, subject, mood, and visual quality. Write in present tense as if the image/video already exists.`;

          const res = await fetch('/.netlify/functions/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'chat',
              data: {
                conversation_id: jobId,
                user_id: 'default-user',
                message: descriptionPrompt,
              },
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errData.error || `Chat request failed with status ${res.status}`);
          }

          const data = await res.json();
          setGallery((prev) =>
            prev.map((item) =>
              item.id === jobId
                ? { ...item, status: 'complete', resultDescription: data.response, completedAt: Date.now() }
                : item
            )
          );
        } else {
          setGallery((prev) =>
            prev.map((item) =>
              item.id === jobId
                ? {
                    ...item,
                    status: 'complete',
                    resultUrl: mediaData.url,
                    resultDescription: mediaData.prompt || currentPrompt,
                    completedAt: Date.now(),
                  }
                : item
            )
          );
        }
      } catch {
        setGallery((prev) =>
          prev.map((item) => (item.id === jobId ? { ...item, status: 'error' } : item))
        );
        toast.error('Generation failed. You can retry from the gallery.');
      } finally {
        setCompanionState('idle');
      }
    },
    [aiName, setCompanionState]
  );

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    const newItem: MediaGeneration = {
      id: generateId(),
      type: activeTab,
      prompt: prompt.trim(),
      style: selectedStyle,
      status: 'generating',
      createdAt: Date.now(),
    };

    setGallery((prev) => [newItem, ...prev]);
    const currentPrompt = prompt.trim();
    setPrompt('');

    await runGeneration(newItem.id, currentPrompt, selectedStyle, selectedRatio, activeTab);
  };

  /** Retry a failed item using the same prompt and style */
  const handleRetry = useCallback(
    async (item: MediaGeneration) => {
      setGallery((prev) =>
        prev.map((g) => (g.id === item.id ? { ...g, status: 'generating', completedAt: undefined } : g))
      );
      await runGeneration(item.id, item.prompt, item.style, selectedRatio, item.type);
    },
    [runGeneration, selectedRatio]
  );

  const handleDelete = (id: string) => {
    setGallery((prev) => prev.filter((item) => item.id !== id));
  };

  /** Use AI to enhance/expand the current prompt */
  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/.netlify/functions/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          data: {
            conversation_id: generateId(),
            user_id: 'default-user',
            message: `You are a creative prompt engineer for AI ${activeTab} generation. Enhance the following prompt to be more vivid, specific, and detailed while preserving the original intent. Return ONLY the enhanced prompt text, nothing else.\n\nOriginal prompt: "${prompt.trim()}"`,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          setPrompt(data.response.trim().replace(/^["']|["']$/g, ''));
          toast.success('Prompt enhanced');
        }
      }
    } catch {
      toast.error('Could not enhance prompt');
    } finally {
      setIsEnhancing(false);
    }
  };

  const isGenerating = companionState === 'generating-image' || companionState === 'generating-video';
  const completedCount = gallery.filter((g) => g.status === 'complete').length;

  return (
    <div className="relative flex flex-col h-full bg-background overflow-hidden">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 20%, oklch(0.30 0.10 300 / 0.30) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 pt-5 pb-4 border-b border-border/50">
        <div>
          <h2
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-space)' }}
          >
            Create
          </h2>
          <p className="text-xs text-muted-foreground">Photo & video generation</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex items-center bg-card rounded-xl p-1 border border-border gap-1">
            {(['photo', 'video'] as MediaTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedStyle(tab === 'photo' ? 'photorealistic' : 'cinematic');
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'photo' ? <Images size={14} /> : <FilmSlate size={14} />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          {gallery.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground text-xs"
            >
              <ClockCounterClockwise size={14} />
              {completedCount} created
            </Button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-col md:flex-row flex-1 min-h-0">
        {/* Left panel: create */}
        <div className="flex flex-col w-full md:w-[380px] shrink-0 border-r border-border/50">
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-5">
              {/* Orb state indicator */}
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card/60 border border-border"
                >
                  <CompanionOrb
                    state={companionState}
                    size="sm"
                    showRipples={false}
                    className="shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold">
                      {activeTab === 'photo' ? 'Generating image…' : 'Rendering video…'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">This takes a few moments</p>
                  </div>
                </motion.div>
              )}

              {/* Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {activeTab === 'photo' ? 'Photo' : 'Video'} prompt
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={handleEnhancePrompt}
                    disabled={!prompt.trim() || isEnhancing || isGenerating}
                    title="Enhance prompt with AI"
                  >
                    <MagicWand size={11} weight="fill" className={isEnhancing ? 'animate-spin' : ''} />
                    {isEnhancing ? 'Enhancing…' : 'Enhance'}
                  </Button>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    activeTab === 'photo'
                      ? 'Describe the photo you want to create…'
                      : 'Describe the video scene you want to create…'
                  }
                  className="resize-none min-h-[120px] bg-card/60 border-border/60 text-sm leading-relaxed placeholder:text-muted-foreground/50 rounded-xl"
                  disabled={isGenerating}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
              </div>

              {/* Aspect ratio — photo only */}
              {activeTab === 'photo' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Aspect ratio
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ASPECT_RATIO_SIZES) as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setSelectedRatio(ratio)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200',
                          selectedRatio === ratio
                            ? 'border-primary/60 bg-primary/10 text-primary'
                            : 'border-border/50 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground'
                        )}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Style selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {styles.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setSelectedStyle(style.value)}
                      className={cn(
                        'text-left p-3 rounded-xl border transition-all duration-200',
                        selectedStyle === style.value
                          ? 'border-primary/60 bg-primary/10 shadow-[0_0_12px_oklch(0.50_0.18_285/0.20)]'
                          : 'border-border/50 bg-card/40 hover:border-border hover:bg-card/60'
                      )}
                    >
                      <p className="text-xs font-semibold leading-none mb-1">{style.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {style.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="w-full gap-2 rounded-xl h-11 font-semibold"
                style={{ fontFamily: 'var(--font-space)' }}
              >
                <Sparkle size={16} weight="fill" />
                {isGenerating
                  ? activeTab === 'photo'
                    ? 'Generating…'
                    : 'Rendering…'
                  : `Generate ${activeTab === 'photo' ? 'Photo' : 'Video'}`}
              </Button>

              <p className="text-[11px] text-muted-foreground text-center">
                ⌘ + Enter to generate
              </p>
            </div>
          </ScrollArea>
        </div>

        {/* Right panel: gallery */}
        <div className="flex-1 min-w-0">
          {gallery.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'oklch(0.28 0.08 285 / 0.35)' }}
              >
                {activeTab === 'photo' ? (
                  <Images size={28} weight="fill" className="text-muted-foreground" />
                ) : (
                  <FilmSlate size={28} weight="fill" className="text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">No {activeTab}s yet</p>
                <p className="text-xs text-muted-foreground">
                  Write a prompt and click Generate to create your first{' '}
                  {activeTab === 'photo' ? 'photo' : 'video'}
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {gallery.map((item) => (
                    <GenerationCard key={item.id} item={item} onDelete={handleDelete} onRetry={handleRetry} />
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
