import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFinancialHealth } from '@/hooks/use-financial-health';
import { useStripeFinancialConnections } from '@/hooks/use-stripe-financial-connections';
import type { StripeFinancialAccount } from '@/types/stripe-financial';
import { toast } from 'sonner';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { Bank } from '@phosphor-icons/react/Bank';
import { Heartbeat } from '@phosphor-icons/react/Heartbeat';
import { TrendDown } from '@phosphor-icons/react/TrendDown';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { Wallet } from '@phosphor-icons/react/Wallet';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { LinkBreak } from '@phosphor-icons/react/LinkBreak';
import { Plus } from '@phosphor-icons/react/Plus';

function currency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function accountTypeLabel(type: string | null): string {
  if (!type) return 'Account';
  const map: Record<string, string> = {
    checking: 'Checking',
    savings: 'Savings',
    credit: 'Credit',
    investment: 'Investment',
    mortgage: 'Mortgage',
    other: 'Other',
  };
  return map[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'inactive':
      return 'secondary';
    case 'disconnected':
    case 'error':
      return 'destructive';
    default:
      return 'outline';
  }
}

function loadPlaidScript() {
  if (document.querySelector('script[data-plaid-link]')) {
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
  script.async = true;
  script.dataset.plaidLink = 'true';
  document.body.appendChild(script);
}

export function FinanceView() {
  const {
    summary,
    loading: plaidLoading,
    syncing,
    error: plaidError,
    sync,
    createLinkToken,
    exchangePublicToken,
  } = useFinancialHealth();

  const {
    accounts: stripeAccounts,
    loading: stripeLoading,
    linking: stripeLinking,
    error: stripeError,
    createSession,
    completeSession,
    disconnect,
    refreshAccount,
  } = useStripeFinancialConnections();

  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Load Stripe.js lazily for Financial Connections
  const stripePromiseRef = useRef<Promise<import('@stripe/stripe-js').Stripe | null> | null>(null);

  const getStripe = useCallback(async () => {
    if (!stripePromiseRef.current) {
      const { loadStripe } = await import('@stripe/stripe-js');
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        return null;
      }
      stripePromiseRef.current = loadStripe(publishableKey);
    }
    return stripePromiseRef.current;
  }, []);

  useEffect(() => {
    loadPlaidScript();
  }, []);

  // ── Plaid connect handler ─────────────────────────────────────────────────
  const handlePlaidConnect = useCallback(async () => {
    try {
      const tokenResult = await createLinkToken();
      if (!tokenResult.configured) {
        toast.info(tokenResult.message || 'Plaid is not configured yet.');
        return;
      }

      if (!tokenResult.linkToken) {
        toast.error('Missing Plaid link token.');
        return;
      }

      if (!window.Plaid) {
        toast.error('Plaid Link failed to load. Please refresh and try again.');
        return;
      }

      const handler = window.Plaid.create({
        token: tokenResult.linkToken,
        onSuccess: async (publicToken: string) => {
          await exchangePublicToken(publicToken);
          toast.success('Bank account connected.');
        },
        onExit: () => {
          // User exited Link flow.
        },
      });

      handler.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to start account linking.');
    }
  }, [createLinkToken, exchangePublicToken]);

  // ── Stripe Financial Connections handler ───────────────────────────────────
  const handleStripeConnect = useCallback(async () => {
    try {
      const sessionResult = await createSession();

      if (!sessionResult.configured) {
        toast.info(sessionResult.message || 'Stripe Financial Connections is not configured yet.');
        return;
      }

      if (!sessionResult.clientSecret) {
        toast.error('Failed to create a linking session.');
        return;
      }

      const stripe = await getStripe();
      if (!stripe) {
        toast.error(
          'Stripe is not available. Please ensure VITE_STRIPE_PUBLISHABLE_KEY is configured.',
        );
        return;
      }

      const result = await stripe.collectFinancialConnectionsAccounts({
        clientSecret: sessionResult.clientSecret,
      });

      if (result.error) {
        if (result.error.type === 'validation_error') {
          toast.error('Bank linking failed: ' + result.error.message);
        }
        // User may have closed the modal — not necessarily an error
        return;
      }

      // Accounts were linked — persist them via backend
      if (sessionResult.sessionId) {
        await completeSession(sessionResult.sessionId);
        toast.success('Bank account linked successfully.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to complete bank linking.');
    }
  }, [createSession, completeSession, getStripe]);

  // ── Disconnect handler ────────────────────────────────────────────────────
  const handleDisconnect = useCallback(
    async (account: StripeFinancialAccount) => {
      const label = account.institution_name || account.account_display_name || 'this account';
      if (!window.confirm(`Disconnect ${label}? You can re-link it later.`)) {
        return;
      }

      setDisconnecting(account.id);
      try {
        await disconnect(account.id);
        toast.success(`${label} disconnected.`);
      } catch {
        toast.error('Failed to disconnect account.');
      } finally {
        setDisconnecting(null);
      }
    },
    [disconnect],
  );

  const loading = plaidLoading || stripeLoading;
  const error = plaidError || stripeError;
  const pulse = summary.pulse;

  return (
    <div className="settings-panel p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="executive-eyebrow">Money Intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight">Financial Health Pulse</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Link live bank feeds, analyze cash flow, and keep a continuous pulse on financial resilience.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              sync();
              refreshAccount().catch(() => toast.error('Failed to refresh account data.'));
            }}
            disabled={syncing || loading}
            className="gap-2"
          >
            <ArrowsClockwise size={14} />
            Sync
          </Button>
          <Button
            onClick={handleStripeConnect}
            disabled={syncing || loading || stripeLinking}
            className="gap-2"
          >
            <Bank size={15} />
            {stripeLinking ? 'Linking…' : 'Link Bank'}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {error}
        </Card>
      )}

      {/* Health pulse KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pulse Score</span>
            <Heartbeat size={18} className="text-primary" />
          </div>
          <p className="text-4xl font-bold tracking-tight">{pulse.score}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {pulse.trend === 'improving' ? <TrendUp size={13} className="text-emerald-400" /> : <TrendDown size={13} className="text-rose-400" />}
            {pulse.trend}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Net Cash Flow (30d)</p>
          <p className={`text-2xl font-semibold ${pulse.metrics.netCashFlow30d >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {currency(pulse.metrics.netCashFlow30d)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Income {currency(pulse.metrics.income30d)} • Expenses {currency(pulse.metrics.expenses30d)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Liquidity Runway</p>
          <p className="text-2xl font-semibold">{pulse.metrics.liquidityDays.toFixed(1)} days</p>
          <p className="text-xs text-muted-foreground mt-2">Total balance: {currency(pulse.metrics.totalBalance)}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Savings Rate</p>
          <p className={`text-2xl font-semibold ${pulse.metrics.savingsRate >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {pulse.metrics.savingsRate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-2">Updated {new Date(pulse.lastEvaluatedAt).toLocaleString()}</p>
        </Card>
      </div>

      {/* Companion analysis */}
      <Card className="p-5">
        <p className="text-sm font-semibold mb-1">Companion Analysis</p>
        <p className="text-sm text-muted-foreground">{pulse.narrative}</p>
      </Card>

      {/* Stripe Financial Connections – Linked Accounts */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <p className="text-sm font-semibold">Linked Bank Accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{stripeAccounts.length}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStripeConnect}
              disabled={stripeLinking || loading}
              className="gap-1 h-7 text-xs"
            >
              <Plus size={12} />
              Add
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Bank connections are secured through Stripe Financial Connections. Your credentials are never stored.
        </p>

        {stripeLoading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Loading linked accounts…
          </div>
        ) : stripeAccounts.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <Bank size={32} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No bank accounts linked yet.</p>
            <p className="text-xs text-muted-foreground/70">
              Link a bank account to unlock cash flow analysis, income verification, and savings intelligence.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStripeConnect}
              disabled={stripeLinking}
              className="gap-2 mt-2"
            >
              <Bank size={14} />
              {stripeLinking ? 'Linking…' : 'Link Your First Account'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {stripeAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-lg border border-border/70 p-4 flex items-center justify-between gap-3 hover:border-border transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {account.institution_name || 'Bank'}
                    </p>
                    <Badge variant={statusBadgeVariant(account.account_status)} className="text-[10px] px-1.5 py-0">
                      {account.account_status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {account.account_display_name || accountTypeLabel(account.account_type)}
                    {account.last4 ? ` ••••${account.last4}` : ''}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {account.account_subtype && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {account.account_subtype}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/50">
                      Linked {formatDate(account.linked_at)}
                    </span>
                    {!account.livemode && (
                      <span className="text-[10px] text-amber-400/70">test mode</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => void refreshAccount(account.id)}
                    title="Refresh account data"
                  >
                    <ArrowsClockwise size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleDisconnect(account)}
                    disabled={disconnecting === account.id}
                    title="Disconnect account"
                  >
                    <LinkBreak size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Plaid-sourced accounts & transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Synced Accounts</p>
            <Badge variant="secondary">{summary.accounts.length}</Badge>
          </div>

          {summary.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No synced accounts yet. Connect a bank above to begin.</p>
          ) : (
            <div className="space-y-2">
              {summary.accounts.slice(0, 8).map((account) => (
                <div key={account.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{account.official_name || account.name || 'Account'}</p>
                    <p className="text-xs text-muted-foreground">
                      {(account.type || 'account')} ••••{account.mask || '0000'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{currency(account.current_balance ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">current</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {summary.accounts.length === 0 && stripeAccounts.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlaidConnect}
              disabled={syncing || plaidLoading}
              className="gap-2 mt-3"
            >
              <Bank size={14} />
              Connect via Plaid
            </Button>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Recent Transactions</p>
            <Wallet size={18} className="text-muted-foreground" />
          </div>

          {summary.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions available yet.</p>
          ) : (
            <div className="space-y-2">
              {summary.transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tx.merchant_name || tx.name || 'Transaction'}</p>
                    <p className="text-xs text-muted-foreground">{tx.transaction_date || 'pending date'}</p>
                  </div>
                  <p className={`text-sm font-semibold ${tx.amount <= 0 ? 'text-emerald-300' : 'text-foreground'}`}>
                    {tx.amount <= 0 ? '+' : '-'}{currency(Math.abs(tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
