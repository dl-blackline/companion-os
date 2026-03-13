import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Brain,
  Plus,
  MagnifyingGlass,
  Star,
  Trash,
  PencilSimple,
  Tag,
  Shield,
  CheckCircle,
  X,
  Terminal,
  FloppyDisk,
} from '@phosphor-icons/react';
import type { Memory, MemoryCategory, PrivacyLevel } from '@/types';
import { generateId, getRelativeTime, formatDateTime } from '@/lib/helpers';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: MemoryCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'identity', label: 'Identity' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'project', label: 'Project' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'episodic', label: 'Episodic' },
  { value: 'session', label: 'Session' },
];

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  identity: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  relationship: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  project: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  knowledge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  episodic: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  session: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

const PRIVACY_ICONS: Record<PrivacyLevel, string> = {
  public: 'text-emerald-500',
  private: 'text-amber-500',
  sensitive: 'text-red-500',
};

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
  const [customInstructions, setCustomInstructions] = useLocalStorage<string>('memory-instructions', '');
  const [instructionDraft, setInstructionDraft] = useState<string>(customInstructions ?? '');
  const [instructionSaved, setInstructionSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const allMemories = memories || [];

  const saveInstructions = () => {
    setCustomInstructions(instructionDraft);
    setInstructionSaved(true);
    if (savedTimerRef.current !== null) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => {
      setInstructionSaved(false);
      savedTimerRef.current = null;
    }, 2000);
  };

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
    <div className="flex flex-col h-full">
      {/* Custom Instructions Banner */}
      <div className="border-b border-border bg-card/50 p-4 shrink-0">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <Terminal size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold">Custom Instructions</h3>
              <span className="text-xs text-muted-foreground">
                — Applied whenever possible
              </span>
            </div>
            <Textarea
              value={instructionDraft}
              onChange={(e) => setInstructionDraft(e.target.value)}
              placeholder="Enter instructions your AI should follow (e.g. 'Always respond in a casual tone', 'Call me by my nickname', 'Prefer concise answers')…"
              className="min-h-[72px] resize-none text-sm mb-2"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={saveInstructions}
                disabled={instructionDraft === (customInstructions ?? '')}
              >
                <FloppyDisk size={14} className="mr-1.5" />
                {instructionSaved ? 'Saved!' : 'Save Instructions'}
              </Button>
              {instructionDraft !== (customInstructions ?? '') && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setInstructionDraft(customInstructions ?? '')}
                >
                  Discard
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
      {/* Left panel — memory list */}
      <div className="w-full md:w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
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
              className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-medium line-clamp-1 flex-1">
                    {memory.isPinned && (
                      <Star size={12} weight="fill" className="text-accent inline mr-1" />
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
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">{renderForm(false)}</ScrollArea>
        </div>
      ) : editingId ? (
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">{renderForm(true)}</ScrollArea>
        </div>
      ) : selectedMemory ? (
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">{renderDetail(selectedMemory)}</ScrollArea>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Brain size={32} weight="fill" className="text-primary" />
            </div>
            <h3 className="font-semibold mb-2">
              {allMemories.length === 0
                ? 'Start building your memory'
                : 'No memory selected'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {allMemories.length === 0
                ? 'Memories help your companion remember important details, preferences, and context across conversations.'
                : 'Select a memory from the list or create a new one to get started.'}
            </p>
            <Button onClick={startCreating}>
              <Plus size={18} className="mr-2" /> Create New Memory
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
