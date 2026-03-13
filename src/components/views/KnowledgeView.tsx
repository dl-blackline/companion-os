import { useState } from 'react';
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
  Books,
  Plus,
  MagnifyingGlass,
  File,
  Note,
  Link,
  CodeBlock,
  Trash,
  PencilSimple,
  Tag,
  ArrowSquareOut,
  X,
  Image as ImageIcon,
  VideoCamera,
} from '@phosphor-icons/react';
import type { KnowledgeItem } from '@/types';
import { generateId, getRelativeTime, formatDateTime } from '@/lib/helpers';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type ItemType = KnowledgeItem['type'];

const TYPE_TABS: { value: ItemType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'document', label: 'Documents' },
  { value: 'note', label: 'Notes' },
  { value: 'link', label: 'Links' },
  { value: 'snippet', label: 'Snippets' },
  { value: 'media', label: 'Media' },
];

const TYPE_COLORS: Record<ItemType, string> = {
  document: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  note: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  link: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  snippet: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  media: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
};

const TYPE_ICON_COLORS: Record<ItemType, string> = {
  document: 'text-blue-600',
  note: 'text-amber-600',
  link: 'text-emerald-600',
  snippet: 'text-violet-600',
  media: 'text-cyan-600',
};

function TypeIcon({ type, size = 16 }: { type: ItemType; size?: number }) {
  switch (type) {
    case 'document':
      return <File size={size} />;
    case 'note':
      return <Note size={size} />;
    case 'link':
      return <Link size={size} />;
    case 'snippet':
      return <CodeBlock size={size} />;
    case 'media':
      return <ImageIcon size={size} />;
  }
}

interface KnowledgeFormState {
  title: string;
  content: string;
  type: ItemType;
  category: string;
  tags: string;
  sourceUrl: string;
  summary: string;
}

const EMPTY_FORM: KnowledgeFormState = {
  title: '',
  content: '',
  type: 'note',
  category: '',
  tags: '',
  sourceUrl: '',
  summary: '',
};

export function KnowledgeView() {
  const [items, setItems] = useLocalStorage<KnowledgeItem[]>('knowledge-items', []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<ItemType | 'all'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KnowledgeFormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const allItems = items || [];

  const filteredItems = allItems.filter((item) => {
    const matchesType = activeType === 'all' || item.type === activeType;
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const sortedItems = [...filteredItems].sort((a, b) => b.updatedAt - a.updatedAt);

  const selectedItem = allItems.find((item) => item.id === selectedId);

  const handleCreate = () => {
    if (!form.title.trim() || !form.content.trim()) return;

    const newItem: KnowledgeItem = {
      id: generateId(),
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      category: form.category.trim() || 'general',
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: form.summary.trim() || undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
    };

    setItems((prev) => {
      const current = prev || [];
      return [newItem, ...current];
    });
    setForm(EMPTY_FORM);
    setIsCreating(false);
    setSelectedId(newItem.id);
  };

  const handleUpdate = () => {
    if (!editingId || !form.title.trim() || !form.content.trim()) return;

    setItems((prev) => {
      const current = prev || [];
      return current.map((item) =>
        item.id === editingId
          ? {
              ...item,
              title: form.title.trim(),
              content: form.content.trim(),
              type: form.type,
              category: form.category.trim() || item.category,
              tags: form.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              summary: form.summary.trim() || undefined,
              sourceUrl: form.sourceUrl.trim() || undefined,
              updatedAt: Date.now(),
            }
          : item
      );
    });
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = (id: string) => {
    setItems((prev) => {
      const current = prev || [];
      return current.filter((item) => item.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirmId(null);
  };

  const startEditing = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setIsCreating(false);
    setForm({
      title: item.title,
      content: item.content,
      type: item.type,
      category: item.category,
      tags: item.tags.join(', '),
      sourceUrl: item.sourceUrl || '',
      summary: item.summary || '',
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
          {isEdit ? 'Edit Item' : 'Add New Item'}
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
            placeholder="Item title..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Type</label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as ItemType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="snippet">Snippet</SelectItem>
                <SelectItem value="media">Media</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Category</label>
            <Input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. work, research..."
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Content</label>
          <Textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Write or paste content..."
            className="min-h-[160px] resize-none"
          />
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
          <label className="text-sm font-medium mb-1.5 block">
            Source URL <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Summary <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Textarea
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            placeholder="Brief summary of the content..."
            className="min-h-[80px] resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={isEdit ? handleUpdate : handleCreate}
            disabled={!form.title.trim() || !form.content.trim()}
          >
            <Plus size={16} className="mr-1.5" />
            {isEdit ? 'Save Changes' : 'Add Item'}
          </Button>
          <Button variant="outline" onClick={cancelForm}>
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderDetail = (item: KnowledgeItem) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold mb-2">{item.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-xs', TYPE_COLORS[item.type])}>
              <TypeIcon type={item.type} size={12} />
              <span className="ml-1">{item.type}</span>
            </Badge>
            <Badge variant="outline" className="text-xs">
              {item.category}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => startEditing(item)}>
            <PencilSimple size={16} />
          </Button>
          {deleteConfirmId === item.id ? (
            <div className="flex items-center gap-1">
              <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
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
              onClick={() => setDeleteConfirmId(item.id)}
            >
              <Trash size={16} className="text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {item.summary && (
        <Card className="p-4 bg-muted/50">
          <p className="text-sm italic text-muted-foreground">{item.summary}</p>
        </Card>
      )}

      {/* Media thumbnail for media-type knowledge items */}
      {item.type === 'media' && item.mediaUrl && (
        <div className="rounded-lg overflow-hidden bg-black/5 max-h-64">
          {item.mediaType === 'image' ? (
            <img
              src={item.mediaUrl}
              alt={item.title}
              className="w-full object-contain max-h-64"
            />
          ) : (
            <video src={item.mediaUrl} controls className="w-full max-h-64" />
          )}
        </div>
      )}

      <Card className="p-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.content}</p>
      </Card>

      {item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl) && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowSquareOut size={14} />
          {item.sourceUrl}
        </a>
      )}

      {item.tags.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag size={14} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Created</span>
          <span>{formatDateTime(item.createdAt)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Updated</span>
          <span>{formatDateTime(item.updatedAt)}</span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Left panel — knowledge list */}
      <div className="w-full md:w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Knowledge Vault</h2>
            <Button size="sm" onClick={startCreating} className="min-h-[44px]">
              <Plus size={16} className="mr-1" /> Add Item
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
              placeholder="Search knowledge..."
              className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="px-2 pt-2">
          <Tabs
            value={activeType}
            onValueChange={(v) => setActiveType(v as ItemType | 'all')}
          >
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0">
              {TYPE_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="text-xs px-2 py-1 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sortedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setIsCreating(false);
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className={cn(
                  'w-full p-3 rounded-lg text-left transition-colors relative',
                  selectedId === item.id
                    ? 'bg-primary/10 border-l-2 border-l-primary'
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-start gap-2 mb-1">
                  {/* Media thumbnail for media items */}
                  {item.type === 'media' && item.mediaUrl && item.mediaType === 'image' && (
                    <img
                      src={item.mediaUrl}
                      alt={item.title}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                  )}
                  {item.type === 'media' && item.mediaType === 'video' && (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <VideoCamera size={16} className="text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm font-medium line-clamp-1 flex-1 flex items-center gap-1.5">
                    <span className={cn('shrink-0', TYPE_ICON_COLORS[item.type])}>
                      <TypeIcon type={item.type} size={14} />
                    </span>
                    {item.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                  {item.content}
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] px-1.5 py-0', TYPE_COLORS[item.type])}
                  >
                    {item.type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{item.category}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {getRelativeTime(item.updatedAt)}
                  </span>
                </div>
              </button>
            ))}

            {allItems.length > 0 && sortedItems.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No items match your search</p>
              </div>
            )}

            {allItems.length === 0 && (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                  <Books size={24} weight="fill" className="text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">No knowledge yet</p>
                <Button size="sm" onClick={startCreating}>
                  Add Your First Item
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
      ) : selectedItem ? (
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">{renderDetail(selectedItem)}</ScrollArea>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Books size={32} weight="fill" className="text-primary" />
            </div>
            <h3 className="font-semibold mb-2">
              {allItems.length === 0
                ? 'Start your knowledge vault'
                : 'No item selected'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {allItems.length === 0
                ? 'Save documents, notes, links, and code snippets in one place. Build a personal knowledge base that grows with you.'
                : 'Select an item from the list or add a new one to get started.'}
            </p>
            <Button onClick={startCreating}>
              <Plus size={18} className="mr-2" /> Add New Item
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
