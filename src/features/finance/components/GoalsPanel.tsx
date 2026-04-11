/**
 * GoalsPanel — Savings goals and progress tracking.
 *
 * Allows creating goals with targets, monthly contributions, priority,
 * and displays a portfolio view with progress bars and pacing status.
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { currency } from '../lib/finance-utils';

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  priority: string;
  target_date?: string;
  monthly_contribution_target?: number;
  /** Enhanced analysis fields */
  feasibility_score?: number;
  feasibility_notes?: string;
  pacing_status?: string;
  estimated_monthly_capacity?: number;
}

export interface GoalsPanelProps {
  /** Goals from intelligence dashboard */
  intelligenceGoals: SavingsGoal[];
  /** Goals from analysis dashboard (enhanced with pacing) */
  analysisGoals: SavingsGoal[];
  saving: boolean;
  onSave: (data: {
    name: string;
    target_amount: number;
    current_amount: number;
    target_date: string;
    monthly_contribution_target: number;
    priority: string;
  }) => Promise<void>;
}

export function GoalsPanel({
  intelligenceGoals,
  analysisGoals,
  saving,
  onSave,
}: GoalsPanelProps) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [date, setDate] = useState('');
  const [monthly, setMonthly] = useState('');
  const [priority, setPriority] = useState('medium');

  const sortedIntelligenceGoals = useMemo(
    () => [...intelligenceGoals].sort((a, b) => a.name.localeCompare(b.name)),
    [intelligenceGoals],
  );

  const goals = analysisGoals.length > 0 ? analysisGoals : sortedIntelligenceGoals;

  const handleSave = async () => {
    await onSave({
      name,
      target_amount: Number(target),
      current_amount: Number(current) || 0,
      target_date: date,
      monthly_contribution_target: Number(monthly) || 0,
      priority,
    });
    setName('');
    setTarget('');
    setCurrent('');
    setDate('');
    setMonthly('');
    setPriority('medium');
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Savings Goal Strategy</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name *" className={!name.trim() && target ? 'border-rose-500/60' : ''} />
            {!name.trim() && target && <p className="text-[10px] text-rose-400">Required</p>}
          </div>
          <div className="space-y-1">
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target amount *" type="number" min="0" step="100" className={name.trim() && (!target || Number(target) <= 0) ? 'border-rose-500/60' : ''} />
            {name.trim() && (!target || Number(target) <= 0) && <p className="text-[10px] text-rose-400">Required — enter a target &gt; $0</p>}
          </div>
          <Input value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current amount (optional)" type="number" min="0" step="100" />
          <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
          <Input value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Monthly contribution target" type="number" min="0" step="50" />
          <label className="text-sm text-muted-foreground">
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving || !name.trim() || Number(target) <= 0}>
          {saving ? 'Saving…' : 'Save Savings Goal'}
        </Button>
      </Card>

      <Card className="p-5 space-y-2">
        <p className="text-sm font-semibold">Goal Portfolio</p>
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No savings goals yet.</p>
        ) : (
          goals.map((goal) => {
            const progress = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
            const enhanced = 'feasibility_score' in goal ? goal : null;
            const pacingColor = enhanced?.pacing_status === 'ahead' || enhanced?.pacing_status === 'on_track'
              ? 'text-emerald-300'
              : enhanced?.pacing_status === 'behind'
                ? 'text-rose-300'
                : enhanced?.pacing_status === 'at_risk'
                  ? 'text-amber-300'
                  : 'text-muted-foreground';
            return (
              <div key={goal.id} className="rounded-lg border border-border/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{goal.name}</p>
                  <div className="flex items-center gap-2">
                    {enhanced?.pacing_status && enhanced.pacing_status !== 'unknown' && (
                      <Badge variant={enhanced.pacing_status === 'on_track' || enhanced.pacing_status === 'ahead' ? 'default' : 'secondary'} className="text-xs capitalize">
                        {enhanced.pacing_status.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="capitalize">{goal.priority}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {currency(goal.current_amount)} / {currency(goal.target_amount)} • {progress.toFixed(0)}%
                </p>
                <Progress value={progress} className="mt-2 h-2" />
                {enhanced?.feasibility_notes && (
                  <div className="mt-3 pt-2 border-t border-border/40 space-y-1">
                    <p className="text-xs text-muted-foreground">{enhanced.feasibility_notes}</p>
                    {enhanced.estimated_monthly_capacity != null && enhanced.estimated_monthly_capacity > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Estimated monthly capacity: <span className={pacingColor}>{currency(enhanced.estimated_monthly_capacity)}</span>
                      </p>
                    )}
                    {enhanced.feasibility_score != null && (
                      <p className="text-xs text-muted-foreground">
                        Feasibility: {(enhanced.feasibility_score * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
