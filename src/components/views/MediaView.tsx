import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompanionOrb } from '@/components/CompanionOrb';
import {
  Images,
  FilmSlate,
  Sparkle,
  DownloadSimple,
  Trash,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import type { CompanionState, MediaGeneration, MediaStyle } from '@/types';
import { generateId } from '@/lib/helpers';
import { cn } from '@/lib/utils';

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
}: {
  item: MediaGeneration;
  onDelete: (id: string) => void;
}) {
  return (
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
            className="w-full h-full object-cover"
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
          <p className="text-xs text-destructive text-center px-4">Generation failed. Try again.</p>
        )}

        {/* Overlay actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.status === 'complete' && (
            <Button
              size="icon"
              variant="secondary"
              className="w-7 h-7 rounded-lg bg-background/80 backdrop-blur-sm"
              title="Download"
            >
              <DownloadSimple size={13} />
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
          <p className="text-xs font-medium text-foreground line-clamp-1">{item.prompt}</p>
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
  );
}

export function MediaView({ companionState, setCompanionState, aiName }: MediaViewProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>('photo');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<MediaStyle>('photorealistic');
  const [gallery, setGallery] = useState<MediaGeneration[]>([]);
  const [activeSection, setActiveSection] = useState<'create' | 'gallery'>('create');

  const styles = activeTab === 'photo' ? PHOTO_STYLES : VIDEO_STYLES;

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
    setActiveSection('gallery');
    setCompanionState(activeTab === 'photo' ? 'generating-image' : 'generating-video');

    const currentPrompt = prompt.trim();
    setPrompt('');

    try {
      // Call the media generation endpoint via the multimodal engine
      const mediaRes = await fetch('/.netlify/functions/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'media',
          data: {
            type: activeTab === 'photo' ? 'image' : 'video',
            prompt: currentPrompt,
            options: { style: selectedStyle },
          },
        }),
      });

      const mediaData = await mediaRes.json();

      if (!mediaRes.ok || mediaData.error) {
        // Media generation may not be configured — fall back to description mode
        console.warn('Media API unavailable, falling back to description mode:', mediaData.error);

        const descriptionPrompt = `You are a ${activeTab === 'photo' ? 'photo' : 'video'} generation AI system named ${aiName}.

A user has requested the following ${activeTab === 'photo' ? 'photorealistic portrait/photo' : 'cinematic video'}:

Prompt: "${currentPrompt}"
Style: ${selectedStyle}

Describe in 2-3 vivid, evocative sentences what this ${activeTab === 'photo' ? 'photograph' : 'video'} looks like — as if describing the finished output to someone who cannot see it. Be highly specific about lighting, composition, subject, mood, and visual quality. Write in present tense as if the image/video already exists.`;

        const res = await fetch('/.netlify/functions/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'chat',
            data: {
              conversation_id: newItem.id,
              user_id: 'default-user',
              message: descriptionPrompt,
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Chat API error:', res.status, errData);
          throw new Error(errData.error || `Chat request failed with status ${res.status}`);
        }

        const data = await res.json();

        setGallery((prev) =>
          prev.map((item) =>
            item.id === newItem.id
              ? {
                  ...item,
                  status: 'complete',
                  resultDescription: data.response,
                  completedAt: Date.now(),
                }
              : item
          )
        );
      } else {
        // Media generation succeeded — use the returned URL
        setGallery((prev) =>
          prev.map((item) =>
            item.id === newItem.id
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
        prev.map((item) =>
          item.id === newItem.id ? { ...item, status: 'error' } : item
        )
      );
    } finally {
      setCompanionState('idle');
    }
  };

  const handleDelete = (id: string) => {
    setGallery((prev) => prev.filter((item) => item.id !== id));
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
      <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
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
              onClick={() => setActiveSection(activeSection === 'create' ? 'gallery' : 'create')}
              className="gap-1.5 text-muted-foreground text-xs"
            >
              <ClockCounterClockwise size={14} />
              {completedCount} created
            </Button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-1 min-h-0">
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {activeTab === 'photo' ? 'Photo' : 'Video'} prompt
                </label>
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
                    <GenerationCard key={item.id} item={item} onDelete={handleDelete} />
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
