/**
 * AccountsPanel — Linked bank accounts management.
 *
 * Shows linked Stripe Financial Connections accounts with balances,
 * utilization for credit cards, editing of nicknames/notes, refresh,
 * disconnect, and remove actions.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard } from '@phosphor-icons/react/CreditCard';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Check } from '@phosphor-icons/react/Check';
import { GlobeSimple } from '@phosphor-icons/react/GlobeSimple';
import { currency } from '../lib/finance-utils';
import type { LinkedAccount, LinkedAccountsDashboard } from '@/types/stripe-financial';

export interface AccountsPanelProps {
  dashboard: LinkedAccountsDashboard;
  loading: boolean;
  stripeConnecting: boolean;
  stripeSyncing: boolean;
  onStripeConnect: () => void;
  onRefreshAccount: (connectionId: string) => void;
  onDisconnectAccount: (connectionId: string) => void;
  onRemoveAccount: (connectionId: string) => void;
  onUpdateAccount: (connectionId: string, updates: { nickname?: string; user_notes?: string; website_url?: string }) => Promise<void>;
}

export function AccountsPanel({
  dashboard,
  loading,
  stripeConnecting,
  stripeSyncing,
  onStripeConnect,
  onRefreshAccount,
  onDisconnectAccount,
  onRemoveAccount,
  onUpdateAccount,
}: AccountsPanelProps) {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editAccountNotes, setEditAccountNotes] = useState('');
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('');

  return (
    <div className="space-y-6">
      {dashboard.accounts.length === 0 && !loading && (
        <Card className="p-8 text-center space-y-4">
          <CreditCard size={40} className="mx-auto text-muted-foreground/60" />
          <div>
            <p className="text-sm font-semibold">No Linked Accounts</p>
            <p className="text-xs text-muted-foreground mt-1">Connect your bank accounts to see balances, transactions, and financial insights in one place.</p>
          </div>
          <Button size="sm" onClick={onStripeConnect} disabled={stripeConnecting}>
            {stripeConnecting ? 'Connecting…' : 'Link Bank Account'}
          </Button>
        </Card>
      )}

      {loading && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading linked accounts…</p>
        </Card>
      )}

      {dashboard.accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dashboard.accounts.map(acct => (
            <AccountCard
              key={acct.id}
              account={acct}
              isEditing={editingAccountId === acct.id}
              editNickname={editNickname}
              editAccountNotes={editAccountNotes}
              editWebsiteUrl={editWebsiteUrl}
              onStartEdit={() => {
                setEditingAccountId(acct.id);
                setEditNickname(acct.nickname || '');
                setEditAccountNotes(acct.user_notes || '');
                setEditWebsiteUrl(acct.website_url || '');
              }}
              onCancelEdit={() => setEditingAccountId(null)}
              onSaveEdit={async () => {
                await onUpdateAccount(acct.id, {
                  nickname: editNickname || undefined,
                  user_notes: editAccountNotes || undefined,
                  website_url: editWebsiteUrl || undefined,
                });
                setEditingAccountId(null);
              }}
              onEditNickname={setEditNickname}
              onEditNotes={setEditAccountNotes}
              onEditWebsite={setEditWebsiteUrl}
              onRefresh={() => onRefreshAccount(acct.id)}
              onDisconnect={() => { if (confirm('Disconnect this account? You can re-link it later.')) onDisconnectAccount(acct.id); }}
              onRemove={() => { if (confirm('Remove this account permanently? All associated data will be deleted.')) onRemoveAccount(acct.id); }}
            />
          ))}
        </div>
      )}

      {dashboard.accounts.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {dashboard.accounts.length} account{dashboard.accounts.length !== 1 ? 's' : ''} linked
          {dashboard.totalTransactions > 0 && ` • ${dashboard.totalTransactions} total transactions`}
          {stripeSyncing && ' • Syncing transactions…'}
        </p>
      )}
    </div>
  );
}

/* ── Single Account Card ─────────────────────────────────────────────────── */

interface AccountCardProps {
  account: LinkedAccount;
  isEditing: boolean;
  editNickname: string;
  editAccountNotes: string;
  editWebsiteUrl: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => Promise<void>;
  onEditNickname: (v: string) => void;
  onEditNotes: (v: string) => void;
  onEditWebsite: (v: string) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}

function AccountCard({
  account: acct,
  isEditing,
  editNickname,
  editAccountNotes,
  editWebsiteUrl,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditNickname,
  onEditNotes,
  onEditWebsite,
  onRefresh,
  onDisconnect,
  onRemove,
}: AccountCardProps) {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              type="text"
              placeholder={acct.institution_name || 'Nickname'}
              className="w-full text-sm font-semibold bg-black/20 border border-border/70 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              value={editNickname}
              onChange={e => onEditNickname(e.target.value)}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate">{acct.nickname || acct.institution_name || 'Unknown Institution'}</p>
              <button onClick={onStartEdit} className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0" title="Edit nickname & notes">
                <PencilSimple size={12} />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {acct.account_display_name || acct.account_subtype || 'Account'} {acct.account_last4 ? `••${acct.account_last4}` : ''}
          </p>
        </div>
        <Badge
          variant={acct.status === 'connected' ? 'default' : acct.status === 'error' ? 'destructive' : 'secondary'}
          className="text-[10px] shrink-0 capitalize"
        >
          {acct.status}
        </Badge>
      </div>

      {isEditing && (
        <div className="space-y-2">
          <textarea
            placeholder="Quick notes about this account…"
            className="w-full text-xs bg-black/20 border border-border/70 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={2}
            value={editAccountNotes}
            onChange={e => onEditNotes(e.target.value)}
          />
          <input
            type="url"
            placeholder="Bank website URL (e.g. https://chase.com)"
            className="w-full text-xs bg-black/20 border border-border/70 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            value={editWebsiteUrl}
            onChange={e => onEditWebsite(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs flex-1" onClick={onSaveEdit}>
              <Check size={12} className="mr-1" /> Save
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={onCancelEdit}>Cancel</Button>
          </div>
        </div>
      )}

      {!isEditing && acct.user_notes && (
        <p className="text-xs text-muted-foreground/80 italic border-l-2 border-border/50 pl-2">{acct.user_notes}</p>
      )}

      <BalanceDisplay account={acct} />

      {acct.last_sync_at && (
        <p className="text-[10px] text-muted-foreground/60">
          Last synced {new Date(acct.last_sync_at).toLocaleString()}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {acct.website_url && (
          <a
            href={acct.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border/70 text-muted-foreground/60 hover:text-foreground hover:border-primary/40 transition-colors"
            title="Open bank website"
          >
            <GlobeSimple size={14} />
          </a>
        )}
        {acct.status === 'connected' && (
          <>
            <Button variant="outline" size="sm" className="text-xs flex-1" onClick={onRefresh}>Refresh</Button>
            <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={onDisconnect}>Disconnect</Button>
          </>
        )}
        {acct.status !== 'connected' && (
          <Button variant="ghost" size="sm" className="text-xs text-destructive flex-1" onClick={onRemove}>Remove</Button>
        )}
      </div>
    </Card>
  );
}

/* ── Balance Display (supports credit cards with utilization) ─────────────── */

function BalanceDisplay({ account: acct }: { account: LinkedAccount }) {
  const subtype = (acct.account_subtype || '').toLowerCase();
  const isCreditCard = subtype === 'credit_card' || subtype === 'credit';
  const bal = acct.latest_balance;

  if (!bal) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 italic">
        <ArrowsClockwise size={12} className="animate-spin" />
        <span>Balance syncing…</span>
      </div>
    );
  }

  if (isCreditCard) {
    const debt = Math.abs(bal.current_balance ?? 0);
    const availableCredit = bal.available_balance ?? 0;
    const creditLimit = debt + availableCredit;
    const utilization = creditLimit > 0 ? (debt / creditLimit) * 100 : 0;
    const utilizationColor = utilization > 75 ? 'text-rose-400' : utilization > 30 ? 'text-amber-400' : 'text-emerald-400';

    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Balance Owed</span>
            <span className="font-medium text-rose-300">{currency(debt)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Available Credit</span>
            <span className="font-medium text-emerald-400">{currency(availableCredit)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Credit Limit</span>
            <span className="font-medium">{currency(creditLimit)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Utilization</span>
            <span className={`font-semibold ${utilizationColor}`}>{utilization.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${utilization > 75 ? 'bg-rose-500' : utilization > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            {utilization <= 30 ? 'Excellent' : utilization <= 50 ? 'Good' : utilization <= 75 ? 'Fair — consider paying down' : 'High — impacts credit score'}
          </p>
        </div>
        <Badge variant="secondary" className="text-[9px]">Revolving Credit</Badge>
        <p className="text-[10px] text-muted-foreground/60">As of {new Date(bal.as_of).toLocaleString()}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Current Balance</span>
        <span className="font-medium">{currency(bal.current_balance ?? 0)}</span>
      </div>
      {bal.available_balance != null && bal.available_balance !== bal.current_balance && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Available</span>
          <span className="font-medium">{currency(bal.available_balance)}</span>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/60">As of {new Date(bal.as_of).toLocaleString()}</p>
    </div>
  );
}
