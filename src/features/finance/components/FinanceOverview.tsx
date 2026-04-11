/**
 * FinanceOverview — Top-level financial summary and key metrics panel.
 *
 * Displays the "command center" dashboard: KPI strip, scorecard summary,
 * linked accounts overview, obligation metrics, cash flow trend, and insights.
 *
 * Consumes data from all finance hooks via props to keep this a pure
 * presentation component. The orchestrator (FinancePage) owns the hooks.
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard } from '@phosphor-icons/react/CreditCard';
import { currency, scoreLabelVariant, dimensionDisplayName } from '../lib/finance-utils';
import type { LinkedAccountsDashboard } from '@/types/stripe-financial';
import type { ScorecardLabel } from '@/types/premium-finance';

export interface FinanceOverviewProps {
  /** Linked accounts dashboard from Stripe hook */
  linkedAccounts: LinkedAccountsDashboard;
  linkedAccountsLoading: boolean;
  /** Pulse data from financial health hook */
  pulse: {
    score: number;
    trend: string;
    narrative: string;
    metrics: {
      income30d: number;
      expenses30d: number;
      netCashFlow30d: number;
      savingsRate: number;
      liquidityDays: number;
      totalBalance: number;
    };
    lastEvaluatedAt: string;
  };
  /** Snapshot from financial intelligence */
  snapshot: {
    totalUpcomingObligations: number;
    minimumPaymentsThisMonth: number;
    dueSoonCount: number;
    overdueCount: number;
    totalRevolvingBalances: number;
    utilizationPercent: number;
    pressure7d: number;
    pressure30d: number;
  };
  /** Scorecard data */
  scorecard: {
    overall_score: number;
    overall_label: string;
    strongest_area: string;
    most_urgent_area: string;
    liquidity_score: number;
    liquidity_label: string;
    bill_pressure_score: number;
    bill_pressure_label: string;
    debt_pressure_score: number;
    debt_pressure_label: string;
    savings_health_score: number;
    savings_health_label: string;
    organization_score: number;
    organization_label: string;
    vehicle_position_score: number;
    vehicle_position_label: string;
    insights: { message: string; severity: string }[];
    next_actions: { title: string; description: string; priority: string }[];
    computed_at?: string;
  } | null;
  /** Decoded bills needing review */
  pendingBillReviewCount: number;
  pendingBills: { id: string; provider_name?: string; bill_type: string; due_date?: string; extraction_confidence: number; total_due?: number }[];
  /** Active vehicles */
  activeVehicles: { id: string; year: number; make: string; model: string; trim?: string; estimated_value?: number; current_payoff?: number; equity_position: number }[];
  /** Cash flow periods */
  cashFlowPeriods: { id: string; period_label: string; total_inflow: number; total_outflow: number; net_flow: number; transaction_count: number }[];
  /** Documents */
  documents: { id: string; filename: string; source_type: string; parse_confidence?: number; document_status: string }[];
  /** Insights */
  insights: { id: string; title: string; summary: string; severity: string; action_hint?: string }[];
  /** Stripe connect action */
  stripeConnecting: boolean;
  onStripeConnect: () => void;
  /** Navigate to a tab */
  onNavigateTab: (tab: string) => void;
}

export function FinanceOverview({
  linkedAccounts,
  linkedAccountsLoading,
  pulse,
  snapshot: snap,
  scorecard,
  pendingBillReviewCount,
  pendingBills,
  activeVehicles,
  cashFlowPeriods,
  documents,
  insights,
  stripeConnecting,
  onStripeConnect,
  onNavigateTab,
}: FinanceOverviewProps) {
  const hasAccounts = linkedAccounts.aggregates.accountCount > 0;

  return (
    <div className="space-y-6">
      {/* ── KPI Metrics Strip ── */}
      <div className="fi-kpi-strip">
        {hasAccounts && (
          <div className="fi-kpi-cell">
            <div className="fi-kpi-label">Net Balance</div>
            <div className={`fi-kpi-value ${linkedAccounts.aggregates.totalBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {currency(linkedAccounts.aggregates.totalBalance)}
            </div>
            <div className="fi-kpi-sub">{linkedAccounts.aggregates.accountCount} account{linkedAccounts.aggregates.accountCount !== 1 ? 's' : ''}</div>
          </div>
        )}
        {hasAccounts && (
          <div className="fi-kpi-cell">
            <div className="fi-kpi-label">Cash on Hand</div>
            <div className="fi-kpi-value text-blue-300">{currency(linkedAccounts.aggregates.totalCashOnHand)}</div>
            <div className="fi-kpi-sub">Checking & Savings</div>
          </div>
        )}
        {hasAccounts && (
          <div className="fi-kpi-cell">
            <div className="fi-kpi-label">Avail. Credit</div>
            <div className="fi-kpi-value text-amber-300">{currency(linkedAccounts.aggregates.totalAvailableCredit)}</div>
            <div className="fi-kpi-sub">Credit Lines</div>
          </div>
        )}
        <div className="fi-kpi-cell">
          <div className="fi-kpi-label">Cash Flow 30d</div>
          <div className={`fi-kpi-value ${pulse.metrics.netCashFlow30d >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {currency(pulse.metrics.netCashFlow30d)}
          </div>
          <div className="fi-kpi-sub">In {currency(pulse.metrics.income30d)} · Out {currency(pulse.metrics.expenses30d)}</div>
        </div>
        {(() => {
          const deltaToCover = pulse.metrics.income30d - snap.minimumPaymentsThisMonth;
          return (
            <div className="fi-kpi-cell">
              <div className="fi-kpi-label">Delta to Cover</div>
              <div className={`fi-kpi-value ${deltaToCover >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {deltaToCover >= 0 ? '+' : ''}{currency(deltaToCover)}
              </div>
              <div className="fi-kpi-sub">Income vs min. obligations</div>
            </div>
          );
        })()}
        <div className="fi-kpi-cell">
          <div className="fi-kpi-label">Runway</div>
          <div className="fi-kpi-value">{pulse.metrics.liquidityDays.toFixed(0)}d</div>
          <div className="fi-kpi-sub">Liquidity buffer</div>
        </div>
        <div className="fi-kpi-cell">
          <div className="fi-kpi-label">Savings Rate</div>
          <div className={`fi-kpi-value ${pulse.metrics.savingsRate >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {pulse.metrics.savingsRate.toFixed(1)}%
          </div>
          <div className="fi-kpi-sub">
            {(() => {
              const d = pulse.lastEvaluatedAt ? new Date(pulse.lastEvaluatedAt) : null;
              return d && d.getTime() > 0 ? `Last updated ${d.toLocaleDateString()}` : 'Not yet evaluated';
            })()}
          </div>
        </div>
      </div>

      {/* ── Linked Accounts Summary ── */}
      {linkedAccountsLoading && linkedAccounts.accounts.length === 0 && (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground animate-pulse">Loading linked accounts…</p>
        </Card>
      )}

      {!linkedAccountsLoading && linkedAccounts.accounts.length === 0 && (
        <Card className="p-5 border-dashed border-border/50 text-center space-y-3">
          <CreditCard size={28} className="mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No bank accounts linked yet. Connect an account to unlock full financial intelligence.</p>
          <Button size="sm" variant="outline" onClick={onStripeConnect} disabled={stripeConnecting} className="gap-2">
            <CreditCard size={14} />
            {stripeConnecting ? 'Connecting…' : 'Link Bank Account'}
          </Button>
        </Card>
      )}

      {linkedAccounts.accounts.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Linked Accounts</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {linkedAccounts.accounts.length} account{linkedAccounts.accounts.length !== 1 ? 's' : ''}
              </Badge>
              {linkedAccounts.totalTransactions > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {linkedAccounts.totalTransactions} transactions
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {linkedAccounts.accounts.map(acct => (
              <div key={acct.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{acct.institution_name || 'Unknown Institution'}</p>
                  <p className="text-xs text-muted-foreground">
                    {acct.account_display_name || acct.account_subtype || 'Account'} {acct.account_last4 ? `••${acct.account_last4}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {acct.latest_balance ? (
                    <p className="text-sm font-semibold">{currency(acct.latest_balance.current_balance ?? 0)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">Syncing…</p>
                  )}
                  <Badge variant={acct.status === 'connected' ? 'default' : 'secondary'} className="text-[10px] capitalize mt-0.5">{acct.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Financial Scorecard Summary ── */}
      {scorecard && (
        <Card className="p-5 border-primary/20">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-semibold">Financial Operating Scorecard</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Strongest: {dimensionDisplayName(scorecard.strongest_area)} • Most urgent: {dimensionDisplayName(scorecard.most_urgent_area)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tracking-tight">{scorecard.overall_score}</span>
              <Badge variant={scoreLabelVariant(scorecard.overall_label)} className="capitalize">{scorecard.overall_label}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {([
              ['liquidity', scorecard.liquidity_score, scorecard.liquidity_label],
              ['bill_pressure', scorecard.bill_pressure_score, scorecard.bill_pressure_label],
              ['debt_pressure', scorecard.debt_pressure_score, scorecard.debt_pressure_label],
              ['savings_health', scorecard.savings_health_score, scorecard.savings_health_label],
              ['organization', scorecard.organization_score, scorecard.organization_label],
              ['vehicle_position', scorecard.vehicle_position_score, scorecard.vehicle_position_label],
            ] as [string, number, string][]).map(([name, score, label]) => (
              <div key={name} className="rounded-lg border border-border/70 p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{dimensionDisplayName(name)}</p>
                <p className="text-2xl font-bold">{score}</p>
                <Badge variant={scoreLabelVariant(label as ScorecardLabel)} className="text-xs capitalize mt-1">{label}</Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 border-t border-border/50 pt-2">
            This scorecard is a planning tool for financial visibility. It is not financial advice and should not be used as a credit assessment.
          </p>
        </Card>
      )}

      {/* ── Scorecard Insights ── */}
      {scorecard && scorecard.insights.length > 0 && (
        <Card className="p-5 space-y-2">
          <p className="text-sm font-semibold">Financial Insights</p>
          {scorecard.insights.map((insight, i) => (
            <div key={i} className="rounded-lg border border-border/70 p-3 flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground">{insight.message}</p>
              <Badge variant={insight.severity === 'critical' || insight.severity === 'high' ? 'destructive' : insight.severity === 'positive' ? 'default' : 'secondary'} className="capitalize shrink-0">{insight.severity}</Badge>
            </div>
          ))}
        </Card>
      )}

      {/* ── Scorecard Next Actions ── */}
      {scorecard && scorecard.next_actions.length > 0 && (
        <Card className="p-5 space-y-2">
          <p className="text-sm font-semibold">Recommended Next Steps</p>
          {scorecard.next_actions.slice(0, 5).map((action, i) => (
            <div key={i} className="rounded-lg border border-border/70 p-3 flex items-start gap-3">
              <Badge variant={action.priority === 'critical' || action.priority === 'high' ? 'destructive' : 'secondary'} className="capitalize shrink-0 mt-0.5">{action.priority}</Badge>
              <div>
                <p className="text-sm font-medium">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── Decoded Bills Needing Review ── */}
      {pendingBillReviewCount > 0 && (
        <Card className="p-5 space-y-2 border-amber-500/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Bills Pending Review</p>
            <Badge variant="secondary">{pendingBillReviewCount} pending</Badge>
          </div>
          {pendingBills.slice(0, 3).map((bill) => (
            <div key={bill.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{bill.provider_name || bill.bill_type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">Due {bill.due_date || 'n/a'} • {(bill.extraction_confidence * 100).toFixed(0)}% confidence</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{bill.total_due ? currency(bill.total_due) : 'n/a'}</p>
                <Button size="sm" variant="outline" className="mt-1" onClick={() => onNavigateTab('decoder')}>Review</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── Vehicle Equity Snapshot ── */}
      {activeVehicles.length > 0 && (
        <Card className="p-5 space-y-2">
          <p className="text-sm font-semibold">Vehicle Equity Position</p>
          {activeVehicles.map((v) => (
            <div key={v.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ''}</p>
                <p className="text-xs text-muted-foreground">
                  Value: {v.estimated_value ? currency(v.estimated_value) : 'n/a'} • Payoff: {v.current_payoff ? currency(v.current_payoff) : 'n/a'}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${v.equity_position >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {v.equity_position >= 0 ? '+' : ''}{currency(v.equity_position)}
                </p>
                <p className="text-xs text-muted-foreground">{v.equity_position >= 0 ? 'equity' : 'negative equity'}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── Core Metrics Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Upcoming Obligations</p>
          <p className="text-2xl font-semibold">{currency(snap.totalUpcomingObligations)}</p>
          <p className="text-xs text-muted-foreground mt-2">{snap.dueSoonCount} due within 14 days</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Minimum Dues (Month)</p>
          <p className="text-2xl font-semibold">{currency(snap.minimumPaymentsThisMonth)}</p>
          <p className="text-xs text-muted-foreground mt-2">Overdue items: {snap.overdueCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Revolving Utilization</p>
          <p className={`text-2xl font-semibold ${snap.utilizationPercent >= 75 ? 'text-rose-300' : 'text-foreground'}`}>{snap.utilizationPercent.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-2">Balances: {currency(snap.totalRevolvingBalances)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Cash Pressure</p>
          <p className="text-2xl font-semibold">{currency(snap.pressure7d)}</p>
          <p className="text-xs text-muted-foreground mt-2">7d load • 30d {currency(snap.pressure30d)}</p>
        </Card>
      </div>

      {/* ── Cash Flow Trend ── */}
      {cashFlowPeriods.length > 0 && (
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold">Cash Flow Trend</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {cashFlowPeriods.slice(0, 3).map((period) => (
              <div key={period.id} className="rounded-lg border border-border/70 p-4">
                <p className="text-sm font-medium mb-2">{period.period_label}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Inflow</span>
                    <span className="text-emerald-300">+{currency(period.total_inflow)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Outflow</span>
                    <span className="text-rose-300">-{currency(period.total_outflow)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-border/50 pt-1 mt-1">
                    <span>Net</span>
                    <span className={period.net_flow >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{currency(period.net_flow)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{period.transaction_count} transactions</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Documents and Insights Side-by-Side ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5 space-y-2">
          <p className="text-sm font-semibold">Recent Document Intake</p>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Upload statements to begin structured extraction.</p>
          ) : (
            documents.slice(0, 6).map((doc) => (
              <div key={doc.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">{doc.source_type.replace(/_/g, ' ')} • confidence {((doc.parse_confidence || 0) * 100).toFixed(0)}%</p>
                </div>
                <Badge variant="secondary" className="capitalize">{doc.document_status}</Badge>
              </div>
            ))
          )}
        </Card>

        <Card className="p-5 space-y-2">
          <p className="text-sm font-semibold">Active Financial Insights</p>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active alerts. Run analysis and keep ingesting documents for richer intelligence.</p>
          ) : (
            insights.slice(0, 6).map((insight) => (
              <div key={insight.id} className="rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold">{insight.title}</p>
                  <Badge variant={insight.severity === 'critical' || insight.severity === 'high' ? 'destructive' : 'secondary'} className="capitalize">{insight.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{insight.summary}</p>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
