import { motion, useReducedMotion } from 'framer-motion';
import { CompanionStatusIcon } from '@/components/CompanionStatusIcon';
import type { CompanionState } from '@/types';
import { useLifeOS } from '@/hooks/use-life-os';
import { useFinancialHealth } from '@/hooks/use-financial-health';
import { useFinancialIntelligence } from '@/hooks/use-financial-intelligence';
import { useAutomotiveFinance } from '@/hooks/use-automotive-finance';
import { ArrowRight } from '@phosphor-icons/react/ArrowRight';
import { Brain } from '@phosphor-icons/react/Brain';
import { ChatCircle } from '@phosphor-icons/react/ChatCircle';
import { Briefcase } from '@phosphor-icons/react/Briefcase';
import { Car } from '@phosphor-icons/react/Car';
import { Images } from '@phosphor-icons/react/Images';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { Money } from '@phosphor-icons/react/Money';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { Target } from '@phosphor-icons/react/Target';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { TrendDown } from '@phosphor-icons/react/TrendDown';
import { Warning } from '@phosphor-icons/react/Warning';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { CurrencyDollar } from '@phosphor-icons/react/CurrencyDollar';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';

interface HomeDashboardProps {
  companionState: CompanionState;
  aiName: string;
  onNavigate: (section: string) => void;
}

const STATE_LABELS: Record<CompanionState, string> = {
  idle: 'Ready for execution',
  listening: 'Listening',
  thinking: 'Reasoning',
  speaking: 'Responding',
  'generating-image': 'Generating image',
  'generating-video': 'Generating video',
  writing: 'Drafting output',
  analyzing: 'Analyzing context',
};

const quickActions = [
  { id: 'chat', label: 'Strategic Chat', description: 'High-context text collaboration', icon: ChatCircle },
  { id: 'live-talk', label: 'Live Voice', description: 'Real-time conversational mode', icon: Microphone },
  { id: 'media', label: 'Media Studio', description: 'Generate visual and video assets', icon: Images },
  { id: 'finance', label: 'Finance Pulse', description: 'Live cashflow and resilience tracking', icon: Money },
  { id: 'automotive-finance', label: 'F&I Workspace', description: 'Deal pipeline and lender ops', icon: Car },
  { id: 'workflows', label: 'Workflow Ops', description: 'Run repeatable operational logic', icon: Lightning },
];

function formatCurrency(n: number | undefined | null): string {
  if (n == null) return '$0';
  return n < 0
    ? `-$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function HomeDashboard({ companionState, aiName, onNavigate }: HomeDashboardProps) {
  const reduceMotion = useReducedMotion();
  const { dashboard: lifeOs } = useLifeOS();
  const { summary: financialHealth } = useFinancialHealth();
  const { dashboard: fiDashboard } = useFinancialIntelligence();
  const { dashboard: autoDashboard } = useAutomotiveFinance();

  // --- Life OS signals ---
  const activeGoals = lifeOs?.goals?.filter((g) => g.status === 'active') ?? [];
  const urgentSignals = lifeOs?.signals?.filter((s) => s.severity === 'high' || s.severity === 'critical') ?? [];
  const atRiskGoals = activeGoals.filter((g) => (g.feasibility_score ?? 100) < 50);

  // --- Financial intelligence ---
  const fiSnapshot = fiDashboard?.snapshot;
  const fiInsights = fiDashboard?.insights?.filter((i) => i.severity === 'high' || i.severity === 'critical') ?? [];
  const dueSoonCount = fiSnapshot?.dueSoonCount ?? 0;
  const overdueCount = fiSnapshot?.overdueCount ?? 0;

  // --- Financial health ---
  const pulse = financialHealth?.pulse;
  const cashFlow = pulse?.metrics?.netCashFlow30d;
  const savingsRate = pulse?.metrics?.savingsRate;
  const healthScore = pulse?.score;

  // --- Automotive finance ---
  const autoSummary = autoDashboard?.summary;
  const hasAutoData = autoSummary && autoSummary.totalDeals > 0;

  // --- Total urgency count for the strip ---
  const totalUrgent = urgentSignals.length + fiInsights.length + overdueCount + (autoSummary?.openFlags ?? 0) + (autoSummary?.callbacksWaiting ?? 0);

  const fade = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0.1 : 0.28, delay: reduceMotion ? 0 : delay },
  });

  return (
    <div className="executive-shell container-scroll">
      {/* Header */}
      <div className="executive-header">
        <div>
          <p className="executive-eyebrow">Vuk OS Command Center</p>
          <h1 className="leading-tight">{aiName}</h1>
          <p className="executive-subtitle">
            Private operating environment — planning, decision support, and execution.
          </p>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="executive-grid md:grid-cols-4 mb-4">
        <motion.div {...fade(0)} className="executive-kpi">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Health Score</p>
            <ShieldCheck size={16} style={{ color: 'var(--vuk-accent-dim)' }} />
          </div>
          <p className="text-2xl font-semibold tracking-tight leading-none">
            {healthScore != null ? `${healthScore}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {pulse?.trend === 'improving' ? 'Trending up' : pulse?.trend === 'tightening' ? 'Tightening' : 'Stable'}
          </p>
        </motion.div>

        <motion.div {...fade(0.05)} className="executive-kpi">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cash Flow (30d)</p>
            {(cashFlow ?? 0) >= 0
              ? <TrendUp size={16} className="text-emerald-400" />
              : <TrendDown size={16} className="text-red-400" />}
          </div>
          <p className={`text-2xl font-semibold tracking-tight leading-none ${
            (cashFlow ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {cashFlow != null ? formatCurrency(cashFlow) : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {savingsRate != null ? `${(savingsRate * 100).toFixed(0)}% savings rate` : 'Connect accounts to track'}
          </p>
        </motion.div>

        <motion.div {...fade(0.1)} className="executive-kpi">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active Goals</p>
            <Target size={16} style={{ color: 'var(--vuk-accent-dim)' }} />
          </div>
          <p className="text-2xl font-semibold tracking-tight leading-none">{activeGoals.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {atRiskGoals.length > 0 ? (
              <span className="text-amber-400">{atRiskGoals.length} at risk</span>
            ) : 'All on track'}
          </p>
        </motion.div>

        <motion.div {...fade(0.15)} className="executive-kpi">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Attention Items</p>
            <Warning size={16} className={totalUrgent > 0 ? 'text-amber-400' : 'text-muted-foreground'} />
          </div>
          <p className={`text-2xl font-semibold tracking-tight leading-none ${totalUrgent > 0 ? 'text-amber-400' : ''}`}>
            {totalUrgent}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalUrgent === 0 ? 'All clear' : 'Signals, overdue, flags'}
          </p>
        </motion.div>
      </div>

      {/* ── Urgent Signals Strip ── */}
      {totalUrgent > 0 && (
        <motion.div {...fade(0.15)} className="mb-4 space-y-1.5">
          {urgentSignals.slice(0, 2).map((sig) => (
            <button
              key={sig.id}
              type="button"
              onClick={() => onNavigate('goals')}
              className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-white/5 ${
                sig.severity === 'critical'
                  ? 'border-red-500/40 bg-red-500/8 text-red-300'
                  : 'border-amber-500/40 bg-amber-500/8 text-amber-300'
              }`}
            >
              <span className="font-medium">{sig.title}</span>
              {sig.action_hint && <span className="text-muted-foreground ml-2">— {sig.action_hint}</span>}
            </button>
          ))}
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="w-full text-left rounded-lg border border-red-500/40 bg-red-500/8 text-red-300 px-3 py-2 text-xs transition-colors hover:bg-white/5"
            >
              <span className="font-medium">{overdueCount} overdue obligation{overdueCount > 1 ? 's' : ''}</span>
              <span className="text-muted-foreground ml-2">— Review in Finance Pulse</span>
            </button>
          )}
          {fiInsights.slice(0, 2).map((ins) => (
            <button
              key={ins.id}
              type="button"
              onClick={() => onNavigate('finance')}
              className="w-full text-left rounded-lg border border-amber-500/40 bg-amber-500/8 text-amber-300 px-3 py-2 text-xs transition-colors hover:bg-white/5"
            >
              <span className="font-medium">{ins.title}</span>
              {ins.action_hint && <span className="text-muted-foreground ml-2">— {ins.action_hint}</span>}
            </button>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* ── Financial Intelligence Card ── */}
        <motion.section {...fade(0.18)} className="glass-card rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="executive-eyebrow">Financial Intelligence</p>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-[11px] uppercase tracking-[0.14em] hover:opacity-80 transition-opacity"
              style={{ color: 'var(--vuk-accent-dim)' }}
            >
              Open →
            </button>
          </div>

          {fiSnapshot ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
                  <p className="text-lg font-semibold">{formatCurrency(fiSnapshot.totalUpcomingObligations)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Upcoming</p>
                </div>
                <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
                  <p className={`text-lg font-semibold ${dueSoonCount > 0 ? 'text-amber-400' : ''}`}>{dueSoonCount}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Due Soon</p>
                </div>
                <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
                  <p className={`text-lg font-semibold ${(fiSnapshot.utilizationPercent ?? 0) > 70 ? 'text-red-400' : ''}`}>
                    {fiSnapshot.utilizationPercent != null ? `${fiSnapshot.utilizationPercent}%` : '—'}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Utilization</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarBlank size={12} />
                <span>7-day pressure: {formatCurrency(fiSnapshot.pressure7d)} · 30-day: {formatCurrency(fiSnapshot.pressure30d)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <CurrencyDollar size={28} className="mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Upload a bill or connect accounts to begin</p>
              <button
                type="button"
                onClick={() => onNavigate('finance')}
                className="mt-3 rounded-full px-4 py-1.5 text-[11px] tracking-[0.16em] uppercase text-muted-foreground hover:text-foreground transition-all"
                style={{ border: '1px solid var(--vuk-border-accent)', background: 'var(--vuk-active-bg)' }}
              >
                Get Started
              </button>
            </div>
          )}
        </motion.section>

        {/* ── Automotive F&I Card ── */}
        <motion.section {...fade(0.22)} className="glass-card rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="executive-eyebrow">F&I Command</p>
            <button
              type="button"
              onClick={() => onNavigate('automotive-finance')}
              className="text-[11px] uppercase tracking-[0.14em] hover:opacity-80 transition-opacity"
              style={{ color: 'var(--vuk-accent-dim)' }}
            >
              Open →
            </button>
          </div>

          {hasAutoData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
                  <p className="text-lg font-semibold">{autoSummary.totalDeals}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Active Deals</p>
                </div>
                <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
                  <p className={`text-lg font-semibold ${autoSummary.callbacksWaiting > 0 ? 'text-amber-400' : ''}`}>
                    {autoSummary.callbacksWaiting}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Callbacks</p>
                </div>
                <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
                  <p className={`text-lg font-semibold ${autoSummary.openFlags > 0 ? 'text-red-400' : ''}`}>
                    {autoSummary.openFlags}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Open Flags</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {autoSummary.dealsReadyForMenu > 0 && (
                  <span className="flex items-center gap-1">
                    <ChartLineUp size={12} className="text-emerald-400" />
                    {autoSummary.dealsReadyForMenu} ready for menu
                  </span>
                )}
                {autoSummary.bookedNotFunded > 0 && (
                  <span className="flex items-center gap-1">
                    <Warning size={12} className="text-amber-400" />
                    {autoSummary.bookedNotFunded} booked, not funded
                  </span>
                )}
                {autoSummary.dealsInCit > 0 && (
                  <span className="flex items-center gap-1">
                    <Warning size={12} className="text-red-400" />
                    {autoSummary.dealsInCit} in CIT
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Car size={28} className="mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No active deals. Start a deal to use the F&I workspace.</p>
              <button
                type="button"
                onClick={() => onNavigate('automotive-finance')}
                className="mt-3 rounded-full px-4 py-1.5 text-[11px] tracking-[0.16em] uppercase text-muted-foreground hover:text-foreground transition-all"
                style={{ border: '1px solid var(--vuk-border-accent)', background: 'var(--vuk-active-bg)' }}
              >
                Open Workspace
              </button>
            </div>
          )}
        </motion.section>
      </div>

      {/* ── Life OS + Goals ── */}
      {activeGoals.length > 0 && (
        <motion.section {...fade(0.24)} className="glass-card rounded-2xl p-5 md:p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="executive-eyebrow">Life OS — Active Goals</p>
            <button
              type="button"
              onClick={() => onNavigate('goals')}
              className="text-[11px] uppercase tracking-[0.14em] hover:opacity-80 transition-opacity"
              style={{ color: 'var(--vuk-accent-dim)' }}
            >
              View All →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeGoals.slice(0, 4).map((g) => {
              const isAtRisk = (g.feasibility_score ?? 100) < 50;
              return (
                <div
                  key={g.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    isAtRisk ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/40 bg-black/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate mr-2">{g.title}</p>
                    {g.feasibility_score != null && (
                      <span className={`text-[10px] font-semibold tabular-nums ${isAtRisk ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {g.feasibility_score}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                    {g.life_category}{g.is_financial && g.target_amount ? ` · ${formatCurrency(Number(g.target_amount))}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ── Intelligence Core + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
        <motion.section {...fade(0.28)} className="glass-card rounded-2xl p-5 md:p-6">
          <p className="executive-eyebrow">Intelligence Core</p>
          <div className="flex flex-col items-center text-center">
            <CompanionStatusIcon state={companionState} size="lg" onClick={() => onNavigate('live-talk')} />
            <p className="mt-4 text-2xl font-semibold tracking-tight">{STATE_LABELS[companionState]}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {pulse?.narrative || 'All systems available'}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('live-talk')}
              className="mt-5 rounded-full px-4 py-1.5 text-[11px] tracking-[0.16em] uppercase text-muted-foreground hover:text-foreground transition-all"
              style={{ border: '1px solid var(--vuk-border-accent)', background: 'var(--vuk-active-bg)' }}
            >
              Open Live Session
            </button>
          </div>
        </motion.section>

        <motion.section {...fade(0.32)} className="glass-card rounded-2xl p-5 md:p-6">
          <p className="executive-eyebrow">Quick Actions</p>
          <div className="space-y-2">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: reduceMotion ? 0 : -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduceMotion ? 0.1 : 0.22, delay: reduceMotion ? 0 : 0.35 + i * 0.04 }}
                  onClick={() => onNavigate(action.id)}
                  className="executive-action p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-8 w-8 rounded-lg inline-flex items-center justify-center"
                        style={{ background: 'var(--vuk-active-bg)', border: '1px solid var(--vuk-border-accent)' }}
                      >
                        <Icon size={16} style={{ color: 'var(--vuk-accent-light)' }} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold tracking-tight">{action.label}</p>
                        <p className="text-[11px] text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                    <ArrowRight size={13} className="text-muted-foreground" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
