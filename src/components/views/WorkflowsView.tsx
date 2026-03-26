import { useState } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gear } from '@phosphor-icons/react/Gear';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Plus } from '@phosphor-icons/react/Plus';
import { Power } from '@phosphor-icons/react/Power';
import { Shield } from '@phosphor-icons/react/Shield';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { Trash } from '@phosphor-icons/react/Trash';
import { Wrench } from '@phosphor-icons/react/Wrench';
import { X } from '@phosphor-icons/react/X';
import type { Tool, ToolCategory } from '@/types';
import { generateId } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const TOOL_CATEGORIES: { value: ToolCategory; label: string }[] = [
  { value: 'research', label: 'Research' },
  { value: 'creation', label: 'Creation' },
  { value: 'planning', label: 'Planning' },
  { value: 'communication', label: 'Communication' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'workflow', label: 'Workflow' },
];

const CATEGORY_COLORS: Record<ToolCategory, string> = {
  research: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  creation: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  planning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  communication: 'bg-green-500/10 text-green-600 border-green-500/20',
  analysis: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  workflow: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
};

function createEmptyTool(): Omit<Tool, 'id'> {
  return {
    name: '',
    description: '',
    category: 'workflow',
    enabled: true,
    requiresApproval: false,
    config: {},
  };
}

export function WorkflowsView() {
  const [tools, setTools] = useLocalStorage<Tool[]>('tools', []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Tool, 'id'>>(createEmptyTool());

  const currentTools = tools ?? [];

  const filteredTools = currentTools.filter((tool) => {
    const matchesSearch =
      !searchQuery ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === 'all' || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const enabledCount = currentTools.filter((t) => t.enabled).length;
  const approvalCount = currentTools.filter((t) => t.requiresApproval).length;

  const handleCreateTool = () => {
    if (!formData.name.trim()) return;
    const newTool: Tool = {
      id: generateId(),
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
    };
    setTools((prev) => [...(prev ?? []), newTool]);
    setFormData(createEmptyTool());
    setShowCreateForm(false);
  };

  const handleUpdateTool = () => {
    if (!editingToolId || !formData.name.trim()) return;
    setTools((prev) =>
      (prev ?? []).map((tool) =>
        tool.id === editingToolId
          ? { ...tool, ...formData, name: formData.name.trim(), description: formData.description.trim() }
          : tool
      )
    );
    setEditingToolId(null);
    setFormData(createEmptyTool());
  };

  const handleDeleteTool = (id: string) => {
    setTools((prev) => (prev ?? []).filter((tool) => tool.id !== id));
    setDeletingToolId(null);
  };

  const handleToggleEnabled = (id: string) => {
    setTools((prev) =>
      (prev ?? []).map((tool) =>
        tool.id === id ? { ...tool, enabled: !tool.enabled } : tool
      )
    );
  };

  const handleToggleApproval = (id: string) => {
    setTools((prev) =>
      (prev ?? []).map((tool) =>
        tool.id === id ? { ...tool, requiresApproval: !tool.requiresApproval } : tool
      )
    );
  };

  const startEditing = (tool: Tool) => {
    setEditingToolId(tool.id);
    setFormData({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      enabled: tool.enabled,
      requiresApproval: tool.requiresApproval,
      config: tool.config,
    });
    setShowCreateForm(false);
  };

  const cancelEditing = () => {
    setEditingToolId(null);
    setFormData(createEmptyTool());
  };

  const openCreateForm = () => {
    setShowCreateForm(true);
    setEditingToolId(null);
    setFormData(createEmptyTool());
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="p-6 border-b border-border/75 bg-[oklch(0.18_0.014_255/0.86)] backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightning size={24} weight="fill" className="text-primary" />
            </div>
            <div>
              <p className="executive-eyebrow">Automation Operations</p>
              <h1 className="text-2xl font-bold tracking-tight">Workflows & Tools</h1>
              <p className="text-sm text-muted-foreground">
                Manage tools, permissions, and automation workflows
              </p>
            </div>
          </div>
          <Button onClick={openCreateForm} disabled={showCreateForm}>
            <Plus size={16} className="mr-1" /> Add Tool
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-muted-foreground" />
            <span className="text-muted-foreground">Total:</span>
            <span className="font-semibold">{currentTools.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Power size={16} className="text-green-500" />
            <span className="text-muted-foreground">Enabled:</span>
            <span className="font-semibold">{enabledCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-500" />
            <span className="text-muted-foreground">Requires Approval:</span>
            <span className="font-semibold">{approvalCount}</span>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="px-6 pt-4 pb-2 space-y-3 bg-[oklch(0.18_0.014_255/0.55)]">
        <div className="relative">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Search tools by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {TOOL_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="px-6 pt-2">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6 border-primary/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Gear size={18} className="text-primary" />
                  New Tool
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X size={16} />
                </Button>
              </div>
              <ToolForm
                formData={formData}
                onChange={setFormData}
                onSubmit={handleCreateTool}
                onCancel={() => setShowCreateForm(false)}
                submitLabel="Create Tool"
              />
            </Card>
          </motion.div>
        </div>
      )}

      {/* Tool grid */}
      <ScrollArea className="flex-1 px-6 py-4">
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredTools.map((tool) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {editingToolId === tool.id ? (
                  <Card className="p-5 border-primary/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <PencilSimple size={18} className="text-primary" />
                        Edit Tool
                      </h3>
                      <Button variant="ghost" size="sm" onClick={cancelEditing}>
                        <X size={16} />
                      </Button>
                    </div>
                    <ToolForm
                      formData={formData}
                      onChange={setFormData}
                      onSubmit={handleUpdateTool}
                      onCancel={cancelEditing}
                      submitLabel="Save Changes"
                    />
                  </Card>
                ) : (
                  <Card
                    className={cn(
                      'p-5 transition-colors',
                      !tool.enabled && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {tool.description}
                        </p>
                      </div>
                      <Switch
                        checked={tool.enabled}
                        onCheckedChange={() => handleToggleEnabled(tool.id)}
                      />
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <Badge
                        variant="outline"
                        className={cn('text-xs', CATEGORY_COLORS[tool.category])}
                      >
                        {tool.category}
                      </Badge>
                      {tool.requiresApproval && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Shield size={10} /> Approval
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Switch
                          checked={tool.requiresApproval}
                          onCheckedChange={() => handleToggleApproval(tool.id)}
                          className="scale-90"
                        />
                        Requires approval
                      </label>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(tool)}
                          className="h-8 w-8 p-0"
                        >
                          <PencilSimple size={14} />
                        </Button>
                        {deletingToolId === tool.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteTool(tool.id)}
                              className="h-8 text-xs"
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingToolId(null)}
                              className="h-8 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingToolId(tool.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
              </motion.div>
            ))}
          </div>
        ) : currentTools.length === 0 ? (
          <div className="flex items-center justify-center h-full py-16">
            <div className="text-center max-w-md">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Wrench size={32} weight="fill" className="text-primary" />
              </div>
              <h3 className="font-semibold mb-2">No tools configured</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Add your first tool to start building automated workflows and
                managing permissions.
              </p>
              <Button onClick={openCreateForm}>
                <Plus size={18} className="mr-2" /> Add Your First Tool
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <MagnifyingGlass size={32} className="text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No matching tools</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ToolFormProps {
  formData: Omit<Tool, 'id'>;
  onChange: (data: Omit<Tool, 'id'>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

function ToolForm({ formData, onChange, onSubmit, onCancel, submitLabel }: ToolFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Name</label>
        <Input
          value={formData.name}
          onChange={(e) => onChange({ ...formData, name: e.target.value })}
          placeholder="Tool name"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => onChange({ ...formData, description: e.target.value })}
          placeholder="What does this tool do?"
          className="resize-none min-h-[60px]"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Category</label>
        <Select
          value={formData.category}
          onValueChange={(val) =>
            onChange({ ...formData, category: val as ToolCategory })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {TOOL_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={formData.enabled}
            onCheckedChange={(checked) =>
              onChange({ ...formData, enabled: checked === true })
            }
          />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={formData.requiresApproval}
            onCheckedChange={(checked) =>
              onChange({ ...formData, requiresApproval: checked === true })
            }
          />
          Requires Approval
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={!formData.name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
