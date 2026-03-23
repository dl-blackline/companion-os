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
  UploadSimple,
  FloppyDisk,
  SpeakerHigh,
  SpeakerSlash,
  ArrowClockwise,
} from '@phosphor-icons/react';
import type { CompanionState, MediaGeneration, MediaStyle, VideoAudioMode, RefinementAction } from '@/types';
import { generateId } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { MediaUploader, type MediaFile } from '@/components/MediaUploader';
import { IMAGE_REFINEMENT_ACTIONS, VIDEO_REFINEMENT_ACTIONS, buildRefinementPrompt } from '@/services/media-refinement-service';
import { useAuth } from '@/context/auth-context';
import { useAIControl } from '@/context/ai-control-context';
import { runAI } from '@/services/ai-orchestrator';

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
  onSave,
}: {
  item: MediaGeneration;
  onDelete: (id: string) => void;
  onRetry: (item: MediaGeneration) => void;
  onSave?: (item: MediaGeneration) => void;
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
    }).catch(() => {
      toast.error('Failed to copy prompt');
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
            {item.status === 'complete' && item.resultUrl && onSave && (
              <Button
                size="icon"
                variant="secondary"
                className="w-7 h-7 rounded-lg bg-background/80 backdrop-blur-sm"
                title="Save to library"
                onClick={() => onSave(item)}
              >
                <FloppyDisk size={13} />
              </Button>
            )}
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
  const { user: authUser } = useAuth();
  const { orchestratorConfig } = useAIControl();
  const [activeTab, setActiveTab] = useState<MediaTab>('photo');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<MediaStyle>('photorealistic');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('1:1');
  const [gallery, setGallery] = useState<MediaGeneration[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [audioMode, setAudioMode] = useState<VideoAudioMode>('silent');

  // Upload + Refinement state
  const [showUploader, setShowUploader] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<MediaFile | null>(null);
  const [refinementAction, setRefinementAction] = useState<RefinementAction>('enhance');
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refinedUrl, setRefinedUrl] = useState<string | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);

  const styles = activeTab === 'photo' ? PHOTO_STYLES : VIDEO_STYLES;
  const imageEnabled = orchestratorConfig.capabilities.image;
  const videoEnabled = orchestratorConfig.capabilities.video;
  const canGenerateCurrentType = activeTab === 'photo' ? imageEnabled : videoEnabled;

  /** Run a single generation job for given prompt/style/ratio/type */
  const runGeneration = useCallback(
    async (jobId: string, currentPrompt: string, style: MediaStyle, ratio: AspectRatio, type: MediaTab) => {
      const size = ASPECT_RATIO_SIZES[ratio];
      setCompanionState(type === 'photo' ? 'generating-image' : 'generating-video');

      try {
        console.log('[MediaView] Starting generation:', { jobId, type, style, size });

        const mediaResult = await runAI<{
          data?: { url?: string; resultUrl?: string; prompt?: string; error?: string };
          url?: string;
          resultUrl?: string;
          prompt?: string;
          error?: string;
        }>({
          type: type === 'photo' ? 'image' : 'video',
          input: {
            prompt: currentPrompt,
            userId: authUser?.id || 'default-user',
            options: {
              style,
              size,
            },
          },
          config: orchestratorConfig,
        });

        console.log('[MediaView] Media API response:', mediaResult);

        const payload = mediaResult.data?.data ?? mediaResult.data ?? {};

        if (!mediaResult.success) {
          // Fallback to description mode when API not configured
          const errMsg = mediaResult.error ?? payload?.error ?? 'unknown';
          console.warn('Media API unavailable, falling back to description mode:', errMsg);

          const descriptionPrompt = `You are a ${type === 'photo' ? 'photo' : 'video'} generation AI system named ${aiName}.

A user has requested the following ${type === 'photo' ? 'photorealistic portrait/photo' : 'cinematic video'}:

Prompt: "${currentPrompt}"
Style: ${style}

Describe in 2-3 vivid, evocative sentences what this ${type === 'photo' ? 'photograph' : 'video'} looks like — as if describing the finished output to someone who cannot see it. Be highly specific about lighting, composition, subject, mood, and visual quality. Write in present tense as if the image/video already exists.`;

          const descriptionResult = await runAI<{ data?: { response?: string }; response?: string }>({
            type: 'chat',
            input: {
              message: descriptionPrompt,
              userId: authUser?.id || 'default-user',
              conversationId: jobId,
            },
            config: orchestratorConfig,
          });

          if (!descriptionResult.success || !descriptionResult.data) {
            throw new Error(descriptionResult.error || 'Fallback description request failed');
          }

          const data = descriptionResult.data;
          console.log('[MediaView] Chat fallback response:', descriptionResult);
          // Unwrap ok() envelope for chat response; also handle legacy raw() shape
          const description = data.data?.response ?? data.response;
          setGallery((prev) =>
            prev.map((item) =>
              item.id === jobId
                ? { ...item, status: 'complete', resultDescription: description, completedAt: Date.now() }
                : item
            )
          );
        } else {
          // Validate that a usable media URL was returned
          const resultUrl = payload.url ?? payload.resultUrl ?? '';
          if (!resultUrl) {
            console.error('[MediaView] Media API returned success but no media URL:', payload);
            throw new Error('Media generation completed but no media URL was returned');
          }

          setGallery((prev) =>
            prev.map((item) =>
              item.id === jobId
                ? {
                    ...item,
                    status: 'complete',
                    resultUrl,
                    resultDescription: payload.prompt || currentPrompt,
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
    [
      aiName,
      orchestratorConfig.max_tokens,
      orchestratorConfig.model,
      orchestratorConfig.temperature,
      setCompanionState,
    ]
  );

  const handleGenerate = async () => {
    if (!canGenerateCurrentType) {
      toast.error(`${activeTab === 'photo' ? 'Image' : 'Video'} capability is disabled in Control Center`);
      return;
    }

    if (!prompt.trim()) return;

    const newItem: MediaGeneration = {
      id: generateId(),
      type: activeTab,
      prompt: prompt.trim(),
      style: selectedStyle,
      aspectRatio: activeTab === 'photo' ? selectedRatio : undefined,
      status: 'generating',
      createdAt: Date.now(),
    };

    setGallery((prev) => [newItem, ...prev]);
    const currentPrompt = prompt.trim();
    setPrompt('');

    await runGeneration(newItem.id, currentPrompt, selectedStyle, selectedRatio, activeTab);
  };

  /** Retry a failed item using the same prompt, style, and original aspect ratio */
  const handleRetry = useCallback(
    async (item: MediaGeneration) => {
      setGallery((prev) =>
        prev.map((g) => (g.id === item.id ? { ...g, status: 'generating', completedAt: undefined } : g))
      );
      // Use the stored aspect ratio from the item, fall back to current selection
      const ratio = (item.aspectRatio as typeof selectedRatio) || selectedRatio;
      await runGeneration(item.id, item.prompt, item.style, ratio, item.type);
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
      const result = await runAI<{ data?: { response?: string }; response?: string }>({
        type: 'chat',
        input: {
          message: `You are a creative prompt engineer for AI ${activeTab} generation. Enhance the following prompt to be more vivid, specific, and detailed while preserving the original intent. Return ONLY the enhanced prompt text, nothing else.\n\nOriginal prompt: "${prompt.trim()}"`,
          userId: authUser?.id || 'default-user',
          conversationId: generateId(),
        },
        config: orchestratorConfig,
      });

      if (result.success && result.data) {
        const data = result.data.data ?? result.data;
        if (data.response) {
          setPrompt(data.response.trim().replace(/^["']/, '').replace(/["']$/, ''));
          toast.success('Prompt enhanced');
        }
      } else {
        toast.error(result.error || 'Could not enhance prompt');
      }
    } catch {
      toast.error('Could not enhance prompt');
    } finally {
      setIsEnhancing(false);
    }
  };

  /** Handle media upload selection */
  const handleUploadSelect = useCallback((media: MediaFile) => {
    setUploadedMedia(media);
    setShowUploader(false);
    setRefinedUrl(null);
    setRefinementAction('enhance');
    setRefinementPrompt('');
  }, []);

  /** Submit refinement request for uploaded media */
  const handleRefine = async () => {
    if (!uploadedMedia) return;
    setIsRefining(true);
    setCompanionState(uploadedMedia.mediaType === 'image' ? 'generating-image' : 'generating-video');

    try {
      const prompt = buildRefinementPrompt(refinementAction, refinementPrompt || undefined);
      const result = await runAI<{ data?: { url?: string; refined_url?: string }; url?: string; refined_url?: string }>({
        type: uploadedMedia.mediaType,
        input: {
          prompt,
          userId: authUser?.id || 'default-user',
          options: {
            action: refinementAction,
            media_url: uploadedMedia.previewUrl,
          },
        },
        config: orchestratorConfig,
      });

      if (result.success && result.data) {
        const data = result.data.data ?? result.data;
        if (data.url || data.refined_url) {
          setRefinedUrl(data.url || data.refined_url);
          toast.success('Media refined successfully');
        } else {
          toast.info('Refinement submitted — result will appear shortly');
        }
      } else {
        toast.error(result.error || 'Refinement failed');
      }
    } catch {
      toast.error('Could not refine media');
    } finally {
      setIsRefining(false);
      setCompanionState('idle');
    }
  };

  /** Save a generated or refined media result */
  const handleSave = async (mediaUrl: string, mediaType: 'image' | 'video', sourcePrompt?: string) => {
    if (!authUser?.id) {
      toast.error('Please sign in to save media');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/.netlify/functions/media-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          user_id: authUser.id,
          public_url: mediaUrl,
          storage_path: mediaUrl,
          filename: `companion-${mediaType}-${Date.now()}.${mediaType === 'image' ? 'png' : 'mp4'}`,
          media_type: mediaType,
          user_title: sourcePrompt,
          source: refinedUrl ? 'refinement' : 'generation',
        }),
      });

      if (res.ok) {
        toast.success('Media saved to your library');
      } else {
        const errData = await res.json().catch(() => ({ error: 'Save failed' }));
        toast.error(errData.error || 'Failed to save media');
      }
    } catch {
      toast.error('Could not save media');
    } finally {
      setIsSaving(false);
    }
  };

  /** Clear uploaded media and refinement state */
  const clearUpload = () => {
    if (uploadedMedia) {
      URL.revokeObjectURL(uploadedMedia.previewUrl);
    }
    setUploadedMedia(null);
    setRefinedUrl(null);
    setRefinementPrompt('');
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
          <p className="text-xs text-muted-foreground">Photo & video generation · Upload & refine</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Upload button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowUploader(!showUploader)}
          >
            <UploadSimple size={14} />
            Upload & Refine
          </Button>
          {/* Tab switcher */}
          <div className="flex items-center bg-card rounded-xl p-1 border border-border gap-1">
            {(['photo', 'video'] as MediaTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === 'photo' && !imageEnabled) {
                    toast.error('Image capability is disabled in Control Center');
                    return;
                  }
                  if (tab === 'video' && !videoEnabled) {
                    toast.error('Video capability is disabled in Control Center');
                    return;
                  }
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
                {tab === 'photo' && !imageEnabled ? ' (Off)' : null}
                {tab === 'video' && !videoEnabled ? ' (Off)' : null}
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

              {/* Audio mode — video only */}
              {activeTab === 'video' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Audio
                  </label>
                  <div className="flex gap-2">
                    {([
                      { value: 'silent' as VideoAudioMode, label: 'Silent', icon: <SpeakerSlash size={14} /> },
                      { value: 'with-audio' as VideoAudioMode, label: 'With Audio', icon: <SpeakerHigh size={14} /> },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAudioMode(opt.value)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200',
                          audioMode === opt.value
                            ? 'border-primary/60 bg-primary/10 text-primary'
                            : 'border-border/50 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground'
                        )}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {audioMode === 'with-audio' && (
                    <p className="text-[11px] text-muted-foreground">
                      Audio will be generated alongside the video when supported by the model
                    </p>
                  )}
                </div>
              )}

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating || !canGenerateCurrentType}
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

              {/* ─── Upload & Refinement Section ─── */}
              {showUploader && !uploadedMedia && (
                <div className="pt-2">
                  <MediaUploader
                    onSelect={handleUploadSelect}
                    onCancel={() => setShowUploader(false)}
                  />
                </div>
              )}

              {uploadedMedia && (
                <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Refine {uploadedMedia.mediaType === 'image' ? 'Photo' : 'Video'}
                    </span>
                    <button
                      onClick={clearUpload}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Original preview */}
                  <div className="relative rounded-lg overflow-hidden bg-black/5">
                    {uploadedMedia.mediaType === 'image' ? (
                      <img
                        src={uploadedMedia.previewUrl}
                        alt="Original"
                        className="max-h-40 w-full object-contain"
                      />
                    ) : (
                      <video
                        src={uploadedMedia.previewUrl}
                        controls
                        className="max-h-40 w-full object-contain"
                      />
                    )}
                    <Badge variant="outline" className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white border-0">
                      Original
                    </Badge>
                  </div>

                  {/* Refinement action selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Enhancement
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(uploadedMedia.mediaType === 'image' ? IMAGE_REFINEMENT_ACTIONS : VIDEO_REFINEMENT_ACTIONS).map((action) => (
                        <button
                          key={action.value}
                          onClick={() => setRefinementAction(action.value)}
                          className={cn(
                            'text-left p-2 rounded-lg border transition-all duration-200',
                            refinementAction === action.value
                              ? 'border-primary/60 bg-primary/10'
                              : 'border-border/50 bg-card/40 hover:border-border'
                          )}
                        >
                          <p className="text-[11px] font-semibold leading-none mb-0.5">{action.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{action.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom prompt for refinement */}
                  {(refinementAction === 'custom' || refinementAction === 'stylize') && (
                    <Textarea
                      value={refinementPrompt}
                      onChange={(e) => setRefinementPrompt(e.target.value)}
                      placeholder="Describe the enhancement you want…"
                      className="resize-none min-h-[60px] bg-card/60 border-border/60 text-xs rounded-lg"
                    />
                  )}

                  {/* Refine button */}
                  <Button
                    onClick={handleRefine}
                    disabled={isRefining || (refinementAction === 'custom' && !refinementPrompt.trim())}
                    className="w-full gap-2 rounded-xl h-10 font-semibold text-sm"
                  >
                    <ArrowClockwise size={14} className={isRefining ? 'animate-spin' : ''} />
                    {isRefining ? 'Refining…' : 'Refine Media'}
                  </Button>

                  {/* Refined result preview */}
                  {refinedUrl && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Refined result
                      </label>
                      <div className="relative rounded-lg overflow-hidden bg-black/5">
                        {uploadedMedia.mediaType === 'image' ? (
                          <img src={refinedUrl} alt="Refined" className="max-h-40 w-full object-contain" />
                        ) : (
                          <video src={refinedUrl} controls className="max-h-40 w-full object-contain" />
                        )}
                        <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px]">
                          Refined
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5 text-xs"
                          onClick={handleRefine}
                          disabled={isRefining}
                        >
                          <ArrowCounterClockwise size={12} />
                          Re-refine
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5 text-xs"
                          onClick={() => handleSave(refinedUrl, uploadedMedia.mediaType)}
                          disabled={isSaving}
                        >
                          <FloppyDisk size={12} />
                          {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                    <GenerationCard
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      onRetry={handleRetry}
                      onSave={(g) => {
                        if (g.resultUrl) {
                          handleSave(
                            g.resultUrl,
                            g.type === 'photo' ? 'image' : 'video',
                            g.prompt,
                          );
                        }
                      }}
                    />
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
