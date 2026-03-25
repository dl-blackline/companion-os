import { useState, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Circle } from '@phosphor-icons/react/Circle';
import { Clock } from '@phosphor-icons/react/Clock';
import { Flag } from '@phosphor-icons/react/Flag';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Plus } from '@phosphor-icons/react/Plus';
import { Target } from '@phosphor-icons/react/Target';
import { Trash } from '@phosphor-icons/react/Trash';
import { X } from '@phosphor-icons/react/X';
import type { Goal, Milestone, Task } from '@/types';
import { generateId, formatDate } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type Timeframe = Goal['timeframe'];
type GoalStatus = Goal['status'];
type TaskPriority = Task['priority'];

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_COLORS: Record<GoalStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  archived: 'bg-muted text-muted-foreground',
};

function formatDeadline(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calculateProgress(goal: Goal): number {
  const items = [...goal.milestones, ...goal.tasks];
  if (items.length === 0) return 0;
  const completed = items.filter((item) => item.completed).length;
  return Math.round((completed / items.length) * 100);
}

// --- Create / Edit Form ---

interface GoalFormData {
  title: string;
  description: string;
  timeframe: Timeframe;
  status: GoalStatus;
  deadline: string;
  milestones: { title: string; description: string }[];
  tasks: { title: string; priority: TaskPriority }[];
}

const EMPTY_FORM: GoalFormData = {
  title: '',
  description: '',
  timeframe: 'weekly',
  status: 'active',
  deadline: '',
  milestones: [],
  tasks: [],
};

function goalToFormData(goal: Goal): GoalFormData {
  return {
    title: goal.title,
    description: goal.description,
    timeframe: goal.timeframe,
    status: goal.status,
    deadline: goal.deadline
      ? new Date(goal.deadline).toISOString().split('T')[0]
      : '',
    milestones: goal.milestones.map((m) => ({
      title: m.title,
      description: m.description,
    })),
    tasks: goal.tasks.map((t) => ({ title: t.title, priority: t.priority })),
  };
}

interface GoalFormProps {
  initial: GoalFormData;
  onSubmit: (data: GoalFormData) => void;
  onCancel: () => void;
  submitLabel: string;
}

function GoalForm({ initial, onSubmit, onCancel, submitLabel }: GoalFormProps) {
  const [form, setForm] = useState<GoalFormData>(initial);
  const [newMilestone, setNewMilestone] = useState('');
  const [newTask, setNewTask] = useState('');

  const update = <K extends keyof GoalFormData>(key: K, value: GoalFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addMilestone = () => {
    const title = newMilestone.trim();
    if (!title) return;
    update('milestones', [...form.milestones, { title, description: '' }]);
    setNewMilestone('');
  };

  const removeMilestone = (idx: number) =>
    update('milestones', form.milestones.filter((_, i) => i !== idx));

  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    update('tasks', [...form.tasks, { title, priority: 'medium' as TaskPriority }]);
    setNewTask('');
  };

  const removeTask = (idx: number) =>
    update('tasks', form.tasks.filter((_, i) => i !== idx));

  const valid = form.title.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <Input
          placeholder="Goal title"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          placeholder="What do you want to achieve?"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Timeframe</label>
          <Select
            value={form.timeframe}
            onValueChange={(v) => update('timeframe', v as Timeframe)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAMES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select
            value={form.status}
            onValueChange={(v) => update('status', v as GoalStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Deadline (optional)</label>
        <Input
          type="date"
          value={form.deadline}
          onChange={(e) => update('deadline', e.target.value)}
        />
      </div>

      {/* Milestones */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Milestones</label>
        {form.milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <Flag size={14} className="text-muted-foreground shrink-0" />
            <span className="text-sm flex-1">{m.title}</span>
            <Button variant="ghost" size="sm" onClick={() => removeMilestone(i)}>
              <X size={14} />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            placeholder="Add milestone…"
            value={newMilestone}
            onChange={(e) => setNewMilestone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
          />
          <Button variant="outline" size="sm" onClick={addMilestone}>
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Tasks</label>
        {form.tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <Circle size={14} className="text-muted-foreground shrink-0" />
            <span className="text-sm flex-1">{t.title}</span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                PRIORITY_COLORS[t.priority],
              )}
            >
              {t.priority}
            </span>
            <Button variant="ghost" size="sm" onClick={() => removeTask(i)}>
              <X size={14} />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            placeholder="Add task…"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
          />
          <Button variant="outline" size="sm" onClick={addTask}>
            <Plus size={14} />
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!valid} onClick={() => onSubmit(form)}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

// --- Detail View ---

interface GoalDetailProps {
  goal: Goal;
  onBack: () => void;
  onUpdate: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

function GoalDetail({ goal, onBack, onUpdate, onDelete }: GoalDetailProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');

  const progress = calculateProgress(goal);

  const toggleMilestone = (id: string) => {
    const milestones = goal.milestones.map((m) =>
      m.id === id
        ? { ...m, completed: !m.completed, completedAt: !m.completed ? Date.now() : undefined }
        : m,
    );
    const updated = { ...goal, milestones, updatedAt: Date.now() };
    updated.progress = calculateProgress(updated);
    onUpdate(updated);
  };

  const toggleTask = (id: string) => {
    const tasks = goal.tasks.map((t) =>
      t.id === id
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined }
        : t,
    );
    const updated = { ...goal, tasks, updatedAt: Date.now() };
    updated.progress = calculateProgress(updated);
    onUpdate(updated);
  };

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    const task: Task = {
      id: generateId(),
      title,
      completed: false,
      priority: newTaskPriority,
      urgency: 5,
      impact: 5,
      effort: 5,
      goalId: goal.id,
    };
    const updated = { ...goal, tasks: [...goal.tasks, task], updatedAt: Date.now() };
    updated.progress = calculateProgress(updated);
    onUpdate(updated);
    setNewTaskTitle('');
    setNewTaskPriority('medium');
  };

  const handleEdit = (data: GoalFormData) => {
    const updated: Goal = {
      ...goal,
      title: data.title,
      description: data.description,
      timeframe: data.timeframe,
      status: data.status,
      deadline: data.deadline ? new Date(data.deadline).getTime() : undefined,
      milestones: data.milestones.map((m, i) =>
        goal.milestones[i]
          ? { ...goal.milestones[i], title: m.title, description: m.description }
          : { id: generateId(), title: m.title, description: m.description, completed: false },
      ),
      tasks: data.tasks.map((t, i) =>
        goal.tasks[i]
          ? { ...goal.tasks[i], title: t.title, priority: t.priority }
          : {
              id: generateId(),
              title: t.title,
              completed: false,
              priority: t.priority,
              urgency: 5,
              impact: 5,
              effort: 5,
              goalId: goal.id,
            },
      ),
      updatedAt: Date.now(),
    };
    updated.progress = calculateProgress(updated);
    onUpdate(updated);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <X size={16} className="mr-1" /> Cancel Edit
        </Button>
        <Card className="p-6">
          <GoalForm
            initial={goalToFormData(goal)}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel="Save Changes"
          />
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <CaretRight size={16} className="rotate-180" /> Back
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <PencilSimple size={16} className="mr-1" /> Edit
        </Button>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-destructive">Delete?</span>
            <Button variant="destructive" size="sm" onClick={() => onDelete(goal.id)}>
              Confirm
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash size={16} className="mr-1" /> Delete
          </Button>
        )}
      </div>

      {/* Goal info */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{goal.title}</h2>
            {goal.description && (
              <p className="text-sm text-muted-foreground">{goal.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="capitalize">
              {goal.timeframe}
            </Badge>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                STATUS_COLORS[goal.status],
              )}
            >
              {goal.status}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {goal.deadline && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock size={14} />
            <span>Deadline: {formatDeadline(goal.deadline)}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Created {formatDate(goal.createdAt)} · Updated {formatDate(goal.updatedAt)}
        </div>
      </Card>

      {/* Milestones */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Flag size={18} weight="bold" />
          <h3 className="font-semibold">
            Milestones ({goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length})
          </h3>
        </div>
        {goal.milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No milestones yet.</p>
        ) : (
          <div className="space-y-2">
            {goal.milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={m.completed}
                  onCheckedChange={() => toggleMilestone(m.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'text-sm',
                      m.completed && 'line-through text-muted-foreground',
                    )}
                  >
                    {m.title}
                  </span>
                  {m.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                  )}
                </div>
                {m.completed && m.completedAt && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(m.completedAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tasks */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks size={18} weight="bold" />
          <h3 className="font-semibold">
            Tasks ({goal.tasks.filter((t) => t.completed).length}/{goal.tasks.length})
          </h3>
        </div>
        {goal.tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">No tasks yet. Add one below.</p>
        )}
        <div className="space-y-2">
          {goal.tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={t.completed}
                onCheckedChange={() => toggleTask(t.id)}
              />
              <span
                className={cn(
                  'text-sm flex-1 min-w-0',
                  t.completed && 'line-through text-muted-foreground',
                )}
              >
                {t.title}
              </span>
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded font-medium capitalize shrink-0',
                  PRIORITY_COLORS[t.priority],
                )}
              >
                {t.priority}
              </span>
              {t.completed && t.completedAt && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(t.completedAt)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Add task inline */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder="Add a task…"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            className="flex-1"
          />
          <Select
            value={newTaskPriority}
            onValueChange={(v) => setNewTaskPriority(v as TaskPriority)}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={addTask} disabled={!newTaskTitle.trim()}>
            <Plus size={14} />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// --- Main View ---

export function GoalsView() {
  const [goals, setGoals] = useLocalStorage<Goal[]>('goals', []);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('all');

  const safeGoals = goals ?? [];

  const filteredGoals = useMemo(() => {
    return safeGoals
      .filter((g) => timeframe === 'all' || g.timeframe === timeframe)
      .filter((g) => statusFilter === 'all' || g.status === statusFilter)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [safeGoals, timeframe, statusFilter]);

  const selectedGoal = safeGoals.find((g) => g.id === selectedGoalId) ?? null;

  const handleCreate = (data: GoalFormData) => {
    const now = Date.now();
    const goal: Goal = {
      id: generateId(),
      title: data.title,
      description: data.description,
      timeframe: data.timeframe,
      status: data.status,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      deadline: data.deadline ? new Date(data.deadline).getTime() : undefined,
      milestones: data.milestones.map((m) => ({
        id: generateId(),
        title: m.title,
        description: m.description,
        completed: false,
      })),
      tasks: data.tasks.map((t) => ({
        id: generateId(),
        title: t.title,
        completed: false,
        priority: t.priority,
        urgency: 5,
        impact: 5,
        effort: 5,
      })),
    };
    setGoals((prev) => [goal, ...(prev ?? [])]);
    setCreating(false);
  };

  const handleUpdate = (updated: Goal) => {
    setGoals((prev) =>
      (prev ?? []).map((g) => (g.id === updated.id ? updated : g)),
    );
  };

  const handleDelete = (id: string) => {
    setGoals((prev) => (prev ?? []).filter((g) => g.id !== id));
    setSelectedGoalId(null);
  };

  // Detail view
  if (selectedGoal) {
    return (
      <ScrollArea className="h-full">
        <div className="p-8 max-w-3xl mx-auto">
          <GoalDetail
            goal={selectedGoal}
            onBack={() => setSelectedGoalId(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>
      </ScrollArea>
    );
  }

  // Create form
  if (creating) {
    return (
      <ScrollArea className="h-full">
        <div className="p-8 max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              <CaretRight size={16} className="rotate-180" /> Back
            </Button>
            <h2 className="text-lg font-semibold">Create Goal</h2>
          </div>
          <Card className="p-6">
            <GoalForm
              initial={EMPTY_FORM}
              onSubmit={handleCreate}
              onCancel={() => setCreating(false)}
              submitLabel="Create Goal"
            />
          </Card>
        </div>
      </ScrollArea>
    );
  }

  // List view
  return (
    <ScrollArea className="h-full">
      <div className="p-5 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="executive-eyebrow">Execution Planning</p>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Goals & Planning</h1>
            <p className="text-muted-foreground text-sm">
              Track progress across every timeframe.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} className="mr-1" /> Create Goal
          </Button>
        </div>

        {/* Timeframe tabs */}
        <Tabs
          value={timeframe}
          onValueChange={(v) => setTimeframe(v as Timeframe | 'all')}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {TIMEFRAMES.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              {(['all', ...STATUS_OPTIONS.map((s) => s.value)] as const).map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  size="sm"
                  className="capitalize text-xs h-7"
                  onClick={() => setStatusFilter(s as GoalStatus | 'all')}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          {/* Shared content for all tab values */}
          {['all', ...TIMEFRAMES.map((t) => t.value)].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {filteredGoals.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-12 flex flex-col items-center justify-center text-center">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <Target size={32} className="text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">No goals yet</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                      Create your first goal to start tracking progress and staying
                      focused on what matters most.
                    </p>
                    <Button onClick={() => setCreating(true)}>
                      <Plus size={16} className="mr-1" /> Create Goal
                    </Button>
                  </Card>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGoals.map((goal, idx) => {
                    const progress = calculateProgress(goal);
                    return (
                      <motion.div
                        key={goal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.04 }}
                      >
                        <Card
                          className="p-5 cursor-pointer hover:border-primary/40 transition-colors"
                          onClick={() => setSelectedGoalId(goal.id)}
                        >
                          <div className="space-y-3">
                            {/* Title & badges */}
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">
                                {goal.title}
                              </h3>
                              <CaretRight size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                            </div>

                            {goal.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {goal.description}
                              </p>
                            )}

                            {/* Progress */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">{progress}%</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>

                            {/* Meta */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs capitalize">
                                {goal.timeframe}
                              </Badge>
                              <span
                                className={cn(
                                  'text-xs px-1.5 py-0.5 rounded-full font-medium capitalize',
                                  STATUS_COLORS[goal.status],
                                )}
                              >
                                {goal.status}
                              </span>
                            </div>

                            {/* Counts & deadline */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {goal.milestones.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Flag size={12} />
                                  {goal.milestones.filter((m) => m.completed).length}/
                                  {goal.milestones.length}
                                </span>
                              )}
                              {goal.tasks.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <ListChecks size={12} />
                                  {goal.tasks.filter((t) => t.completed).length}/
                                  {goal.tasks.length}
                                </span>
                              )}
                              {goal.deadline && (
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {formatDeadline(goal.deadline)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </ScrollArea>
  );
}
