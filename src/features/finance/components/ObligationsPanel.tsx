/**
 * ObligationsPanel — Bills and obligations management.
 *
 * Provides add/edit/delete for obligations with a sortable planner board.
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Trash } from '@phosphor-icons/react/Trash';
import { currency } from '../lib/finance-utils';

export interface Obligation {
  id: string;
  account_label?: string;
  institution_name?: string;
  category?: string;
  due_date?: string;
  amount_due?: number;
  minimum_due?: number;
  planned_payment?: number;
  status: string;
}

export interface ObligationsPanelProps {
  obligations: Obligation[];
  saving: boolean;
  onSave: (data: {
    id?: string;
    account_label: string;
    category: string;
    due_date: string;
    amount_due: number;
    minimum_due: number;
    planned_payment: number;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ObligationsPanel({
  obligations,
  saving,
  onSave,
  onDelete,
}: ObligationsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('bill');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [minimum, setMinimum] = useState('');
  const [planned, setPlanned] = useState('');

  const sorted = useMemo(
    () => [...obligations].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
    [obligations],
  );

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setCategory('bill');
    setDueDate('');
    setAmount('');
    setMinimum('');
    setPlanned('');
  };

  const handleSave = async () => {
    await onSave({
      id: editingId || undefined,
      account_label: label,
      category,
      due_date: dueDate,
      amount_due: Number(amount) || 0,
      minimum_due: Number(minimum) || 0,
      planned_payment: Number(planned) || 0,
    });
    resetForm();
  };

  const startEdit = (item: Obligation) => {
    setLabel(item.account_label || item.institution_name || '');
    setCategory(item.category || 'bill');
    setDueDate(item.due_date || '');
    setAmount(String(item.amount_due || ''));
    setMinimum(String(item.minimum_due || ''));
    setPlanned(String(item.planned_payment || ''));
    setEditingId(item.id);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Add Bill / Obligation</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bill label (e.g., Chase Card)" />
          <Input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" />
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount due" />
          <Input value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="Minimum due" />
          <Input value={planned} onChange={(e) => setPlanned(e.target.value)} placeholder="Planned payment" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {editingId ? 'Update Obligation' : 'Save to Bill Planner'}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-2">
        <p className="text-sm font-semibold">Planner Board</p>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No obligations yet. Upload statements or add planner entries manually.</p>
        ) : (
          sorted.slice(0, 20).map((item) => (
            <div key={item.id} className="rounded-lg border border-border/70 p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{item.account_label || item.institution_name || 'Obligation'}</p>
                <p className="text-xs text-muted-foreground">Due {item.due_date || 'n/a'} • {item.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold">{currency(item.amount_due || item.minimum_due || 0)}</p>
                  <Badge variant={item.status === 'overdue' ? 'destructive' : 'secondary'} className="capitalize">{item.status}</Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    title="Edit obligation"
                    className="text-muted-foreground/60 hover:text-foreground transition-colors"
                    onClick={() => startEdit(item)}
                  >
                    <PencilSimple size={13} />
                  </button>
                  <button
                    title="Delete obligation"
                    className="text-muted-foreground/60 hover:text-rose-400 transition-colors"
                    onClick={() => void onDelete(item.id)}
                    disabled={saving}
                  >
                    <Trash size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
