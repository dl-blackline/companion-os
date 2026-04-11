/**
 * LedgerPanel — Future money tracking (upcoming income and expenses).
 *
 * Allows creating, viewing, completing, skipping, and deleting ledger
 * entries. Entries are sorted by due date with overdue highlighting.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Note } from '@phosphor-icons/react/Note';
import { Plus } from '@phosphor-icons/react/Plus';
import { Check } from '@phosphor-icons/react/Check';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { Trash } from '@phosphor-icons/react/Trash';
import { toast } from 'sonner';
import { currency } from '../lib/finance-utils';
import type { LedgerEntry, LinkedAccount } from '@/types/stripe-financial';

export interface LedgerPanelProps {
  ledgerEntries: LedgerEntry[];
  accounts: LinkedAccount[];
  onCreateEntry: (entry: {
    title: string;
    amount: number;
    direction: 'inflow' | 'outflow';
    due_date: string;
    recurrence?: string;
    notes?: string;
    connection_id?: string;
  }) => Promise<LedgerEntry | null>;
  onUpdateEntry: (entryId: string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
}

export function LedgerPanel({
  ledgerEntries,
  accounts,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
}: LedgerPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'inflow' | 'outflow'>('outflow');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState('once');
  const [notes, setNotes] = useState('');
  const [linkedAccount, setLinkedAccount] = useState('');

  const resetForm = () => {
    setShowForm(false);
    setTitle('');
    setAmount('');
    setDirection('outflow');
    setDueDate('');
    setRecurrence('once');
    setNotes('');
    setLinkedAccount('');
  };

  const sorted = [...ledgerEntries].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Future Ledger</p>
          <p className="text-xs text-muted-foreground mt-0.5">Track upcoming money in and out.</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} className="mr-1" /> {showForm ? 'Cancel' : 'New Entry'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Title *</label>
              <input
                type="text"
                placeholder="e.g. Rent, Paycheck, Insurance"
                className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Direction *</label>
              <select
                className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                value={direction}
                onChange={e => setDirection(e.target.value as 'inflow' | 'outflow')}
              >
                <option value="outflow">Outflow (expense)</option>
                <option value="inflow">Inflow (income)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Due Date *</label>
              <input
                type="date"
                className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Recurrence</label>
              <select
                className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                value={recurrence}
                onChange={e => setRecurrence(e.target.value)}
              >
                <option value="once">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Account (optional)</label>
              <select
                className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                value={linkedAccount}
                onChange={e => setLinkedAccount(e.target.value)}
              >
                <option value="">No linked account</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.nickname || a.institution_name} {a.account_last4 ? `••${a.account_last4}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label>
            <textarea
              className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              rows={2}
              placeholder="Optional notes…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={!title || !amount || !dueDate}
            onClick={async () => {
              await onCreateEntry({
                title,
                amount: parseFloat(amount),
                direction,
                due_date: dueDate,
                recurrence: recurrence || 'once',
                notes: notes || undefined,
                connection_id: linkedAccount || undefined,
              });
              resetForm();
              toast.success('Ledger entry created.');
            }}
          >
            <Plus size={12} className="mr-1" /> Create Entry
          </Button>
        </Card>
      )}

      {sorted.length === 0 && !showForm && (
        <Card className="p-8 text-center">
          <Note size={24} className="mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create entries for upcoming income and expenses.</p>
        </Card>
      )}

      {sorted.length > 0 && (
        <div className="space-y-1.5">
          {sorted.map((entry: LedgerEntry) => {
            const isPast = new Date(entry.due_date) < new Date() && entry.status === 'pending';
            const linkedAcct = entry.connection_id
              ? accounts.find(a => a.id === entry.connection_id)
              : null;
            return (
              <Card
                key={entry.id}
                className={`p-3 transition-colors ${entry.status === 'completed' ? 'opacity-60' : ''} ${isPast ? 'border-amber-500/30' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${entry.status === 'completed' ? 'line-through' : ''}`}>
                        {entry.title}
                      </p>
                      {entry.recurrence && entry.recurrence !== 'once' && (
                        <Badge variant="secondary" className="text-[9px] capitalize">{entry.recurrence}</Badge>
                      )}
                      {isPast && <Badge variant="destructive" className="text-[9px]">Overdue</Badge>}
                      {entry.status === 'completed' && <Badge variant="default" className="text-[9px]">Done</Badge>}
                      {entry.status === 'skipped' && <Badge variant="secondary" className="text-[9px]">Skipped</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        Due {new Date(entry.due_date).toLocaleDateString()}
                      </span>
                      {linkedAcct && (
                        <>
                          <span className="text-[10px] text-muted-foreground/50">•</span>
                          <span className="text-[10px] text-muted-foreground">
                            {linkedAcct.nickname || linkedAcct.institution_name} {linkedAcct.account_last4 ? `••${linkedAcct.account_last4}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{entry.notes}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className={`text-sm font-semibold ${entry.direction === 'inflow' ? 'text-emerald-400' : 'text-rose-300'}`}>
                      {entry.direction === 'inflow' ? '+' : '−'}{currency(entry.amount)}
                    </p>
                    <div className="flex gap-1 justify-end">
                      {entry.status === 'pending' && (
                        <>
                          <button
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Mark completed"
                            onClick={() => onUpdateEntry(entry.id, { status: 'completed' })}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="text-muted-foreground/60 hover:text-foreground transition-colors"
                            title="Skip"
                            onClick={() => onUpdateEntry(entry.id, { status: 'skipped' })}
                          >
                            <ArrowsClockwise size={14} />
                          </button>
                        </>
                      )}
                      <button
                        className="text-destructive/60 hover:text-destructive transition-colors"
                        title="Delete"
                        onClick={() => { if (confirm('Delete this ledger entry?')) onDeleteEntry(entry.id); }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
