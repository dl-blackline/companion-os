import { useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFinancialHealth } from '@/hooks/use-financial-health';
import { toast } from 'sonner';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { Bank } from '@phosphor-icons/react/Bank';
import { Heartbeat } from '@phosphor-icons/react/Heartbeat';
import { TrendDown } from '@phosphor-icons/react/TrendDown';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { Wallet } from '@phosphor-icons/react/Wallet';

function currency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
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
    loading,
    syncing,
    error,
    sync,
    createLinkToken,
    exchangePublicToken,
  } = useFinancialHealth();

  useEffect(() => {
    loadPlaidScript();
  }, []);

  const handleConnect = useCallback(async () => {
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
        onSuccess: async (publicToken) => {
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

  const pulse = summary.pulse;

  return (
    <div className="settings-panel p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="executive-eyebrow">Money Intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight">Financial Health Pulse</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Link live bank feeds, analyze cash flow, and keep a continuous pulse on financial resilience.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => sync()} disabled={syncing || loading} className="gap-2">
            <ArrowsClockwise size={14} />
            Sync
          </Button>
          <Button onClick={handleConnect} disabled={syncing || loading} className="gap-2">
            <Bank size={15} />
            Link Bank
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {error}
        </Card>
      )}

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

      <Card className="p-5">
        <p className="text-sm font-semibold mb-1">Companion Analysis</p>
        <p className="text-sm text-muted-foreground">{pulse.narrative}</p>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Linked Accounts</p>
            <Badge variant="secondary">{summary.accounts.length}</Badge>
          </div>

          {summary.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No financial accounts linked yet.</p>
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
