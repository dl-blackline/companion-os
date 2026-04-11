/**
 * FinancePage — v2 modular finance orchestrator for Companion OS.
 *
 * Phase 2: The finance experience is now composed from modular panels:
 *   - FinanceOverview (command center dashboard)
 *   - AccountsPanel (linked Stripe Financial Connections accounts)
 *   - TransactionsPanel (transaction feed with filters)
 *   - LedgerPanel (future money tracking)
 *   - ObligationsPanel (bills / planner board)
 *   - GoalsPanel (savings goals & progress)
 *   - InsightsPanel (AI financial insights + narrative)
 *
 * The remaining analysis tabs (decoder, scorecard, vehicles, income,
 * cashflow, recurring, documents, calendar) are rendered inline here
 * using the same hooks. They remain candidates for Phase 3
 * modularization once their individual complexity justifies extraction.
 *
 * Banking provider: Stripe Financial Connections is the active path.
 * Plaid references are not surfaced in the v2 finance experience.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useFinancialHealth } from '@/hooks/use-financial-health';
import { useFinancialIntelligence } from '@/hooks/use-financial-intelligence';
import { useFinancialAnalysis } from '@/hooks/use-financial-analysis';
import { useBillDecoder } from '@/hooks/use-bill-decoder';
import { useFinancialScorecard } from '@/hooks/use-financial-scorecard';
import { useStripeFinancialConnections } from '@/hooks/use-stripe-financial-connections';
import { useTransactionFeed } from '@/hooks/use-transaction-feed';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'sonner';

/* ── Phosphor icons ───────────────────────────────────────────────────────── */
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { Bank } from '@phosphor-icons/react/Bank';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { CreditCard } from '@phosphor-icons/react/CreditCard';
import { FileArrowUp } from '@phosphor-icons/react/FileArrowUp';
import { Heartbeat } from '@phosphor-icons/react/Heartbeat';
import { Lightbulb } from '@phosphor-icons/react/Lightbulb';
import { ListBullets } from '@phosphor-icons/react/ListBullets';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { PaperPlaneRight } from '@phosphor-icons/react/PaperPlaneRight';
import { ChatCircleDots } from '@phosphor-icons/react/ChatCircleDots';
import { Note } from '@phosphor-icons/react/Note';
import { PiggyBank } from '@phosphor-icons/react/PiggyBank';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { Wallet } from '@phosphor-icons/react/Wallet';

/* ── Modular finance panels ───────────────────────────────────────────────── */
import { FinanceOverview } from '../components/FinanceOverview';
import { AccountsPanel } from '../components/AccountsPanel';
import { TransactionsPanel } from '../components/TransactionsPanel';
import { LedgerPanel } from '../components/LedgerPanel';
import { ObligationsPanel } from '../components/ObligationsPanel';
import { GoalsPanel } from '../components/GoalsPanel';
import { InsightsPanel } from '../components/InsightsPanel';

/* ── Shared utilities ─────────────────────────────────────────────────────── */
import {
  currency,
  estimateMonthly,
  confidenceLabel,
  frequencyLabel,
  scoreLabelVariant,
  dimensionDisplayName,
} from '../lib/finance-utils';

/* ── Types ────────────────────────────────────────────────────────────────── */
import type { FinancialDocumentSourceType } from '@/types/financial-intelligence';
import type { RecurringIncomeSignal, RecurringExpenseSignal } from '@/types/financial-analysis';
import type { DecodedBill, ScorecardLabel } from '@/types/premium-finance';

/* ── Stripe setup ─────────────────────────────────────────────────────────── */
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

/* ── Tab type ─────────────────────────────────────────────────────────────── */
type FinanceTab =
  | 'dashboard' | 'accounts' | 'transactions' | 'ledger'
  | 'decoder' | 'scorecard' | 'vehicles' | 'income'
  | 'cashflow' | 'recurring' | 'documents' | 'planner'
  | 'goals' | 'calendar' | 'insights';

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  FinancePage — v2 Orchestrator                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function FinancePage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard');

  /* ── Hooks ──────────────────────────────────────────────────────────────── */
  const {
    summary,
    loading,
    syncing,
    error,
    sync,
  } = useFinancialHealth();

  const {
    dashboard,
    loading: intelligenceLoading,
    saving: intelligenceSaving,
    error: intelligenceError,
    uploadAndIngestDocument,
    aiFinancialIntake,
    saveObligation,
    deleteObligation,
    saveGoal,
    deleteGoal,
    saveCalendarEvent,
    deleteCalendarEvent,
    refreshInsights,
  } = useFinancialIntelligence();

  const {
    dashboard: analysisDashboard,
    loading: analysisLoading,
    analyzing,
    error: analysisError,
    runAnalysis,
    confirmIncomeSignal,
    confirmExpenseSignal,
    dismissSignal,
    addManualIncome,
  } = useFinancialAnalysis();

  const {
    dashboard: decoderDashboard,
    loading: decoderLoading,
    decoding,
    error: decoderError,
    decodeDocument,
    confirmBill,
    rejectBill,
    updateBillField,
  } = useBillDecoder();

  const {
    dashboard: scorecardDashboard,
    loading: scorecardLoading,
    computing,
    error: scorecardError,
    computeScorecard,
    upsertVehicle,
    deleteVehicle,
  } = useFinancialScorecard();

  const {
    dashboard: linkedAccountsDashboard,
    loading: linkedAccountsLoading,
    connecting: stripeConnecting,
    syncing: stripeSyncing,
    error: stripeError,
    createSession,
    completeSession,
    refreshAccount,
    syncTransactions,
    updateAccount,
    disconnectAccount,
    removeAccount,
    createLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
  } = useStripeFinancialConnections();

  const {
    transactions: txFeed,
    pagination: txPagination,
    categories: txCategories,
    loading: txLoading,
    error: txError,
    filters: txFilters,
    applyFilters,
    loadMore: txLoadMore,
    updateCategory,
    updateNotes,
    refresh: txRefresh,
  } = useTransactionFeed();

  /* ── Stripe connect handler ─────────────────────────────────────────────── */
  const handleStripeConnect = useCallback(async () => {
    try {
      const sessionPayload = await createSession();
      if (!sessionPayload) return;

      if (!stripePromise) {
        toast.error('Stripe is not configured. VITE_STRIPE_PUBLISHABLE_KEY is missing.');
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        toast.error('Failed to load Stripe.');
        return;
      }

      sessionStorage.setItem('stripe_fc_session_id', sessionPayload.sessionId);

      const result = await stripe.collectFinancialConnectionsAccounts({
        clientSecret: sessionPayload.clientSecret,
      });

      if (result.error) {
        if (result.error.type === 'validation_error') {
          toast.error(result.error.message || 'Validation error.');
        }
        return;
      }

      const linkedAccounts = result.financialConnectionsSession?.accounts ?? [];
      const accountIds = Array.isArray(linkedAccounts)
        ? linkedAccounts.map((a: { id: string }) => a.id)
        : (linkedAccounts as { data?: { id: string }[] })?.data?.map((a) => a.id) ?? [];

      const success = await completeSession(sessionPayload.sessionId, accountIds);
      if (success) {
        toast.success('Bank account linked via Stripe. Syncing data…');
        setActiveTab('accounts');
      }
      void txRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to start Stripe account linking.');
    }
  }, [createSession, completeSession, txRefresh]);

  /* ── Auto-refresh transactions on sync completion ───────────────────────── */
  const wasSyncingRef = useRef(false);
  useEffect(() => {
    if (wasSyncingRef.current && !stripeSyncing) {
      txRefresh();
    }
    wasSyncingRef.current = stripeSyncing;
  }, [stripeSyncing, txRefresh]);

  /* ── Derived data ───────────────────────────────────────────────────────── */
  const pulse = summary.pulse;
  const snap = dashboard.snapshot;
  const scorecard = scorecardDashboard.scorecard;

  const allErrors = [error, stripeError, txError, intelligenceError, analysisError, decoderError, scorecardError].filter(Boolean);

  /* ── Navigation groups ──────────────────────────────────────────────────── */
  const navGroups = [
    { label: 'Core', items: [
      { value: 'dashboard' as FinanceTab, icon: ChartLineUp, label: 'Command Center' },
      { value: 'accounts' as FinanceTab, icon: CreditCard, label: 'Accounts' },
      { value: 'transactions' as FinanceTab, icon: ListBullets, label: 'Transactions' },
      { value: 'ledger' as FinanceTab, icon: Note, label: 'Ledger' },
    ]},
    { label: 'Analysis', items: [
      { value: 'decoder' as FinanceTab, icon: FileArrowUp, label: 'Bill Decoder' },
      { value: 'scorecard' as FinanceTab, icon: Heartbeat, label: 'Scorecard' },
      { value: 'income' as FinanceTab, icon: TrendUp, label: 'Income' },
      { value: 'cashflow' as FinanceTab, icon: Wallet, label: 'Cash Flow' },
      { value: 'recurring' as FinanceTab, icon: ArrowsClockwise, label: 'Recurring' },
    ]},
    { label: 'Planning', items: [
      { value: 'planner' as FinanceTab, icon: Wallet, label: 'Obligations' },
      { value: 'goals' as FinanceTab, icon: PiggyBank, label: 'Savings' },
      { value: 'calendar' as FinanceTab, icon: CalendarBlank, label: 'Calendar' },
      { value: 'vehicles' as FinanceTab, icon: Bank, label: 'Vehicles' },
    ]},
    { label: 'Intelligence', items: [
      { value: 'documents' as FinanceTab, icon: FileArrowUp, label: 'Documents' },
      { value: 'insights' as FinanceTab, icon: Lightbulb, label: 'Insights' },
    ]},
  ];

  /* ── Analysis-tab-specific state ────────────────────────────────────────── */
  // TODO: Phase 3 — Extract these remaining tabs into modular panels.
  const [selectedDocumentType, setSelectedDocumentType] = useState<FinancialDocumentSourceType>('auto_detect');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiListening, setAiListening] = useState(false);
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState('monthly');
  const [addingIncome, setAddingIncome] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('reminder');
  const [eventDate, setEventDate] = useState('');
  const [eventAmount, setEventAmount] = useState('');
  const [vYear, setVYear] = useState('');
  const [vMake, setVMake] = useState('');
  const [vModel, setVModel] = useState('');
  const [vTrim, setVTrim] = useState('');
  const [vMileage, setVMileage] = useState('');
  const [vCondition, setVCondition] = useState('good');
  const [vPayoff, setVPayoff] = useState('');
  const [vPayment, setVPayment] = useState('');
  const [vLender, setVLender] = useState('');
  const [vTermRemaining, setVTermRemaining] = useState('');
  const [vValue, setVValue] = useState('');
  const [vValueSource, setVValueSource] = useState('user_estimate');

  /* ── Analysis-tab handlers ──────────────────────────────────────────────── */
  const handleDocumentUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingDoc(true);
    try {
      await uploadAndIngestDocument(file, selectedDocumentType);
      toast.success(selectedDocumentType === 'auto_detect'
        ? 'Document uploaded — AI classified and parsed it.'
        : 'Financial document uploaded and parsed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Document ingestion failed.');
    } finally {
      setUploadingDoc(false);
    }
  }, [selectedDocumentType, uploadAndIngestDocument]);

  const handleSaveEvent = useCallback(async () => {
    if (!eventTitle.trim() || !eventDate) {
      toast.error('Event title and date are required.');
      return;
    }
    try {
      await saveCalendarEvent({
        title: eventTitle.trim(),
        eventType: eventType as 'bill_due' | 'payday' | 'savings_transfer' | 'debt_payment' | 'reminder' | 'custom',
        scheduledDate: eventDate,
        amount: Number(eventAmount || 0),
      });
      toast.success('Financial calendar event saved.');
      setEventTitle('');
      setEventDate('');
      setEventAmount('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save calendar event.');
    }
  }, [eventAmount, eventDate, eventTitle, eventType, saveCalendarEvent]);

  const handleSaveVehicle = useCallback(async () => {
    if (!vYear || !vMake.trim() || !vModel.trim()) {
      toast.error('Year, make, and model are required.');
      return;
    }
    try {
      await upsertVehicle({
        year: Number(vYear),
        make: vMake.trim(),
        model: vModel.trim(),
        trim: vTrim.trim() || undefined,
        mileage: vMileage ? Number(vMileage) : undefined,
        condition: vCondition as 'excellent' | 'good' | 'fair' | 'poor',
        current_payoff: vPayoff ? Number(vPayoff) : undefined,
        monthly_payment: vPayment ? Number(vPayment) : undefined,
        lender: vLender.trim() || undefined,
        term_remaining_months: vTermRemaining ? Number(vTermRemaining) : undefined,
        estimated_value: vValue ? Number(vValue) : undefined,
        value_source: vValueSource,
      } as Parameters<typeof upsertVehicle>[0]);
      toast.success('Vehicle saved.');
      setVYear(''); setVMake(''); setVModel(''); setVTrim(''); setVMileage('');
      setVPayoff(''); setVPayment(''); setVLender(''); setVTermRemaining('');
      setVValue('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save vehicle.');
    }
  }, [vYear, vMake, vModel, vTrim, vMileage, vCondition, vPayoff, vPayment, vLender, vTermRemaining, vValue, vValueSource, upsertVehicle]);

  const handleAIIntake = useCallback(async () => {
    if (!aiInput.trim() || aiProcessing) return;
    setAiProcessing(true);
    setAiResponse(null);
    try {
      const result = await aiFinancialIntake(aiInput.trim());
      setAiResponse(result.response);
      const items = result.savedItems;
      const parts: string[] = [];
      if (items.obligations > 0) parts.push(`${items.obligations} obligation${items.obligations > 1 ? 's' : ''}`);
      if (items.goals > 0) parts.push(`${items.goals} goal${items.goals > 1 ? 's' : ''}`);
      if (items.events > 0) parts.push(`${items.events} event${items.events > 1 ? 's' : ''}`);
      if (parts.length > 0) {
        toast.success(`Saved ${parts.join(', ')} from your input.`);
      }
      setAiInput('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI intake failed.');
    } finally {
      setAiProcessing(false);
    }
  }, [aiInput, aiProcessing, aiFinancialIntake]);

  const handleAddManualIncome = useCallback(async () => {
    if (!incomeSource.trim() || Number(incomeAmount) <= 0) {
      toast.error('Source name and amount are required.');
      return;
    }
    setAddingIncome(true);
    try {
      await addManualIncome(incomeSource.trim(), Number(incomeAmount), incomeFrequency);
      toast.success('Manual income source added.');
      setIncomeSource('');
      setIncomeAmount('');
      setIncomeFrequency('monthly');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add income.');
    } finally {
      setAddingIncome(false);
    }
  }, [incomeSource, incomeAmount, incomeFrequency, addManualIncome]);

  const handleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setAiListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setAiInput(prev => prev ? `${prev} ${transcript}` : transcript);
      setAiListening(false);
    };

    recognition.onerror = () => {
      setAiListening(false);
      toast.error('Voice recognition failed. Try again.');
    };

    recognition.onend = () => {
      setAiListening(false);
    };

    recognition.start();
  }, []);

  /* ── Obligation / Goal save wrappers for panels ─────────────────────────── */
  const handleSaveObligation = useCallback(async (data: {
    id?: string;
    account_label: string;
    category: string;
    due_date: string;
    amount_due: number;
    minimum_due: number;
    planned_payment: number;
  }) => {
    await saveObligation({
      id: data.id,
      accountLabel: data.account_label,
      category: data.category,
      dueDate: data.due_date,
      amountDue: data.amount_due,
      minimumDue: data.minimum_due,
      plannedPayment: data.planned_payment,
      status: 'planned',
    });
    toast.success(data.id ? 'Obligation updated.' : 'Bill saved to planner.');
  }, [saveObligation]);

  const handleSaveGoal = useCallback(async (data: {
    name: string;
    target_amount: number;
    current_amount: number;
    target_date: string;
    monthly_contribution_target: number;
    priority: string;
  }) => {
    await saveGoal({
      name: data.name,
      targetAmount: data.target_amount,
      currentAmount: data.current_amount,
      targetDate: data.target_date || undefined,
      monthlyContributionTarget: data.monthly_contribution_target,
      priority: data.priority as 'low' | 'medium' | 'high' | 'critical',
    });
    toast.success('Savings goal saved.');
  }, [saveGoal]);

  /* ═══ RENDER ════════════════════════════════════════════════════════════ */
  return (
    <div className="settings-panel p-4 md:p-6 max-w-7xl mx-auto space-y-0">
      {/* ═══ COCKPIT HEADER ═══ */}
      <div className="fi-cockpit-header">
        <div className="fi-cockpit-identity">
          <p className="executive-eyebrow">Financial Intelligence</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Command Cockpit</h1>
        </div>
        <div className="fi-cockpit-actions">
          <Button variant="outline" size="sm" onClick={() => sync()} disabled={syncing || loading} className="fi-cockpit-btn gap-1.5">
            <ArrowsClockwise size={13} className={syncing ? 'animate-spin' : ''} />
            Sync
          </Button>
          <Button size="sm" onClick={handleStripeConnect} disabled={stripeConnecting || loading} className="fi-cockpit-btn fi-cockpit-btn-primary gap-1.5">
            <CreditCard size={13} />
            {stripeConnecting ? 'Linking…' : 'Link Account'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void runAnalysis()} disabled={analyzing || analysisLoading} className="fi-cockpit-btn gap-1.5">
            <ChartLineUp size={13} />
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void computeScorecard()} disabled={computing || scorecardLoading} className="fi-cockpit-btn gap-1.5">
            <Heartbeat size={13} />
            {computing ? 'Scoring…' : 'Score'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void refreshInsights()} disabled={intelligenceSaving || intelligenceLoading} className="fi-cockpit-btn gap-1.5">
            <Lightbulb size={13} />
            Insights
          </Button>
        </div>
      </div>

      {/* ═══ COCKPIT NAV ═══ */}
      <div className="fi-cockpit-nav">
        {navGroups.map(group => (
          <div key={group.label} className="fi-nav-group">
            <span className="fi-nav-group-label">{group.label}</span>
            <div className="fi-nav-group-items">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setActiveTab(item.value)}
                    className={`fi-nav-item ${isActive ? 'fi-nav-item-active' : ''}`}
                  >
                    <Icon size={13} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ ERROR STRIP ═══ */}
      {allErrors.length > 0 && (
        <div className="fi-cockpit-errors">
          {allErrors.map((err, i) => (
            <p key={i} className="text-xs text-rose-300">{err}</p>
          ))}
        </div>
      )}

      {/* ═══ CONTENT AREA ═══ */}
      <div className="space-y-6 mt-5">

      {/* ── Dashboard → FinanceOverview (modular panel) ── */}
      {activeTab === 'dashboard' && (
        <FinanceOverview
          linkedAccounts={linkedAccountsDashboard}
          linkedAccountsLoading={linkedAccountsLoading}
          pulse={pulse}
          snapshot={snap}
          scorecard={scorecard}
          pendingBillReviewCount={decoderDashboard.pendingReviewCount}
          pendingBills={decoderDashboard.bills.filter(b => b.review_status === 'pending_review')}
          activeVehicles={scorecardDashboard.vehicles.filter(v => v.status === 'active')}
          cashFlowPeriods={analysisDashboard.cashFlowPeriods}
          documents={dashboard.documents}
          insights={dashboard.insights}
          stripeConnecting={stripeConnecting}
          onStripeConnect={handleStripeConnect}
          onNavigateTab={setActiveTab}
        />
      )}

      {/* ── Accounts → AccountsPanel (modular panel) ── */}
      {activeTab === 'accounts' && (
        <AccountsPanel
          dashboard={linkedAccountsDashboard}
          loading={linkedAccountsLoading}
          stripeConnecting={stripeConnecting}
          stripeSyncing={stripeSyncing}
          onStripeConnect={handleStripeConnect}
          onRefreshAccount={refreshAccount}
          onDisconnectAccount={disconnectAccount}
          onRemoveAccount={removeAccount}
          onUpdateAccount={updateAccount}
        />
      )}

      {/* ── Transactions → TransactionsPanel (modular panel) ── */}
      {activeTab === 'transactions' && (
        <TransactionsPanel
          transactions={txFeed}
          pagination={txPagination}
          categories={txCategories}
          loading={txLoading}
          error={txError}
          filters={txFilters}
          accounts={linkedAccountsDashboard.accounts}
          stripeSyncing={stripeSyncing}
          onApplyFilters={applyFilters}
          onLoadMore={txLoadMore}
          onUpdateCategory={updateCategory}
          onUpdateNotes={updateNotes}
          onRefresh={txRefresh}
          onSyncTransactions={syncTransactions}
        />
      )}

      {/* ── Ledger → LedgerPanel (modular panel) ── */}
      {activeTab === 'ledger' && (
        <LedgerPanel
          ledgerEntries={linkedAccountsDashboard.ledgerEntries}
          accounts={linkedAccountsDashboard.accounts}
          onCreateEntry={createLedgerEntry}
          onUpdateEntry={updateLedgerEntry}
          onDeleteEntry={deleteLedgerEntry}
        />
      )}

      {/* ── Obligations → ObligationsPanel (modular panel) ── */}
      {activeTab === 'planner' && (
        <ObligationsPanel
          obligations={dashboard.obligations ?? []}
          saving={intelligenceSaving}
          onSave={handleSaveObligation}
          onDelete={deleteObligation}
        />
      )}

      {/* ── Goals → GoalsPanel (modular panel) ── */}
      {activeTab === 'goals' && (
        <GoalsPanel
          intelligenceGoals={dashboard.goals ?? []}
          analysisGoals={analysisDashboard.goals}
          saving={intelligenceSaving}
          onSave={handleSaveGoal}
        />
      )}

      {/* ── Insights → InsightsPanel (modular panel) ── */}
      {activeTab === 'insights' && (
        <InsightsPanel
          insights={dashboard.insights}
          pulseNarrative={pulse.narrative}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Analysis tabs — Inline for now.                                    */}
      {/* TODO: Phase 3 — Extract decoder, scorecard, vehicles, income,      */}
      {/*       cashflow, recurring, documents, calendar into modular panels. */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Bill Decoder Tab ── */}
      {activeTab === 'decoder' && (
        <>
          <Card className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold">Bill Decoder</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a financial document, then decode it. Vuk will extract structured bill data with per-field confidence.
                You review, edit, and confirm before data enters the finance ecosystem.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm text-muted-foreground">
                Document type
                <select
                  value={selectedDocumentType}
                  onChange={(e) => setSelectedDocumentType(e.target.value as FinancialDocumentSourceType)}
                  className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3"
                >
                  <option value="auto_detect">✨ Auto-detect (AI)</option>
                  <option value="bank_statement">Bank Statement</option>
                  <option value="credit_card_statement">Credit Card Statement</option>
                  <option value="loan_statement">Loan Statement</option>
                  <option value="utility_bill">Utility Bill</option>
                  <option value="rent_mortgage">Rent / Mortgage</option>
                  <option value="insurance_bill">Insurance Bill</option>
                  <option value="subscription_bill">Subscription Bill</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm text-muted-foreground">
                Source file
                <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleDocumentUpload} disabled={uploadingDoc || intelligenceSaving} className="mt-1" />
              </label>
            </div>
            {uploadingDoc && <p className="text-xs text-muted-foreground">Uploading and parsing document...</p>}
          </Card>

          {decoderDashboard.bills.length > 0 && (
            <Card className="p-5 space-y-3">
              <p className="text-sm font-semibold">Decoded Bills</p>
              {decoderDashboard.bills.map((bill: DecodedBill) => (
                <div key={bill.id} className="rounded-lg border border-border/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{bill.provider_name || bill.bill_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {bill.bill_type.replace(/_/g, ' ')} • Due {bill.due_date || 'n/a'} • {(bill.extraction_confidence * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{bill.total_due ? currency(bill.total_due) : 'n/a'}</p>
                      <Badge variant={bill.review_status === 'confirmed' ? 'default' : bill.review_status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{bill.review_status.replace(/_/g, ' ')}</Badge>
                    </div>
                  </div>
                  {bill.review_status === 'pending_review' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void confirmBill(bill.id).then(() => toast.success('Bill confirmed.'))}>Confirm</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void rejectBill(bill.id).then(() => toast.info('Bill rejected.'))}>Reject</Button>
                    </div>
                  )}
                  {bill.decoded_fields && bill.decoded_fields.length > 0 && (
                    <div className="space-y-1 border-t border-border/40 pt-2">
                      {bill.decoded_fields.map((field, i) => (
                        <div key={i} className="flex items-center justify-between text-xs gap-2">
                          <span className="text-muted-foreground capitalize">{field.field_name.replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{field.extracted_value ?? 'n/a'}</span>
                            <Badge variant={field.confidence >= 0.8 ? 'default' : field.confidence >= 0.5 ? 'secondary' : 'destructive'} className="text-[9px]">{(field.confidence * 100).toFixed(0)}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* ── Scorecard Tab ── */}
      {activeTab === 'scorecard' && (
        <>
          {!scorecard ? (
            <Card className="p-5 space-y-3">
              <p className="text-sm font-semibold">Financial Scorecard</p>
              <p className="text-sm text-muted-foreground">
                No scorecard computed yet. Upload bills, add obligations, and run the scorecard to get a comprehensive financial position assessment.
              </p>
              <Button variant="outline" onClick={() => void computeScorecard()} disabled={computing}>
                {computing ? 'Computing...' : 'Compute Scorecard'}
              </Button>
            </Card>
          ) : (
            <>
              <Card className="p-6 border-primary/20">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-1">Overall Financial Position</p>
                    <div className="flex items-center gap-3">
                      <span className="text-5xl font-bold tracking-tight">{scorecard.overall_score}</span>
                      <div>
                        <Badge variant={scoreLabelVariant(scorecard.overall_label)} className="capitalize text-sm">{scorecard.overall_label}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {scorecard.computed_at ? `Computed ${new Date(scorecard.computed_at).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => void computeScorecard()} disabled={computing}>
                    {computing ? 'Recomputing...' : 'Recompute'}
                  </Button>
                </div>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {([
                  { key: 'liquidity', score: scorecard.liquidity_score, label: scorecard.liquidity_label, detail: scorecard.liquidity_detail },
                  { key: 'bill_pressure', score: scorecard.bill_pressure_score, label: scorecard.bill_pressure_label, detail: scorecard.bill_pressure_detail },
                  { key: 'debt_pressure', score: scorecard.debt_pressure_score, label: scorecard.debt_pressure_label, detail: scorecard.debt_pressure_detail },
                  { key: 'savings_health', score: scorecard.savings_health_score, label: scorecard.savings_health_label, detail: scorecard.savings_health_detail },
                  { key: 'organization', score: scorecard.organization_score, label: scorecard.organization_label, detail: scorecard.organization_detail },
                  { key: 'vehicle_position', score: scorecard.vehicle_position_score, label: scorecard.vehicle_position_label, detail: scorecard.vehicle_position_detail },
                ] as { key: string; score: number; label: string; detail: Record<string, unknown> }[]).map((dim) => (
                  <Card key={dim.key} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold">{dimensionDisplayName(dim.key)}</p>
                      <Badge variant={scoreLabelVariant(dim.label)} className="capitalize">{dim.label}</Badge>
                    </div>
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-3xl font-bold">{dim.score}</span>
                      <span className="text-xs text-muted-foreground mb-1">/ 100</span>
                    </div>
                    <Progress value={dim.score} className="h-2 mb-3" />
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {Object.entries(dim.detail).filter(([k]) => k !== 'note' && k !== 'vehicles').map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                          <span className="font-medium text-foreground">
                            {typeof value === 'number'
                              ? key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance') || key.toLowerCase().includes('burden') || key.toLowerCase().includes('load') || key.toLowerCase().includes('payment') || key.toLowerCase().includes('target') || key.toLowerCase().includes('saved') || key.toLowerCase().includes('equity') || key.toLowerCase().includes('limit') || key.toLowerCase().includes('due')
                                ? currency(value)
                                : key.toLowerCase().includes('percent') || key.toLowerCase().includes('progress')
                                  ? `${value}%`
                                  : String(value)
                              : typeof value === 'boolean'
                                ? value ? 'Yes' : 'No'
                                : String(value ?? 'n/a')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
              {scorecard.insights.length > 0 && (
                <Card className="p-5 space-y-2">
                  <p className="text-sm font-semibold">Position Insights</p>
                  <p className="text-xs text-muted-foreground">These are planning observations, not financial advice.</p>
                  {scorecard.insights.map((insight, i) => (
                    <div key={i} className="rounded-lg border border-border/70 p-3 flex items-start gap-3">
                      <Badge variant={insight.severity === 'critical' || insight.severity === 'high' ? 'destructive' : insight.severity === 'positive' ? 'default' : 'secondary'} className="capitalize shrink-0">{insight.severity}</Badge>
                      <p className="text-sm text-muted-foreground">{insight.message}</p>
                    </div>
                  ))}
                </Card>
              )}
              {scorecard.next_actions.length > 0 && (
                <Card className="p-5 space-y-2">
                  <p className="text-sm font-semibold">Recommended Actions</p>
                  {scorecard.next_actions.map((action, i) => (
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
            </>
          )}
        </>
      )}

      {/* ── Vehicles Tab ── */}
      {activeTab === 'vehicles' && (
        <>
          <Card className="p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold">Add Vehicle</p>
              <p className="text-xs text-muted-foreground mt-1">Track vehicle equity to complete your financial picture. Distinguish user-entered values from estimates.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input value={vYear} onChange={(e) => setVYear(e.target.value)} placeholder="Year (e.g. 2022)" type="number" />
              <Input value={vMake} onChange={(e) => setVMake(e.target.value)} placeholder="Make (e.g. Toyota)" />
              <Input value={vModel} onChange={(e) => setVModel(e.target.value)} placeholder="Model (e.g. Camry)" />
              <Input value={vTrim} onChange={(e) => setVTrim(e.target.value)} placeholder="Trim (optional)" />
              <Input value={vMileage} onChange={(e) => setVMileage(e.target.value)} placeholder="Mileage" type="number" />
              <label className="text-sm text-muted-foreground">
                Condition
                <select value={vCondition} onChange={(e) => setVCondition(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3">
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </label>
              <Input value={vPayoff} onChange={(e) => setVPayoff(e.target.value)} placeholder="Current payoff balance" type="number" />
              <Input value={vPayment} onChange={(e) => setVPayment(e.target.value)} placeholder="Monthly payment" type="number" />
              <Input value={vLender} onChange={(e) => setVLender(e.target.value)} placeholder="Lender" />
              <Input value={vTermRemaining} onChange={(e) => setVTermRemaining(e.target.value)} placeholder="Months remaining" type="number" />
              <Input value={vValue} onChange={(e) => setVValue(e.target.value)} placeholder="Estimated current value" type="number" />
              <label className="text-sm text-muted-foreground">
                Value source
                <select value={vValueSource} onChange={(e) => setVValueSource(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3">
                  <option value="user_estimate">User Estimate</option>
                  <option value="kbb">KBB</option>
                  <option value="nada">NADA</option>
                  <option value="dealer_appraisal">Dealer Appraisal</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <Button onClick={() => void handleSaveVehicle()} disabled={scorecardLoading}>Save Vehicle</Button>
          </Card>
          <Card className="p-5 space-y-3">
            <p className="text-sm font-semibold">Your Vehicles</p>
            {scorecardDashboard.vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vehicles tracked yet. Add one above to see equity position.</p>
            ) : (
              scorecardDashboard.vehicles.map((v) => (
                <div key={v.id} className="rounded-lg border border-border/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.mileage ? `${v.mileage.toLocaleString()} mi` : 'Mileage n/a'} • {v.condition} condition
                        {v.lender ? ` • ${v.lender}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${v.equity_position >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {v.equity_position >= 0 ? '+' : ''}{currency(v.equity_position)}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.equity_position >= 0 ? 'equity' : 'negative equity'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wider">Estimated Value</p>
                      <p className="font-medium">{v.estimated_value ? currency(v.estimated_value) : 'n/a'}</p>
                      <p className="text-muted-foreground">{v.value_source?.replace(/_/g, ' ') || 'user estimate'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wider">Payoff Balance</p>
                      <p className="font-medium">{v.current_payoff ? currency(v.current_payoff) : 'Paid off'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wider">Monthly Payment</p>
                      <p className="font-medium">{v.monthly_payment ? currency(v.monthly_payment) : 'n/a'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wider">Term Remaining</p>
                      <p className="font-medium">{v.term_remaining_months ? `${v.term_remaining_months} months` : 'n/a'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                    Values are {v.value_source === 'user_estimate' ? 'user-entered estimates' : `sourced from ${v.value_source?.replace(/_/g, ' ')}`}. Equity = Estimated Value − Payoff Balance.
                  </p>
                  <div className="flex gap-2">
                    <Badge variant={v.status === 'active' ? 'default' : 'secondary'} className="capitalize">{v.status}</Badge>
                    {v.status === 'active' && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => void deleteVehicle(v.id).then(() => toast.info('Vehicle removed.'))}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {/* ── Income Analysis Tab ── */}
      {activeTab === 'income' && (
        <>
          {analysisDashboard.incomeAnalysis && (
            <Card className="p-5 border-primary/20">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-semibold">Income Verification Summary</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pattern-based analysis of {analysisDashboard.incomeAnalysis.analysis_window_start} to {analysisDashboard.incomeAnalysis.analysis_window_end}
                  </p>
                </div>
                <Badge variant="secondary">
                  {confidenceLabel(analysisDashboard.incomeAnalysis.confidence_score)} Confidence
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. Monthly Income</p>
                  <p className="text-2xl font-bold text-emerald-300">{currency(analysisDashboard.incomeAnalysis.estimated_monthly_income)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Sources Detected</p>
                  <p className="text-2xl font-bold">{analysisDashboard.incomeAnalysis.detected_source_count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Primary Frequency</p>
                  <p className="text-lg font-semibold">{frequencyLabel(analysisDashboard.incomeAnalysis.primary_frequency || 'unknown')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Confidence</p>
                  <p className="text-lg font-semibold">{(analysisDashboard.incomeAnalysis.confidence_score * 100).toFixed(0)}%</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 border-t border-border/50 pt-2">
                These are detected signals, not verified income. Confirm individual sources below to increase reliability.
              </p>
            </Card>
          )}
          <Card className="p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold">Add Income Manually</p>
              <p className="text-xs text-muted-foreground mt-1">Enter income sources that aren&apos;t detected from linked accounts — side jobs, freelance, rental income, etc.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input value={incomeSource} onChange={(e) => setIncomeSource(e.target.value)} placeholder="Source name *" />
              <Input value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} placeholder="Amount per occurrence *" type="number" min="0" step="100" />
              <label className="text-sm text-muted-foreground">
                Frequency
                <select
                  value={incomeFrequency}
                  onChange={(e) => setIncomeFrequency(e.target.value)}
                  className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="semi_monthly">Semi-monthly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </label>
            </div>
            <Button onClick={() => void handleAddManualIncome()} disabled={addingIncome || !incomeSource.trim() || Number(incomeAmount) <= 0}>
              {addingIncome ? 'Saving…' : 'Add Income Source'}
            </Button>
          </Card>
          <Card className="p-5 space-y-3">
            <p className="text-sm font-semibold">Detected Income Sources</p>
            {analysisDashboard.incomeSignals.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>No income signals detected yet. Link bank accounts, sync transactions, and run analysis to detect income patterns.</p>
                <Button variant="outline" size="sm" onClick={() => void runAnalysis()} disabled={analyzing}>
                  {analyzing ? 'Analyzing...' : 'Run Analysis Now'}
                </Button>
              </div>
            ) : (
              analysisDashboard.incomeSignals.map((signal: RecurringIncomeSignal) => (
                <div key={signal.id} className="rounded-lg border border-border/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{signal.user_label || signal.detected_source || signal.signal_name}</p>
                        {signal.is_user_confirmed && <Badge variant="default" className="text-xs">Confirmed</Badge>}
                        {!signal.is_user_confirmed && <Badge variant="secondary" className="text-xs">Detected</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {frequencyLabel(signal.frequency)} • ~{currency(signal.estimated_amount)} per occurrence • {signal.occurrence_count} occurrences
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last: {signal.last_occurrence || 'n/a'} • Next expected: {signal.next_expected || 'n/a'}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="text-sm font-semibold text-emerald-300">
                        ~{currency(estimateMonthly(signal.estimated_amount, signal.frequency))}/mo
                      </p>
                      <Badge variant={signal.confidence_score >= 0.7 ? 'default' : 'secondary'} className="text-xs">
                        {(signal.confidence_score * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                  </div>
                  {!signal.is_user_confirmed && (
                    <div className="flex gap-2 mt-3 pt-2 border-t border-border/40">
                      <Button size="sm" variant="outline" onClick={() => void confirmIncomeSignal(signal.id).then(() => toast.success('Income source confirmed.'))}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => void dismissSignal(signal.id, 'income').then(() => toast.info('Signal dismissed.'))}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {/* ── Cash Flow Tab ── */}
      {activeTab === 'cashflow' && (
        <>
          {analysisDashboard.cashFlowPeriods.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">No cash flow data available. Link accounts, sync transactions, and run analysis.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void runAnalysis()} disabled={analyzing}>
                {analyzing ? 'Analyzing...' : 'Run Analysis'}
              </Button>
            </Card>
          ) : (
            analysisDashboard.cashFlowPeriods.map((period) => (
              <Card key={period.id} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{period.period_label}</p>
                  <Badge variant={period.net_flow >= 0 ? 'default' : 'destructive'}>
                    Net: {currency(period.net_flow)}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Inflow</p>
                    <p className="text-xl font-semibold text-emerald-300">+{currency(period.total_inflow)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Outflow</p>
                    <p className="text-xl font-semibold text-rose-300">-{currency(period.total_outflow)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</p>
                    <p className="text-xl font-semibold">{period.transaction_count}</p>
                  </div>
                </div>
                {period.top_expense_categories.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Top Expense Categories</p>
                    <div className="space-y-1">
                      {period.top_expense_categories.slice(0, 6).map((cat, i) => {
                        const pct = period.total_outflow > 0 ? (cat.total / period.total_outflow) * 100 : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-24 truncate capitalize">{cat.category.replace(/_/g, ' ')}</span>
                            <div className="flex-1 h-2 bg-border/30 rounded-full overflow-hidden">
                              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="text-xs font-medium w-20 text-right">{currency(cat.total)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {period.largest_inflows.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Largest Inflows</p>
                      {period.largest_inflows.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                          <span className="truncate max-w-[60%]">{item.name || 'Transaction'}</span>
                          <span className="text-emerald-300 font-medium">+{currency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {period.largest_outflows.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Largest Outflows</p>
                      {period.largest_outflows.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                          <span className="truncate max-w-[60%]">{item.name || 'Transaction'}</span>
                          <span className="text-rose-300 font-medium">-{currency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {/* ── Recurring Detection Tab ── */}
      {activeTab === 'recurring' && (
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold">Detected Recurring Expenses</p>
          <p className="text-xs text-muted-foreground">
            Transaction pattern analysis identifies likely recurring bills and subscriptions. Confirm to add to your bill planner.
          </p>
          {analysisDashboard.expenseSignals.length === 0 ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>No recurring expenses detected yet.</p>
              <Button variant="outline" size="sm" onClick={() => void runAnalysis()} disabled={analyzing}>
                {analyzing ? 'Analyzing...' : 'Run Analysis'}
              </Button>
            </div>
          ) : (
            analysisDashboard.expenseSignals.map((signal: RecurringExpenseSignal) => (
              <div key={signal.id} className="rounded-lg border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold">{signal.user_label || signal.merchant_name || signal.signal_name}</p>
                      {signal.is_user_confirmed && <Badge variant="default" className="text-xs">Confirmed</Badge>}
                      {!signal.is_user_confirmed && <Badge variant="secondary" className="text-xs">Detected</Badge>}
                      <Badge variant="outline" className="text-xs capitalize">{signal.category.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {frequencyLabel(signal.frequency)} • ~{currency(signal.estimated_amount)}/occurrence • {signal.occurrence_count} occurrences
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last: {signal.last_occurrence || 'n/a'} • Next expected: {signal.next_expected || 'n/a'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-rose-300">{currency(signal.estimated_amount)}</p>
                    <Badge variant={signal.confidence_score >= 0.7 ? 'default' : 'secondary'} className="text-xs">
                      {(signal.confidence_score * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                </div>
                {!signal.is_user_confirmed && (
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/40">
                    <Button size="sm" variant="outline" onClick={() => void confirmExpenseSignal(signal.id, undefined, true).then(() => toast.success('Expense confirmed and added to bill planner.'))}>
                      Confirm & Add to Planner
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void confirmExpenseSignal(signal.id).then(() => toast.success('Expense confirmed.'))}>
                      Confirm Only
                    </Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => void dismissSignal(signal.id, 'expense').then(() => toast.info('Signal dismissed.'))}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </Card>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === 'documents' && (
        <Card className="p-5 space-y-4">
          <p className="text-sm font-semibold">Financial Document Ingestion</p>
          <p className="text-xs text-muted-foreground">Upload source documents. The system preserves source traceability and structures obligations with confidence scoring.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm text-muted-foreground">
              Document type
              <select
                value={selectedDocumentType}
                onChange={(e) => setSelectedDocumentType(e.target.value as FinancialDocumentSourceType)}
                className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3"
              >
                <option value="auto_detect">✨ Auto-detect (AI)</option>
                <option value="bank_statement">Bank Statement</option>
                <option value="credit_card_statement">Credit Card Statement</option>
                <option value="loan_statement">Loan Statement</option>
                <option value="utility_bill">Utility Bill</option>
                <option value="rent_mortgage">Rent / Mortgage</option>
                <option value="insurance_bill">Insurance Bill</option>
                <option value="subscription_bill">Subscription Bill</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm text-muted-foreground">
              Source file
              <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleDocumentUpload} disabled={uploadingDoc || intelligenceSaving} className="mt-1" />
            </label>
          </div>
          {uploadingDoc && <p className="text-xs text-muted-foreground">Uploading and parsing document...</p>}
        </Card>
      )}

      {/* ── Calendar Tab ── */}
      {activeTab === 'calendar' && (
        <>
          <Card className="p-5 space-y-3">
            <p className="text-sm font-semibold">Add Financial Calendar Event</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Event title" />
              <Input value={eventDate} onChange={(e) => setEventDate(e.target.value)} type="date" />
              <Input value={eventAmount} onChange={(e) => setEventAmount(e.target.value)} placeholder="Amount (optional)" />
              <label className="text-sm text-muted-foreground">
                Event type
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3"
                >
                  <option value="bill_due">Bill Due</option>
                  <option value="payday">Payday</option>
                  <option value="savings_transfer">Savings Transfer</option>
                  <option value="debt_payment">Debt Payment</option>
                  <option value="reminder">Reminder</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>
            <Button onClick={() => void handleSaveEvent()} disabled={intelligenceSaving}>Save Calendar Event</Button>
          </Card>
          <Card className="p-5 space-y-2">
            <p className="text-sm font-semibold">Upcoming Financial Calendar</p>
            {dashboard.calendarEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calendar events yet.</p>
            ) : (
              dashboard.calendarEvents.slice(0, 20).map((ev) => (
                <div key={ev.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{ev.event_type.replace(/_/g, ' ')} • {ev.scheduled_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{ev.amount ? currency(ev.amount) : 'n/a'}</p>
                    <Badge variant="secondary" className="capitalize">{ev.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {/* end content area */}
      </div>
    </div>
  );
}
