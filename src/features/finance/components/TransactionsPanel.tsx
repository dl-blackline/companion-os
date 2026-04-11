/**
 * TransactionsPanel — Transaction feed with filters, search, editing.
 *
 * Displays the full transaction feed from Stripe Financial Connections
 * with search, direction/category/account filters, inline category
 * and notes editing, and pagination.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { ListBullets } from '@phosphor-icons/react/ListBullets';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Note } from '@phosphor-icons/react/Note';
import { toast } from 'sonner';
import { currency } from '../lib/finance-utils';
import type { NormalizedTransaction, TransactionFilters } from '@/types/stripe-financial';
import type { LinkedAccount } from '@/types/stripe-financial';

export interface TransactionsPanelProps {
  transactions: NormalizedTransaction[];
  pagination: { total: number; hasMore: boolean } | null;
  categories: { name: string }[];
  loading: boolean;
  error: string | null;
  filters: TransactionFilters;
  accounts: LinkedAccount[];
  stripeSyncing: boolean;
  onApplyFilters: (filters: TransactionFilters) => void;
  onLoadMore: () => void;
  onUpdateCategory: (txId: string, category: string) => Promise<void>;
  onUpdateNotes: (txId: string, notes: string) => Promise<void>;
  onRefresh: () => void;
  onSyncTransactions: () => Promise<boolean>;
}

export function TransactionsPanel({
  transactions: txFeed,
  pagination: txPagination,
  categories: txCategories,
  loading: txLoading,
  error: txError,
  filters: txFilters,
  accounts,
  stripeSyncing,
  onApplyFilters: applyFilters,
  onLoadMore: txLoadMore,
  onUpdateCategory: updateCategory,
  onUpdateNotes: updateNotes,
  onRefresh: txRefresh,
  onSyncTransactions: syncTransactions,
}: TransactionsPanelProps) {
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txFilterCategory, setTxFilterCategory] = useState('');
  const [txFilterDirection, setTxFilterDirection] = useState<'' | 'inflow' | 'outflow'>('');
  const [txFilterAccount, setTxFilterAccount] = useState('');

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/20 border border-border/70 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              value={txSearchTerm}
              onChange={e => setTxSearchTerm(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') applyFilters({ ...txFilters, search: txSearchTerm, offset: 0 });
              }}
            />
          </div>

          <select
            className="text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            value={txFilterDirection}
            onChange={e => {
              const val = e.target.value as '' | 'inflow' | 'outflow';
              setTxFilterDirection(val);
              applyFilters({ ...txFilters, direction: val || undefined, offset: 0 });
            }}
          >
            <option value="">All directions</option>
            <option value="inflow">Inflows</option>
            <option value="outflow">Outflows</option>
          </select>

          <select
            className="text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            value={txFilterCategory}
            onChange={e => {
              setTxFilterCategory(e.target.value);
              applyFilters({ ...txFilters, category: e.target.value || undefined, offset: 0 });
            }}
          >
            <option value="">All categories</option>
            {txCategories.map(cat => (
              <option key={cat.name} value={cat.name}>{cat.name.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {accounts.length > 1 && (
            <select
              className="text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              value={txFilterAccount}
              onChange={e => {
                setTxFilterAccount(e.target.value);
                applyFilters({ ...txFilters, connectionId: e.target.value || undefined, offset: 0 });
              }}
            >
              <option value="">All accounts</option>
              {accounts.map(acct => (
                <option key={acct.id} value={acct.id}>
                  {acct.institution_name} {acct.account_last4 ? `••${acct.account_last4}` : ''}
                </option>
              ))}
            </select>
          )}

          <Button variant="outline" size="sm" className="text-xs" onClick={() => applyFilters({ ...txFilters, search: txSearchTerm, offset: 0 })}>
            Search
          </Button>

          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" disabled={txLoading} onClick={() => txRefresh()}>
            <ArrowsClockwise size={12} className={txLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Error state */}
      {txError && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <p className="text-xs text-destructive font-medium">Error loading transactions: {txError}</p>
          <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => txRefresh()}>Retry</Button>
        </Card>
      )}

      {/* Loading state */}
      {txLoading && txFeed.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading transactions…</p>
        </Card>
      )}

      {/* Empty state */}
      {!txLoading && !txError && txFeed.length === 0 && (
        <Card className="p-8 text-center space-y-3">
          <ListBullets size={36} className="mx-auto text-muted-foreground/60" />
          <p className="text-sm font-semibold">No Transactions</p>
          <p className="text-xs text-muted-foreground">
            {accounts.length === 0
              ? 'Link a bank account to see transactions here.'
              : stripeSyncing
                ? 'Syncing transactions from your bank… This can take up to 2 minutes.'
                : 'Transactions will appear once your bank syncs data.'}
          </p>
          {accounts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={stripeSyncing}
              onClick={async () => {
                const complete = await syncTransactions();
                if (complete) {
                  txRefresh();
                  toast.success('Transactions synced.');
                } else {
                  toast.info('Transactions are still syncing. Try again in a moment.');
                }
              }}
            >
              <ArrowsClockwise size={14} className={stripeSyncing ? 'animate-spin mr-1.5' : 'mr-1.5'} />
              {stripeSyncing ? 'Syncing…' : 'Sync Transactions'}
            </Button>
          )}
        </Card>
      )}

      {/* Transactions list */}
      {txFeed.length > 0 && (
        <div className="space-y-1.5">
          {txFeed.map((tx: NormalizedTransaction) => {
            const isEditing = editingTxId === tx.id;
            const displayCategory = tx.user_category_override || tx.category || 'uncategorized';
            return (
              <Card
                key={tx.id}
                className={`p-3 cursor-pointer hover:border-primary/30 transition-colors ${isEditing ? 'border-primary/40' : ''}`}
                onClick={() => {
                  if (isEditing) {
                    setEditingTxId(null);
                  } else {
                    setEditingTxId(tx.id);
                    setEditingNote(tx.notes || '');
                    setEditingCategory(displayCategory);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{tx.merchant_name || tx.description || 'Unknown'}</p>
                      {tx.notes && <Note size={12} className="shrink-0 text-primary/60" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {tx.institution_name} {tx.account_last4 ? `••${tx.account_last4}` : ''} {tx.account_subtype ? `(${tx.account_subtype})` : ''}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">•</span>
                      <span className="text-[10px] text-muted-foreground">
                        {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : 'No date'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${tx.direction === 'inflow' ? 'text-emerald-400' : 'text-rose-300'}`}>
                      {tx.direction === 'inflow' ? '+' : '−'}{currency(Math.abs(tx.amount))}
                    </p>
                    <Badge variant="secondary" className="text-[9px] mt-0.5 capitalize">
                      {displayCategory.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-border/40 space-y-3" onClick={e => e.stopPropagation()}>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Category</label>
                      <select
                        className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                        value={editingCategory}
                        onChange={e => setEditingCategory(e.target.value)}
                      >
                        {txCategories.map(cat => (
                          <option key={cat.name} value={cat.name}>{cat.name.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs mt-1.5"
                        disabled={editingCategory === displayCategory}
                        onClick={async () => {
                          await updateCategory(tx.id, editingCategory);
                          setEditingTxId(null);
                        }}
                      >
                        Save Category
                      </Button>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label>
                      <textarea
                        className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                        value={editingNote}
                        onChange={e => setEditingNote(e.target.value)}
                        placeholder="Add a private note to this transaction…"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs mt-1.5"
                        disabled={editingNote === (tx.notes || '')}
                        onClick={async () => {
                          await updateNotes(tx.id, editingNote);
                          setEditingTxId(null);
                        }}
                      >
                        Save Note
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50">
                      Status: {tx.status} • ID: {tx.stripe_transaction_id || tx.id.slice(0, 8)}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {txPagination && txPagination.hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" className="text-xs" disabled={txLoading} onClick={() => txLoadMore()}>
            {txLoading ? 'Loading…' : `Load More (${txPagination.total - txFeed.length} remaining)`}
          </Button>
        </div>
      )}
      {txPagination && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {txFeed.length} of {txPagination.total} transactions
        </p>
      )}
    </div>
  );
}
