import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useImageMemory } from '@/hooks/use-image-memory';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Brain } from '@phosphor-icons/react/Brain';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Eye } from '@phosphor-icons/react/Eye';
import { Image as ImageIcon } from '@phosphor-icons/react/Image';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Plus } from '@phosphor-icons/react/Plus';
import { Shield } from '@phosphor-icons/react/Shield';
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap';
import { Star } from '@phosphor-icons/react/Star';
import { Tag } from '@phosphor-icons/react/Tag';
import { ThumbsDown } from '@phosphor-icons/react/ThumbsDown';
import { ThumbsUp } from '@phosphor-icons/react/ThumbsUp';
import { Trash } from '@phosphor-icons/react/Trash';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { VideoCamera } from '@phosphor-icons/react/VideoCamera';
import { X } from '@phosphor-icons/react/X';
import type { Memory, MemoryCategory, PrivacyLevel, MemoryCandidate, UploadedMedia } from '@/types';
import { generateId, getRelativeTime, formatDateTime } from '@/lib/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORIES: { value: MemoryCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'identity', label: 'Identity' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'project', label: 'Project' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'episodic', label: 'Episodic' },
  { value: 'session', label: 'Session' },
  { value: 'media', label: 'Media' },
];

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  identity: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  relationship: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  project: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  knowledge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  episodic: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  session: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  media: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
};

const PRIVACY_ICONS: Record<PrivacyLevel, string> = {
  public: 'text-emerald-500',
  private: 'text-amber-500',
  sensitive: 'text-red-500',
};

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

/** Fallback user ID used when auth is not available. */
interface MemoryFormState {
  title: string;
  content: string;
  category: MemoryCategory;
  privacyLevel: PrivacyLevel;
  tags: string;
  source: string;
}

const EMPTY_FORM: MemoryFormState = {
  title: '',
  content: '',
  category: 'knowledge',
  privacyLevel: 'private',
  tags: '',
  source: '',
};

export function MemoryView() {
  const [memories, setMemories] = useLocalStorage<Memory[]>('memories', []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<MemoryCategory | 'all'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemoryFormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Main tab: 'memories' | 'media' | 'candidates'
  const [mainTab, setMainTab] = useState<'memories' | 'media' | 'candidates'>('memories');

  // ── Image-memory pipeline (upload → AI analysis → candidate approval) ───────
  const {
    uploadState,
    analysisResult: latestAnalysis,
    candidates: hookCandidates,
    uploadAndAnalyze,
    approve: approveFromHook,
    reject: rejectFromHook,
    reset: resetImageMemory,
  } = useImageMemory();

  // Local file selection state (for the drop-zone preview)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [userTitle, setUserTitle] = useState('');
  const [userNote, setUserNote] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived upload state flags for the UI
  const isUploading = uploadState.status === 'uploading';
  const isAnalyzing = uploadState.status === 'processing';
  const uploadProgress = uploadState.status === 'uploading' ? uploadState.progress : 0;

  // Persisted media list and candidates (kept in localStorage for display)
  const [uploadedMediaList, setUploadedMediaList] = useLocalStorage<UploadedMedia[]>('memory-media', []);
  const [persistedCandidates, setPersistedCandidates] = useLocalStorage<MemoryCandidate[]>('memory-candidates', []);

  const [selectedMedia, setSelectedMedia] = useState<UploadedMedia | null>(null);

  // Merge hook candidates (from last analysis) with persisted candidates from previous sessions
  // Use a Set for O(n+m) deduplication
  const hookCandidateIds = new Set(hookCandidates.map((c) => c.id));
  const candidates: MemoryCandidate[] = [
    ...hookCandidates,
    ...(persistedCandidates || []).filter((pc) => !hookCandidateIds.has(pc.id)),
  ];
  const allMemories = memories || [];
  const allMedia = uploadedMediaList || [];
  const pendingCandidates = candidates.filter((c) => c.status === 'pending');

  const filteredMemories = allMemories.filter((m) => {
    const matchesCategory = activeCategory === 'all' || m.category === activeCategory;
    const matchesSearch =
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.content.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const pinnedMemories = filteredMemories.filter((m) => m.isPinned);
  const unpinnedMemories = filteredMemories.filter((m) => !m.isPinned);
  const sortedMemories = [...pinnedMemories, ...unpinnedMemories];

  const selectedMemory = allMemories.find((m) => m.id === selectedId);

  const handleCreate = () => {
    if (!form.title.trim() || !form.content.trim()) return;

    const newMemory: Memory = {
      id: generateId(),
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      confidence: 1.0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: form.source.trim() || 'manual',
      privacyLevel: form.privacyLevel,
      isPinned: false,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      relatedMemories: [],
    };

    setMemories((prev) => {
      const current = prev || [];
      return [newMemory, ...current];
    });
    setForm(EMPTY_FORM);
    setIsCreating(false);
    setSelectedId(newMemory.id);
  };

  const handleUpdate = () => {
    if (!editingId || !form.title.trim() || !form.content.trim()) return;

    setMemories((prev) => {
      const current = prev || [];
      return current.map((m) =>
        m.id === editingId
          ? {
              ...m,
              title: form.title.trim(),
              content: form.content.trim(),
              category: form.category,
              privacyLevel: form.privacyLevel,
              source: form.source.trim() || m.source,
              tags: form.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              updatedAt: Date.now(),
            }
          : m
      );
    });
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = (id: string) => {
    setMemories((prev) => {
      const current = prev || [];
      return current.filter((m) => m.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirmId(null);
  };

  const handleTogglePin = (id: string) => {
    setMemories((prev) => {
      const current = prev || [];
      return current.map((m) =>
        m.id === id ? { ...m, isPinned: !m.isPinned, updatedAt: Date.now() } : m
      );
    });
  };

  const startEditing = (memory: Memory) => {
    setEditingId(memory.id);
    setIsCreating(false);
    setForm({
      title: memory.title,
      content: memory.content,
      category: memory.category,
      privacyLevel: memory.privacyLevel,
      tags: memory.tags.join(', '),
      source: memory.source,
    });
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingId(null);
    setSelectedId(null);
    setForm(EMPTY_FORM);
  };

  // ── Media upload handlers ─────────────────────────────────────────────────

  const handleMediaFile = useCallback((file: File) => {
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      toast.error('Unsupported file type. Use JPEG, PNG, WebP, MP4, or WebM.');
      return;
    }
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      toast.error(`File too large. Max ${maxSize / 1024 / 1024} MB for ${isImage ? 'images' : 'videos'}.`);
      return;
    }

    const preview = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaPreviewUrl(preview);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleMediaFile(file);
  }, [handleMediaFile]);

  const clearMediaUpload = useCallback(() => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setUserTitle('');
    setUserNote('');
    resetImageMemory();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [mediaPreviewUrl, resetImageMemory]);

  const handleAnalyzeMedia = async () => {
    if (!mediaFile) return;

    await uploadAndAnalyze(mediaFile, {
      userTitle: userTitle.trim() || undefined,
      userNote: userNote.trim() || undefined,
    });
  };

  // Sync hook analysis result into persistent localStorage lists
  // so the media list and candidates survive page refreshes
  const prevAnalysisRef = useRef<string | null>(null);

  useEffect(() => {
    if (uploadState.status === 'complete' && latestAnalysis) {
      if (latestAnalysis.id === prevAnalysisRef.current) return;
      prevAnalysisRef.current = latestAnalysis.id;

      setUploadedMediaList((prev) => [latestAnalysis, ...(prev || [])]);
      const newCandidates = latestAnalysis.memory_candidates || [];
      if (newCandidates.length > 0) {
        const newCandidateIds = new Set(newCandidates.map((nc) => nc.id));
        setPersistedCandidates((prev) => [
          ...newCandidates,
          ...(prev || []).filter((pc) => !newCandidateIds.has(pc.id)),
        ]);
        toast.success(
          `Analysis complete! ${newCandidates.length} memory candidate${newCandidates.length > 1 ? 's' : ''} found.`,
        );
        setMainTab('candidates');
      } else {
        toast.success('Media analyzed and saved to knowledge.');
      }
      // Clear file selection after successful analysis
      setMediaFile((prev) => {
        if (prev && mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
        return null;
      });
      setMediaPreviewUrl(null);
      setUserTitle('');
      setUserNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    if (uploadState.status === 'error' && latestAnalysis?.processing_state === 'failed') {
      if (latestAnalysis.id === prevAnalysisRef.current) return;
      prevAnalysisRef.current = latestAnalysis.id;

      setUploadedMediaList((prev) => [latestAnalysis, ...(prev || [])]);
      toast.error('Analysis failed. Media saved without AI analysis.');
      setMediaFile((prev) => {
        if (prev && mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
        return null;
      });
      setMediaPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadState.status, latestAnalysis?.id]);

  // ── Candidate approval handlers ───────────────────────────────────────────

  const approveCandidate = async (candidate: MemoryCandidate) => {
    // Persist to the backend memory pipeline via the hook.
    // The hook calls media-memory?action=approve which stores the memory in
    // episodic_memory or relationship_memory (retrievable by the AI in future sessions).
    await approveFromHook(candidate);

    // Also add to the local memory list for immediate display in the Memories tab
    const newMemory: Memory = {
      id: generateId(),
      title: candidate.title,
      content: candidate.content,
      category: candidate.category,
      confidence: candidate.confidence,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'media-analysis',
      privacyLevel: candidate.privacy_level,
      isPinned: false,
      tags: Array.isArray(candidate.tags) ? candidate.tags : [],
      relatedMemories: [],
      mediaId: candidate.media_id || undefined,
    };

    setMemories((prev) => [newMemory, ...(prev || [])]);
    // Sync approval status into persisted candidates
    setPersistedCandidates((prev) =>
      (prev || []).map((c) =>
        c.id === candidate.id ? { ...c, status: 'approved' as const } : c
      ),
    );
    toast.success('Memory saved!');
  };

  const rejectCandidate = async (candidateId: string) => {
    await rejectFromHook(candidateId);
    // Sync rejection status into persisted candidates
    setPersistedCandidates((prev) =>
      (prev || []).map((c) =>
        c.id === candidateId ? { ...c, status: 'rejected' as const } : c
      ),
    );
  };

  const renderForm = (isEdit: boolean) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isEdit ? 'Edit Memory' : 'Create New Memory'}
        </h2>
        <Button variant="ghost" size="sm" onClick={cancelForm}>
          <X size={16} />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Title</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Memory title..."
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Content</label>
          <Textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="What do you want to remember?"
            className="min-h-[120px] resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Category</label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as MemoryCategory }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Privacy</label>
            <Select
              value={form.privacyLevel}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, privacyLevel: v as PrivacyLevel }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="sensitive">Sensitive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Tags</label>
          <Input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="Comma-separated tags..."
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Source</label>
          <Input
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            placeholder="Where did this come from?"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={isEdit ? handleUpdate : handleCreate}
            disabled={!form.title.trim() || !form.content.trim()}
          >
            <CheckCircle size={16} className="mr-1.5" />
            {isEdit ? 'Save Changes' : 'Create Memory'}
          </Button>
          <Button variant="outline" onClick={cancelForm}>
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderDetail = (memory: Memory) => (
    <motion.div
      key={memory.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold mb-2">{memory.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-xs', CATEGORY_COLORS[memory.category])}>
              {memory.category}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(memory.confidence * 100)}% confidence
            </span>
            <div className="flex items-center gap-1">
              <Shield size={12} className={PRIVACY_ICONS[memory.privacyLevel]} />
              <span className="text-xs text-muted-foreground">{memory.privacyLevel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTogglePin(memory.id)}
            title={memory.isPinned ? 'Unpin' : 'Pin'}
          >
            <Star
              size={16}
              weight={memory.isPinned ? 'fill' : 'regular'}
              className={memory.isPinned ? 'text-accent' : 'text-muted-foreground'}
            />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => startEditing(memory)}>
            <PencilSimple size={16} />
          </Button>
          {deleteConfirmId === memory.id ? (
            <div className="flex items-center gap-1">
              <Button variant="destructive" size="sm" onClick={() => handleDelete(memory.id)}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>
                <X size={14} />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirmId(memory.id)}
            >
              <Trash size={16} className="text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{memory.content}</p>
      </Card>

      {memory.tags.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag size={14} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {memory.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Source</span>
          <span>{memory.source}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Created</span>
          <span>{formatDateTime(memory.createdAt)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Updated</span>
          <span>{formatDateTime(memory.updatedAt)}</span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Top-level tabs: Memories | Media | Candidates */}
      <div className="border-b border-border/75 px-4 pt-3 pb-0 bg-[oklch(0.18_0.014_255/0.86)] backdrop-blur-sm flex items-center gap-4">
        <div className="flex items-center gap-1">
          {(['memories', 'media', 'candidates'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-t-md transition-colors relative',
                mainTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'memories' && 'Memories'}
              {tab === 'media' && 'Media Upload'}
              {tab === 'candidates' && (
                <span className="flex items-center gap-1.5">
                  Review
                  {pendingCandidates.length > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {pendingCandidates.length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Memories Tab ─────────────────────────────────────────────────────── */}
      {mainTab === 'memories' && (
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Left panel — memory list */}
          <div className="w-full md:w-80 border-r border-border/75 flex flex-col bg-[oklch(0.18_0.014_255/0.82)] backdrop-blur-sm">
            <div className="p-4 border-b border-border/75">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Memories</h2>
                <Button size="sm" onClick={startCreating} className="min-h-[44px]">
                  <Plus size={16} className="mr-1" /> New
                </Button>
              </div>
              <div className="relative">
                <MagnifyingGlass
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search memories..."
                  className="w-full pl-9 pr-3 py-2 bg-background/80 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="px-2 pt-2">
              <Tabs
                value={activeCategory}
                onValueChange={(v) => setActiveCategory(v as MemoryCategory | 'all')}
              >
                <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0">
                  {CATEGORIES.map((c) => (
                    <TabsTrigger
                      key={c.value}
                      value={c.value}
                      className="text-xs px-2 py-1 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
                    >
                      {c.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sortedMemories.map((memory) => (
                  <button
                    key={memory.id}
                    onClick={() => {
                      setSelectedId(memory.id);
                      setIsCreating(false);
                      setEditingId(null);
                      setForm(EMPTY_FORM);
                    }}
                    className={cn(
                      'w-full p-3 rounded-lg text-left transition-colors relative',
                      selectedId === memory.id
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : 'hover:bg-muted/60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium line-clamp-1 flex-1">
                        {memory.isPinned && (
                          <Star size={12} weight="fill" className="text-accent inline mr-1" />
                        )}
                        {memory.mediaId && (
                          <ImageSquare size={12} className="text-cyan-500 inline mr-1" />
                        )}
                        {memory.title}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {Math.round(memory.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                      {memory.content}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1.5 py-0', CATEGORY_COLORS[memory.category])}
                      >
                        {memory.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {getRelativeTime(memory.updatedAt)}
                      </span>
                    </div>
                  </button>
                ))}

                {allMemories.length > 0 && sortedMemories.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">No memories match your filters</p>
                  </div>
                )}

                {allMemories.length === 0 && (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                      <Brain size={24} weight="fill" className="text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">No memories yet</p>
                    <Button size="sm" onClick={startCreating}>
                      Create Your First Memory
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Main content area */}
          {isCreating ? (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">{renderForm(false)}</ScrollArea>
            </div>
          ) : editingId ? (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">{renderForm(true)}</ScrollArea>
            </div>
          ) : selectedMemory ? (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">{renderDetail(selectedMemory)}</ScrollArea>
            </div>
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Brain size={32} weight="fill" className="text-primary" />
                </div>
                <h3 className="font-semibold mb-2">
                  {allMemories.length === 0 ? 'Start building your memory' : 'No memory selected'}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {allMemories.length === 0
                    ? 'Upload photos and videos so your AI can learn from them, or create memories manually.'
                    : 'Select a memory from the list or create a new one.'}
                </p>
                <div className="flex items-center gap-3 justify-center">
                  <Button onClick={startCreating}>
                    <Plus size={18} className="mr-2" /> New Memory
                  </Button>
                  <Button variant="outline" onClick={() => setMainTab('media')}>
                    <UploadSimple size={18} className="mr-2" /> Upload Media
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Media Upload Tab ──────────────────────────────────────────────────── */}
      {mainTab === 'media' && (
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Left: uploaded media list */}
          <div className="w-full md:w-80 border-r border-border flex flex-col bg-card">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Uploaded Media</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {allMedia.length} item{allMedia.length !== 1 ? 's' : ''}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {allMedia.length === 0 && (
                  <div className="p-8 text-center">
                    <ImageSquare size={28} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No media uploaded yet</p>
                  </div>
                )}
                {allMedia.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMedia(m)}
                    className={cn(
                      'w-full p-3 rounded-lg text-left transition-colors flex gap-3',
                      selectedMedia?.id === m.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted'
                    )}
                  >
                    {m.public_url ? (
                      m.media_type === 'image' ? (
                        <img
                          src={m.public_url}
                          alt={m.user_title || m.filename}
                          className="w-12 h-12 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                          <VideoCamera size={20} className="text-muted-foreground" />
                        </div>
                      )
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                        <ImageIcon size={20} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">
                        {m.user_title || m.filename}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {m.media_analysis?.[0]?.summary || 'Processing…'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0',
                            m.processing_state === 'done'
                              ? 'text-emerald-600 border-emerald-500/20'
                              : m.processing_state === 'failed'
                              ? 'text-red-500 border-red-500/20'
                              : 'text-amber-500 border-amber-500/20'
                          )}
                        >
                          {m.processing_state}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right: upload form or media detail */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedMedia ? (
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg font-semibold">
                      {selectedMedia.user_title || selectedMedia.filename}
                    </h2>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMedia(null)}>
                      <X size={16} />
                    </Button>
                  </div>

                  {selectedMedia.public_url && (
                    <div className="rounded-lg overflow-hidden bg-black/5 max-h-72">
                      {selectedMedia.media_type === 'image' ? (
                        <img
                          src={selectedMedia.public_url}
                          alt={selectedMedia.user_title || selectedMedia.filename}
                          className="w-full object-contain max-h-72"
                        />
                      ) : (
                        <video
                          src={selectedMedia.public_url}
                          controls
                          className="w-full max-h-72"
                        />
                      )}
                    </div>
                  )}

                  {selectedMedia.media_analysis && selectedMedia.media_analysis.length > 0 && (
                    <>
                      <div>
                        <h3 className="text-sm font-semibold mb-2">AI Analysis</h3>
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {selectedMedia.media_analysis[0].summary ||
                              selectedMedia.media_analysis[0].description}
                          </p>
                        </Card>
                      </div>

                      {Array.isArray(selectedMedia.media_analysis[0].tags) &&
                        selectedMedia.media_analysis[0].tags.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Tag size={14} className="text-muted-foreground" />
                              <span className="text-xs font-medium">Tags</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(selectedMedia.media_analysis[0].tags as string[]).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                      {selectedMedia.media_analysis[0].extracted_text && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">Extracted Text</h3>
                          <Card className="p-4">
                            <p className="text-xs font-mono whitespace-pre-wrap">
                              {selectedMedia.media_analysis[0].extracted_text}
                            </p>
                          </Card>
                        </div>
                      )}

                      {selectedMedia.media_analysis[0].transcript && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">Transcript</h3>
                          <Card className="p-4">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {selectedMedia.media_analysis[0].transcript}
                            </p>
                          </Card>
                        </div>
                      )}
                    </>
                  )}

                  {selectedMedia.memory_candidates && selectedMedia.memory_candidates.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">
                          Memory Candidates ({selectedMedia.memory_candidates.length})
                        </h3>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setMainTab('candidates')}
                        >
                          <Eye size={14} className="mr-1.5" /> Review All
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {selectedMedia.memory_candidates.slice(0, 3).map((c) => (
                          <Card key={c.id} className="p-3">
                            <p className="text-sm font-medium">{c.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {c.content}
                            </p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>File</span>
                      <span>{selectedMedia.filename}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="capitalize">{selectedMedia.media_type}</span>
                    </div>
                    {selectedMedia.file_size_bytes && (
                      <div className="flex justify-between">
                        <span>Size</span>
                        <span>{(selectedMedia.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Uploaded</span>
                      <span>{new Date(selectedMedia.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-6 max-w-lg">
                  <h2 className="text-lg font-semibold mb-1">Upload Photo or Video</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Vuk will analyze the media and suggest memories to remember.
                  </p>

                  {/* Drop zone */}
                  {!mediaFile && (
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        // Only deactivate if the cursor leaves the drop zone entirely
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragActive(false);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors mb-4',
                        dragActive
                          ? 'border-primary bg-primary/5'
                          : 'border-muted-foreground/30 hover:border-primary/50'
                      )}
                    >
                      <UploadSimple size={36} className="text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          Drag & drop or{' '}
                          <span className="text-primary font-medium">browse</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Images up to 10 MB · Videos up to 100 MB
                        </p>
                      </div>
                      <label htmlFor="memory-media-upload" className="sr-only">
                        Upload image or video
                      </label>
                      <input
                        id="memory-media-upload"
                        ref={fileInputRef}
                        type="file"
                        accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaFile(f); }}
                        className="hidden"
                        title="Upload image or video"
                        aria-label="Upload image or video"
                      />
                    </div>
                  )}

                  {/* Preview */}
                  {mediaFile && mediaPreviewUrl && (
                    <div className="rounded-xl overflow-hidden bg-black/5 mb-4 relative">
                      {mediaFile.type.startsWith('image/') ? (
                        <img
                          src={mediaPreviewUrl}
                          alt="Preview"
                          className="max-h-64 w-full object-contain"
                        />
                      ) : (
                        <video
                          src={mediaPreviewUrl}
                          controls
                          className="max-h-64 w-full"
                        />
                      )}
                      {!isUploading && !isAnalyzing && (
                        <button
                          onClick={clearMediaUpload}
                          className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                          title="Remove media preview"
                          aria-label="Remove media preview"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Upload progress */}
                  {(isUploading || isAnalyzing) && (
                    <div className="space-y-1.5 mb-4">
                      <Progress value={isAnalyzing ? 100 : uploadProgress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground text-center">
                        {isUploading
                          ? `Uploading… ${Math.round(uploadProgress)}%`
                          : 'Analyzing media with AI…'}
                      </p>
                    </div>
                  )}

                  {/* Metadata fields */}
                  {mediaFile && !isUploading && !isAnalyzing && (
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Title <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <Input
                          value={userTitle}
                          onChange={(e) => setUserTitle(e.target.value)}
                          placeholder="E.g. Trip to Miami, My dog Max…"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Note <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <Textarea
                          value={userNote}
                          onChange={(e) => setUserNote(e.target.value)}
                          placeholder="Describe what this media means or what to remember…"
                          className="min-h-[80px] resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {mediaFile && !isUploading && !isAnalyzing && (
                    <div className="flex gap-3">
                      <Button onClick={handleAnalyzeMedia}>
                        <SpinnerGap size={16} className="mr-1.5" />
                        Analyze & Remember
                      </Button>
                      <Button variant="outline" onClick={clearMediaUpload}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      {/* ── Candidates Review Tab ──────────────────────────────────────────────── */}
      {mainTab === 'candidates' && (
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Memory Review</h2>
                <p className="text-sm text-muted-foreground">
                  Potential memories detected. Approve what you want to keep.
                </p>
              </div>
              <Badge variant="outline" className="text-sm">
                {pendingCandidates.length} pending
              </Badge>
            </div>

            {pendingCandidates.length === 0 && (
              <div className="text-center py-16">
                <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No pending memories to review. Upload media to generate new suggestions.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setMainTab('media')}
                >
                  <UploadSimple size={16} className="mr-1.5" /> Upload Media
                </Button>
              </div>
            )}

            <div className="space-y-4">
              <AnimatePresence>
                {pendingCandidates.map((candidate) => (
                  <motion.div
                    key={candidate.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge
                              className={cn(
                                'text-xs',
                                CATEGORY_COLORS[candidate.category] || CATEGORY_COLORS.episodic
                              )}
                            >
                              {candidate.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(candidate.confidence * 100)}% confidence
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold">{candidate.title}</h3>
                        </div>
                        {candidate.uploaded_media?.public_url && (
                          candidate.uploaded_media.media_type === 'image' ? (
                            <img
                              src={candidate.uploaded_media.public_url}
                              alt={candidate.uploaded_media.user_title || ''}
                              className="w-14 h-14 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <VideoCamera size={20} className="text-muted-foreground" />
                            </div>
                          )
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                        {candidate.content}
                      </p>

                      {Array.isArray(candidate.tags) && candidate.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {(candidate.tags as string[]).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          onClick={() => approveCandidate(candidate)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <ThumbsUp size={14} className="mr-1.5" /> Remember
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectCandidate(candidate.id)}
                        >
                          <ThumbsDown size={14} className="mr-1.5" /> Forget
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Show previously decided candidates */}
            {(candidates || []).filter((c) => c.status !== 'pending').length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Previously Reviewed
                </h3>
                <div className="space-y-2">
                  {(candidates || [])
                    .filter((c) => c.status !== 'pending')
                    .slice(0, 10)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="text-sm">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{c.category}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            c.status === 'approved'
                              ? 'text-emerald-600 border-emerald-500/30'
                              : 'text-muted-foreground'
                          }
                        >
                          {c.status}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
