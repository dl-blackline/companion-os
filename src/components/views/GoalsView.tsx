import { useState, useMemo } from 'react';
import { useLifeOS } from '@/hooks/use-life-os';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { Clock } from '@phosphor-icons/react/Clock';
import { Flag } from '@phosphor-icons/react/Flag';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Plus } from '@phosphor-icons/react/Plus';
import { Target } from '@phosphor-icons/react/Target';
import { Trash } from '@phosphor-icons/react/Trash';
import { X } from '@phosphor-icons/react/X';
import type {
  LifeGoal,
  LifeCategory,
  GoalPriority,
  GoalStatus,
  CoordinationSignal,
  CreateGoalInput,
} from '@/types/life-os';
import { generateId } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Constants ─────────────────────────────────────────────────── */

const LIFE_CATEGORIES: { value: LifeCategory; label: string; icon: string }[] = [
  { value: 'financial', label: 'Financial', icon: '💰' },
  { value: 'health', label: 'Health', icon: '🏥' },
  { value: 'career', label: 'Career', icon: '💼' },
  { value: 'relationship', label: 'Relationships', icon: '❤️' },
  { value: 'business', label: 'Business', icon: '🏢' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'creative', label: 'Creative', icon: '🎨' },
  { value: 'personal', label: 'Personal', icon: '🌟' },
];

const STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

const PRIORITY_OPTIONS: { value: GoalPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const CATEGORY_COLORS: Record<LifeCategory, string> = {
  financial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  health: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  career: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  relationship: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  business: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  education: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  creative: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  personal: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
};

const STATUS_COLORS: Record<GoalStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  archived: 'bg-muted text-muted-foreground',
};

const PRIORITY_COLORS: Record<GoalPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const PACE_LABELS: Record<string, { label: string; color: string }> = {
  on_track: { label: 'On Track', color: 'text-green-600 dark:text-green-400' },
  ahead: { label: 'Ahead', color: 'text-blue-600 dark:text-blue-400' },
  at_risk: { label: 'At Risk', color: 'text-yellow-600 dark:text-yellow-400' },
  behind: { label: 'Behind', color: 'text-red-600 dark:text-red-400' },
  completed: { label: 'Complete', color: 'text-green-600 dark:text-green-400' },
};

function fmtDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function feasibilityColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function signalSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'border-red-500 bg-red-50 dark:bg-red-950/30';
    case 'high':
      return 'border-orange-500 bg-orange-50 dark:bg-orange-950/30';
    case 'medium':
      return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30';
    default:
      return 'border-blue-500 bg-blue-50 dark:bg-blue-950/30';
  }
}

/* ── Form Types ────────────────────────────────────────────────── */

interface GoalFormData {
  title: string;
  description: string;
  life_category: LifeCategory;
  priority: GoalPriority;
  status: GoalStatus;
  targetDate: string;
  isFinancial: boolean;
  targetAmount: string;
  currentAmount: string;
  milestones: { title: string; description: string }[];
}

const EMPTY_FORM: GoalFormData = {
  title: '',
  description: '',
  life_category: 'personal',
  priority: 'medium',
  status: 'active',
  targetDate: '',
  isFinancial: false,
  targetAmount: '',
  currentAmount: '',
  milestones: [],
};

function goalToFormData(goal: LifeGoal): GoalFormData {
  return {
    title: goal.title,
    description: goal.description || '',
    life_category: goal.life_category,
    priority: goal.priority,
    status: goal.status,
    targetDate: goal.target_date
      ? new Date(goal.target_date).toISOString().split('T')[0]
      : '',
    isFinancial: goal.is_financial,
    targetAmount: goal.target_amount != null ? String(goal.target_amount) : '',
    currentAmount: goal.current_amount != null ? String(goal.current_amount) : '',
    milestones: (goal.milestones || []).map((m) => ({
      title: m.title,
      description: m.description || '',
    })),
  };
}

/* ── GoalForm ──────────────────────────────────────────────────── */

interface GoalFormProps {
  initial: GoalFormData;
  onSubmit: (data: GoalFormData) => void;
  onCancel: () => void;
  submitLabel: string;
  saving?: boolean;
}

function GoalForm({ initial, onSubmit, onCancel, submitLabel, saving }: GoalFormProps) {
  const [form, setForm] = useState<GoalFormData>(initial);
  const [newMilestone, setNewMilestone] = useState('');

  const update = <K extends keyof GoalFormData>(key: K, value: GoalFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addMilestone = () => {
    const title = newMilestone.trim();
    if (!title) return;
    update('milestones', [...form.milestones, { title, description: '' }]);
    setNewMilestone('');
  };

  const removeMilestone = (idx: number) =>
    update(
      'milestones',
      form.milestones.filter((_, i) => i !== idx),
    );

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
          <label className="text-sm font-medium">Life Category</label>
          <Select
            value={form.life_category}
            onValueChange={(v) => {
              update('life_category', v as LifeCategory);
              if (v === 'financial') update('isFinancial', true);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIFE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Priority</label>
          <Select
            value={form.priority}
            onValueChange={(v) => update('priority', v as GoalPriority)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Target Date (optional)</label>
        <Input
          type="date"
          value={form.targetDate}
          onChange={(e) => update('targetDate', e.target.value)}
        />
      </div>

      {/* Financial goal toggle */}
      <div className="flex items-center gap-3 py-2">
        <Switch
          id="is-financial"
          checked={form.isFinancial}
          onCheckedChange={(checked) => update('isFinancial', !!checked)}
        />
        <Label htmlFor="is-financial" className="text-sm font-medium cursor-pointer">
          This is a financial goal (has a dollar target)
        </Label>
      </div>

      {/* Financial fields */}
      <AnimatePresence>
        {form.isFinancial && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 gap-4 overflow-hidden"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Amount ($)</label>
              <Input
                type="number"
                placeholder="5000"
                min="0"
                step="100"
                value={form.targetAmount}
                onChange={(e) => update('targetAmount', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Amount ($)</label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                step="100"
                value={form.currentAmount}
                onChange={(e) => update('currentAmount', e.target.value)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!valid || saving} onClick={() => onSubmit(form)}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

/* ── Signals Banner ────────────────────────────────────────────── */

function SignalsBanner({
  signals,
  onDismiss,
}: {
  signals: CoordinationSignal[];
  onDismiss: (id: string) => void;
}) {
  const important = signals.filter(
    (s) => s.severity === 'critical' || s.severity === 'high',
  );
  if (important.length === 0) return null;

  return (
    <div className="space-y-2">
      {important.slice(0, 3).map((s) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border-l-4 text-sm',
            signalSeverityColor(s.severity),
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium">{s.title}</p>
            {s.action_hint && (
              <p className="text-xs text-muted-foreground mt-0.5">{s.action_hint}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDismiss(s.id)}>
            <X size={14} />
          </Button>
        </motion.div>
      ))}
      {important.length > 3 && (
        <p className="text-xs text-muted-foreground">
          + {important.length - 3} more alerts
        </p>
      )}
    </div>
  );
}

/* ── GoalDetail ────────────────────────────────────────────────── */

interface GoalDetailProps {
  goal: LifeGoal;
  signals: CoordinationSignal[];
  linkedSavingsGoal?: {
    name: string;
    target_amount: number;
    current_amount: number;
    pace_status: string;
  } | null;
  onBack: () => void;
  onUpdate: (data: GoalFormData) => void;
  onDelete: (id: string) => void;
  onCompleteMilestone: (goalId: string, milestoneId: string) => void;
  onAssessFeasibility: (goalId: string) => void;
  saving?: boolean;
}

function GoalDetail({
  goal,
  signals,
  linkedSavingsGoal,
  onBack,
  onUpdate,
  onDelete,
  onCompleteMilestone,
  onAssessFeasibility,
  saving,
}: GoalDetailProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const progress = goal.progress ?? 0;
  const catMeta = LIFE_CATEGORIES.find((c) => c.value === goal.life_category);
  const goalSignals = signals.filter((s) => s.related_goal_id === goal.id);

  const handleEdit = (data: GoalFormData) => {
    onUpdate(data);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <CaretRight size={16} className="rotate-180" /> Back
          </Button>
          <h2 className="text-lg font-semibold">Edit Goal</h2>
        </div>
        <Card className="p-6">
          <GoalForm
            initial={goalToFormData(goal)}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel="Save Changes"
            saving={saving}
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
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(goal.id)}
            >
              Confirm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
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
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                CATEGORY_COLORS[goal.life_category],
              )}
            >
              {catMeta?.icon} {catMeta?.label}
            </span>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                STATUS_COLORS[goal.status],
              )}
            >
              {goal.status}
            </span>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                PRIORITY_COLORS[goal.priority],
              )}
            >
              {goal.priority}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {goal.target_date && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock size={14} />
            <span>Target: {fmtDate(goal.target_date)}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Created {fmtDate(goal.created_at)} · Updated {fmtDate(goal.updated_at)}
        </div>
      </Card>

      {/* Financial Info */}
      {goal.is_financial && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            💰 Financial Progress
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-lg font-bold">
                {formatCurrency(goal.target_amount ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-lg font-bold">
                {formatCurrency(goal.current_amount ?? 0)}
              </p>
            </div>
            {goal.monthly_pace != null && (
              <div>
                <p className="text-xs text-muted-foreground">Monthly Pace Needed</p>
                <p className="text-lg font-bold">
                  {formatCurrency(goal.monthly_pace)}
                </p>
              </div>
            )}
            {linkedSavingsGoal && (
              <div>
                <p className="text-xs text-muted-foreground">Pace Status</p>
                <p
                  className={cn(
                    'text-lg font-bold',
                    PACE_LABELS[linkedSavingsGoal.pace_status]?.color,
                  )}
                >
                  {PACE_LABELS[linkedSavingsGoal.pace_status]?.label ??
                    linkedSavingsGoal.pace_status}
                </p>
              </div>
            )}
          </div>

          {goal.target_amount != null && goal.target_amount > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Financial Progress</span>
                <span className="font-medium">
                  {Math.min(
                    100,
                    Math.round(
                      ((goal.current_amount ?? 0) / goal.target_amount) * 100,
                    ),
                  )}
                  %
                </span>
              </div>
              <Progress
                value={Math.min(
                  100,
                  ((goal.current_amount ?? 0) / goal.target_amount) * 100,
                )}
                className="h-2"
              />
            </div>
          )}

          {/* Feasibility */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Feasibility Score</p>
              <p
                className={cn(
                  'text-lg font-bold',
                  feasibilityColor(goal.feasibility_score),
                )}
              >
                {goal.feasibility_score != null
                  ? `${goal.feasibility_score}/100`
                  : 'Not assessed'}
              </p>
              {goal.feasibility_notes && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {goal.feasibility_notes}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAssessFeasibility(goal.id)}
            >
              {goal.feasibility_score != null ? 'Re-assess' : 'Assess'} Feasibility
            </Button>
          </div>
        </Card>
      )}

      {/* Coordination Signals */}
      {goalSignals.length > 0 && (
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            ⚡ Coordination Signals
          </h3>
          {goalSignals.map((s) => (
            <div
              key={s.id}
              className={cn(
                'p-3 rounded-lg border-l-4 text-sm',
                signalSeverityColor(s.severity),
              )}
            >
              <p className="font-medium">{s.title}</p>
              {s.summary && (
                <p className="text-xs text-muted-foreground mt-0.5">{s.summary}</p>
              )}
              {s.action_hint && (
                <p className="text-xs mt-1 font-medium">{s.action_hint}</p>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Milestones */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Flag size={18} weight="bold" />
          <h3 className="font-semibold">
            Milestones (
            {(goal.milestones || []).filter((m) => m.completed).length}/
            {(goal.milestones || []).length})
          </h3>
        </div>
        {!goal.milestones || goal.milestones.length === 0 ? (
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
                  onCheckedChange={() => {
                    if (!m.completed) onCompleteMilestone(goal.id, m.id);
                  }}
                  disabled={m.completed}
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.description}
                    </p>
                  )}
                </div>
                {m.completed && m.completedAt && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {fmtDate(m.completedAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

/* ── Main GoalsView ────────────────────────────────────────────── */

export function GoalsView() {
  const {
    dashboard,
    loading,
    saving,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    completeMilestone,
    assessFeasibility,
    refreshCoordination,
    dismissSignal,
  } = useLifeOS();

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<LifeCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('all');

  const goals = dashboard.goals;
  const signals = dashboard.signals;

  const filteredGoals = useMemo(() => {
    return goals
      .filter((g) => categoryFilter === 'all' || g.life_category === categoryFilter)
      .filter((g) => statusFilter === 'all' || g.status === statusFilter)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }, [goals, categoryFilter, statusFilter]);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;

  const handleCreate = async (data: GoalFormData) => {
    const input: CreateGoalInput = {
      title: data.title,
      description: data.description || undefined,
      life_category: data.life_category,
      priority: data.priority,
      targetDate: data.targetDate || undefined,
      isFinancial: data.isFinancial,
      targetAmount: data.targetAmount ? parseFloat(data.targetAmount) : undefined,
      currentAmount: data.currentAmount
        ? parseFloat(data.currentAmount)
        : undefined,
      milestones: data.milestones.map((m) => ({
        title: m.title,
        description: m.description || undefined,
      })),
    };
    const created = await createGoal(input);
    if (created) setCreating(false);
  };

  const handleUpdate = async (data: GoalFormData) => {
    if (!selectedGoal) return;
    await updateGoal({
      id: selectedGoal.id,
      title: data.title,
      description: data.description || undefined,
      status: data.status,
      priority: data.priority,
      life_category: data.life_category,
      targetDate: data.targetDate || undefined,
      targetAmount: data.targetAmount ? parseFloat(data.targetAmount) : undefined,
      currentAmount: data.currentAmount
        ? parseFloat(data.currentAmount)
        : undefined,
      milestones: data.milestones.map((m) => ({
        id: generateId(),
        title: m.title,
        description: m.description || '',
        completed: false,
      })),
    });
  };

  const handleDelete = async (id: string) => {
    const deleted = await deleteGoal(id);
    if (deleted) setSelectedGoalId(null);
  };

  // Loading state
  if (loading && goals.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="p-8 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Loading your goals…</p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Detail view
  if (selectedGoal) {
    const linkedSavings = dashboard.savingsGoals.find(
      (sg) =>
        sg.linked_goal_id === selectedGoal.id ||
        sg.id === selectedGoal.financial_goal_id,
    );
    return (
      <ScrollArea className="h-full">
        <div className="p-8 max-w-3xl mx-auto">
          <GoalDetail
            goal={selectedGoal}
            signals={signals}
            linkedSavingsGoal={linkedSavings ?? null}
            onBack={() => setSelectedGoalId(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onCompleteMilestone={(gId, mId) => completeMilestone(gId, mId)}
            onAssessFeasibility={(gId) => assessFeasibility(gId)}
            saving={saving}
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
              saving={saving}
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
            <p className="executive-eyebrow">Life OS</p>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              Goals &amp; Planning
            </h1>
            <p className="text-muted-foreground text-sm">
              Track progress across every area of your life — synced with your
              finances.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshCoordination()}
            >
              ⚡ Sync
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} className="mr-1" /> Create Goal
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Signals Banner */}
        <SignalsBanner signals={signals} onDismiss={dismissSignal} />

        {/* Category tabs */}
        <Tabs
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as LifeCategory | 'all')}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {LIFE_CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              {(['all', ...STATUS_OPTIONS.map((s) => s.value)] as const).map(
                (s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? 'default' : 'outline'}
                    size="sm"
                    className="capitalize text-xs h-7"
                    onClick={() => setStatusFilter(s as GoalStatus | 'all')}
                  >
                    {s}
                  </Button>
                ),
              )}
            </div>
          </div>

          {/* Shared content for all tab values */}
          {['all', ...LIFE_CATEGORIES.map((c) => c.value)].map((tab) => (
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
                      Create your first goal to start tracking progress.
                      Financial goals automatically sync with your savings and
                      cash flow.
                    </p>
                    <Button onClick={() => setCreating(true)}>
                      <Plus size={16} className="mr-1" /> Create Goal
                    </Button>
                  </Card>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGoals.map((goal, idx) => {
                    const catInfo = LIFE_CATEGORIES.find(
                      (c) => c.value === goal.life_category,
                    );
                    const goalSignalCount = signals.filter(
                      (s) =>
                        s.related_goal_id === goal.id &&
                        (s.severity === 'high' || s.severity === 'critical'),
                    ).length;

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
                            {/* Title */}
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">
                                {goal.title}
                              </h3>
                              <CaretRight
                                size={16}
                                className="text-muted-foreground shrink-0 mt-0.5"
                              />
                            </div>

                            {goal.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {goal.description}
                              </p>
                            )}

                            {/* Financial progress */}
                            {goal.is_financial &&
                              goal.target_amount != null &&
                              goal.target_amount > 0 && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      {formatCurrency(goal.current_amount ?? 0)}{' '}
                                      / {formatCurrency(goal.target_amount)}
                                    </span>
                                    <span className="font-medium">
                                      {Math.min(
                                        100,
                                        Math.round(
                                          ((goal.current_amount ?? 0) /
                                            goal.target_amount) *
                                            100,
                                        ),
                                      )}
                                      %
                                    </span>
                                  </div>
                                  <Progress
                                    value={Math.min(
                                      100,
                                      ((goal.current_amount ?? 0) /
                                        goal.target_amount) *
                                        100,
                                    )}
                                    className="h-1.5"
                                  />
                                </div>
                              )}

                            {/* Milestone progress for non-financial */}
                            {!goal.is_financial &&
                              (goal.milestones || []).length > 0 && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      Progress
                                    </span>
                                    <span className="font-medium">
                                      {Math.round(goal.progress ?? 0)}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={goal.progress ?? 0}
                                    className="h-1.5"
                                  />
                                </div>
                              )}

                            {/* Meta badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  'text-xs px-1.5 py-0.5 rounded-full font-medium',
                                  CATEGORY_COLORS[goal.life_category],
                                )}
                              >
                                {catInfo?.icon} {catInfo?.label}
                              </span>
                              <span
                                className={cn(
                                  'text-xs px-1.5 py-0.5 rounded-full font-medium capitalize',
                                  STATUS_COLORS[goal.status],
                                )}
                              >
                                {goal.status}
                              </span>
                              {goal.is_financial &&
                                goal.feasibility_score != null && (
                                  <span
                                    className={cn(
                                      'text-xs font-medium',
                                      feasibilityColor(goal.feasibility_score),
                                    )}
                                  >
                                    Feasibility: {goal.feasibility_score}
                                  </span>
                                )}
                            </div>

                            {/* Counts & deadline */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {(goal.milestones || []).length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Flag size={12} />
                                  {
                                    goal.milestones.filter((m) => m.completed)
                                      .length
                                  }
                                  /{goal.milestones.length}
                                </span>
                              )}
                              {goalSignalCount > 0 && (
                                <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                  ⚡ {goalSignalCount}
                                </span>
                              )}
                              {goal.target_date && (
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {fmtDate(goal.target_date)}
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
