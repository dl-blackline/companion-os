import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
// Tabs UI replaced with cockpit nav
import { useFinancialHealth } from '@/hooks/use-financial-health';
import { useFinancialIntelligence } from '@/hooks/use-financial-intelligence';
import { useFinancialAnalysis } from '@/hooks/use-financial-analysis';
import { useBillDecoder } from '@/hooks/use-bill-decoder';
import { useFinancialScorecard } from '@/hooks/use-financial-scorecard';
import { useStripeFinancialConnections } from '@/hooks/use-stripe-financial-connections';
import { useTransactionFeed } from '@/hooks/use-transaction-feed';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'sonner';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { Bank } from '@phosphor-icons/react/Bank';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { CreditCard } from '@phosphor-icons/react/CreditCard';
import { FileArrowUp } from '@phosphor-icons/react/FileArrowUp';
import { Heartbeat } from '@phosphor-icons/react/Heartbeat';
import { Lightbulb } from '@phosphor-icons/react/Lightbulb';
import { ListBullets } from '@phosphor-icons/react/ListBullets';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { PaperPlaneRight } from '@phosphor-icons/react/PaperPlaneRight';
import { ChatCircleDots } from '@phosphor-icons/react/ChatCircleDots';
import { Note } from '@phosphor-icons/react/Note';
import { PiggyBank } from '@phosphor-icons/react/PiggyBank';
import { TrendDown } from '@phosphor-icons/react/TrendDown';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { Wallet } from '@phosphor-icons/react/Wallet';
import { Plus } from '@phosphor-icons/react/Plus';
import { Check } from '@phosphor-icons/react/Check';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Trash } from '@phosphor-icons/react/Trash';
import { GlobeSimple } from '@phosphor-icons/react/GlobeSimple';
import type { FinancialDocumentSourceType } from '@/types/financial-intelligence';
import type { RecurringIncomeSignal, RecurringExpenseSignal } from '@/types/financial-analysis';
import type { DecodedBill, ScorecardLabel } from '@/types/premium-finance';
import type { NormalizedTransaction, TransactionFilters, LedgerEntry } from '@/types/stripe-financial';

function currency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function estimateMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly': return amount * (52 / 12);
    case 'biweekly': return amount * (26 / 12);
    case 'semi_monthly': return amount * 2;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'annual': return amount / 12;
    default: return amount;
  }
}

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type FinanceTab = 'dashboard' | 'accounts' | 'transactions' | 'ledger' | 'decoder' | 'scorecard' | 'vehicles' | 'income' | 'cashflow' | 'recurring' | 'documents' | 'planner' | 'goals' | 'calendar' | 'insights';

function scoreLabelVariant(label: ScorecardLabel | string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (label === 'strong' || label === 'stable') return 'default';
  if (label === 'moderate' || label === 'incomplete visibility') return 'secondary';
  if (label === 'under pressure' || label === 'needs attention') return 'destructive';
  return 'outline';
}

function dimensionDisplayName(name: string): string {
  const map: Record<string, string> = {
    liquidity: 'Liquidity',
    bill_pressure: 'Bill Pressure',
    debt_pressure: 'Debt Pressure',
    savings_health: 'Savings Health',
    organization: 'Organization',
    vehicle_position: 'Vehicle Position',
  };
  return map[name] || name;
}

export function FinanceView() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard');
  const [selectedDocumentType, setSelectedDocumentType] = useState<FinancialDocumentSourceType>('auto_detect');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // AI Financial Intake state
  const [aiInput, setAiInput] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiListening, setAiListening] = useState(false);

  // Vehicle form state
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

  const [plannerLabel, setPlannerLabel] = useState('');
  const [plannerCategory, setPlannerCategory] = useState('bill');
  const [plannerDueDate, setPlannerDueDate] = useState('');
  const [plannerAmount, setPlannerAmount] = useState('');
  const [plannerMinimum, setPlannerMinimum] = useState('');
  const [plannerPlanned, setPlannerPlanned] = useState('');
  const [editingObligationId, setEditingObligationId] = useState<string | null>(null);

  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalMonthly, setGoalMonthly] = useState('');
  const [goalPriority, setGoalPriority] = useState('medium');

  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('reminder');
  const [eventDate, setEventDate] = useState('');
  const [eventAmount, setEventAmount] = useState('');

  // Manual income form state
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState('monthly');
  const [addingIncome, setAddingIncome] = useState(false);

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

  // Transaction detail editing state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txFilterCategory, setTxFilterCategory] = useState('');
  const [txFilterDirection, setTxFilterDirection] = useState<'' | 'inflow' | 'outflow'>('');
  const [txFilterAccount, setTxFilterAccount] = useState('');

  // Account nickname/notes editing state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editAccountNotes, setEditAccountNotes] = useState('');
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('');

  // Ledger entry form state
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [ledgerTitle, setLedgerTitle] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDirection, setLedgerDirection] = useState<'inflow' | 'outflow'>('outflow');
  const [ledgerDueDate, setLedgerDueDate] = useState('');
  const [ledgerRecurrence, setLedgerRecurrence] = useState('once');
  const [ledgerNotes, setLedgerNotes] = useState('');
  const [ledgerAccount, setLedgerAccount] = useState('');

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

      // Store session ID for the return route
      sessionStorage.setItem('stripe_fc_session_id', sessionPayload.sessionId);

      const result = await stripe.collectFinancialConnectionsAccounts({
        clientSecret: sessionPayload.clientSecret,
      });

      if (result.error) {
        if (result.error.type === 'validation_error') {
          toast.error(result.error.message || 'Validation error.');
        }
        // User likely cancelled — not an error
        return;
      }

      // Extract account IDs from the Stripe JS result to pass as hints
      // (session.retrieve may not auto-expand accounts)
      const linkedAccounts = result.financialConnectionsSession?.accounts ?? [];
      const accountIds = Array.isArray(linkedAccounts)
        ? linkedAccounts.map((a: { id: string }) => a.id)
        : (linkedAccounts as { data?: { id: string }[] })?.data?.map((a) => a.id) ?? [];
      console.log('[stripe-fc] Stripe JS linked account IDs:', accountIds);

      // Accounts linked successfully — pass account IDs as backup for session retrieve
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

  const handleSavePlanner = useCallback(async () => {
    if (!plannerLabel.trim() || !plannerDueDate) {
      toast.error('Bill label and due date are required.');
      return;
    }

    try {
      await saveObligation({
        id: editingObligationId || undefined,
        accountLabel: plannerLabel.trim(),
        category: plannerCategory,
        dueDate: plannerDueDate,
        amountDue: Number(plannerAmount || 0),
        minimumDue: Number(plannerMinimum || 0),
        plannedPayment: Number(plannerPlanned || 0),
        status: 'planned',
      });
      toast.success(editingObligationId ? 'Obligation updated.' : 'Bill saved to planner.');
      setPlannerLabel('');
      setPlannerDueDate('');
      setPlannerAmount('');
      setPlannerMinimum('');
      setPlannerPlanned('');
      setEditingObligationId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save planner item.');
    }
  }, [editingObligationId, plannerAmount, plannerCategory, plannerDueDate, plannerLabel, plannerMinimum, plannerPlanned, saveObligation]);

  const handleSaveGoal = useCallback(async () => {
    if (!goalName.trim() || Number(goalTarget) <= 0) {
      toast.error('Goal name and target amount are required.');
      return;
    }

    try {
      await saveGoal({
        name: goalName.trim(),
        targetAmount: Number(goalTarget),
        currentAmount: Number(goalCurrent || 0),
        targetDate: goalDate || undefined,
        monthlyContributionTarget: Number(goalMonthly || 0),
        priority: goalPriority as 'low' | 'medium' | 'high' | 'critical',
      });
      toast.success('Savings goal saved.');
      setGoalName('');
      setGoalTarget('');
      setGoalCurrent('');
      setGoalDate('');
      setGoalMonthly('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save goal.');
    }
  }, [goalCurrent, goalDate, goalMonthly, goalName, goalPriority, goalTarget, saveGoal]);

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

  const sortedObligations = useMemo(
    () => [...(dashboard.obligations ?? [])].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
    [dashboard.obligations]
  );

  const sortedGoals = useMemo(
    () => [...(dashboard.goals ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [dashboard.goals]
  );

  const pulse = summary.pulse;
  const snap = dashboard.snapshot;
  const analysis = analysisDashboard.summary;
  const scorecard = scorecardDashboard.scorecard;

  const confidenceLabel = (score: number) => {
    if (score >= 0.8) return 'High';
    if (score >= 0.5) return 'Medium';
    if (score >= 0.3) return 'Low';
    return 'Very Low';
  };

  const frequencyLabel = (f: string) => {
    const map: Record<string, string> = { weekly: 'Weekly', biweekly: 'Biweekly', semi_monthly: 'Semi-monthly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual', irregular: 'Irregular' };
    return map[f] || f;
  };

  // Consolidated errors
  const allErrors = [error, stripeError, txError, intelligenceError, analysisError, decoderError, scorecardError].filter(Boolean);

  // Navigation groups
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

  const hasAccounts = linkedAccountsDashboard.aggregates.accountCount > 0;

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

      {error && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {error}
        </Card>
      )}

      {stripeError && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {stripeError}
        </Card>
      )}

      {txError && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {txError}
        </Card>
      )}

      {intelligenceError && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {intelligenceError}
        </Card>
      )}

      {analysisError && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {analysisError}
        </Card>
      )}

      {decoderError && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {decoderError}
        </Card>
      )}

      {scorecardError && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {scorecardError}
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard" className="gap-1.5"><ChartLineUp size={14} /> Command Center</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5"><CreditCard size={14} /> Accounts</TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5"><ListBullets size={14} /> Transactions</TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5"><Note size={14} /> Ledger</TabsTrigger>
          <TabsTrigger value="decoder" className="gap-1.5"><FileArrowUp size={14} /> Bill Decoder</TabsTrigger>
          <TabsTrigger value="scorecard" className="gap-1.5"><Heartbeat size={14} /> Scorecard</TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-1.5"><Bank size={14} /> Vehicles</TabsTrigger>
          <TabsTrigger value="income" className="gap-1.5"><TrendUp size={14} /> Income</TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-1.5"><Wallet size={14} /> Cash Flow</TabsTrigger>
          <TabsTrigger value="recurring" className="gap-1.5"><ArrowsClockwise size={14} /> Recurring</TabsTrigger>
          <TabsTrigger value="planner" className="gap-1.5"><Wallet size={14} /> Obligations</TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5"><PiggyBank size={14} /> Savings</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5"><CalendarBlank size={14} /> Calendar</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><FileArrowUp size={14} /> Documents</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5"><Lightbulb size={14} /> Insights</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ─── Aggregate Metrics Bar ─── */}
      {linkedAccountsDashboard.aggregates.accountCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Total Balance</p>
            <p className={`text-2xl font-bold tracking-tight ${linkedAccountsDashboard.aggregates.totalBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {currency(linkedAccountsDashboard.aggregates.totalBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Across {linkedAccountsDashboard.aggregates.accountCount} connected account{linkedAccountsDashboard.aggregates.accountCount !== 1 ? 's' : ''}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Cash on Hand</p>
            <p className="text-2xl font-bold tracking-tight text-blue-300">
              {currency(linkedAccountsDashboard.aggregates.totalCashOnHand)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Checking &amp; Savings</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Available Credit</p>
            <p className="text-2xl font-bold tracking-tight text-amber-300">
              {currency(linkedAccountsDashboard.aggregates.totalAvailableCredit)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Credit Card Accounts</p>
          </Card>
        </div>
      )}

      <div className="fi-kpi-bar flex flex-wrap gap-3 mt-2">
        {/* Balance */}
        {hasAccounts && (
          <div className="fi-kpi-cell">
            <div className="fi-kpi-label">Net Balance</div>
            <div className={`fi-kpi-value ${linkedAccountsDashboard.aggregates.totalBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {currency(linkedAccountsDashboard.aggregates.totalBalance)}
            </div>
            <div className="fi-kpi-sub">{linkedAccountsDashboard.aggregates.accountCount} account{linkedAccountsDashboard.aggregates.accountCount !== 1 ? 's' : ''}</div>
          </div>
        )}

        {/* Cash on Hand */}
        {hasAccounts && (
          <div className="fi-kpi-cell">
            <div className="fi-kpi-label">Cash on Hand</div>
            <div className="fi-kpi-value text-blue-300">{currency(linkedAccountsDashboard.aggregates.totalCashOnHand)}</div>
            <div className="fi-kpi-sub">Checking & Savings</div>
          </div>
        )}

        {/* Available Credit */}
        {hasAccounts && (
          <div className="fi-kpi-cell">
            <div className="fi-kpi-label">Avail. Credit</div>
            <div className="fi-kpi-value text-amber-300">{currency(linkedAccountsDashboard.aggregates.totalAvailableCredit)}</div>
            <div className="fi-kpi-sub">Credit Lines</div>
          </div>
        )}

        {/* Cash Flow 30d */}
        <div className="fi-kpi-cell">
          <div className="fi-kpi-label">Cash Flow 30d</div>
          <div className={`fi-kpi-value ${pulse.metrics.netCashFlow30d >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {currency(pulse.metrics.netCashFlow30d)}
          </div>
          <div className="fi-kpi-sub">In {currency(pulse.metrics.income30d)} · Out {currency(pulse.metrics.expenses30d)}</div>
        </div>

        {/* Delta to Cover */}
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

        {/* Runway */}
        <div className="fi-kpi-cell">
          <div className="fi-kpi-label">Runway</div>
          <div className="fi-kpi-value">{pulse.metrics.liquidityDays.toFixed(0)}d</div>
          <div className="fi-kpi-sub">Liquidity buffer</div>
        </div>

        {/* Savings Rate */}
        <div className="fi-kpi-cell">
          <div className="fi-kpi-label">Savings Rate</div>
          <div className={`fi-kpi-value ${pulse.metrics.savingsRate >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {pulse.metrics.savingsRate.toFixed(1)}%
          </div>
          <div className="fi-kpi-sub">Last updated {new Date(pulse.lastEvaluatedAt).toLocaleDateString()}</div>
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

      {activeTab === 'dashboard' && (
        <>
          {/* ── Linked Accounts Summary ── */}
          {linkedAccountsLoading && linkedAccountsDashboard.accounts.length === 0 && (
            <Card className="p-5">
              <p className="text-sm text-muted-foreground animate-pulse">Loading linked accounts…</p>
            </Card>
          )}

          {!linkedAccountsLoading && linkedAccountsDashboard.accounts.length === 0 && (
            <Card className="p-5 border-dashed border-border/50 text-center space-y-3">
              <CreditCard size={28} className="mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No bank accounts linked yet. Connect an account to unlock full financial intelligence.</p>
              <Button size="sm" variant="outline" onClick={handleStripeConnect} disabled={stripeConnecting} className="gap-2">
                <CreditCard size={14} />
                {stripeConnecting ? 'Connecting…' : 'Link Bank Account'}
              </Button>
            </Card>
          )}

          {linkedAccountsDashboard.accounts.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Linked Accounts</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {linkedAccountsDashboard.accounts.length} account{linkedAccountsDashboard.accounts.length !== 1 ? 's' : ''}
                  </Badge>
                  {linkedAccountsDashboard.totalTransactions > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {linkedAccountsDashboard.totalTransactions} transactions
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {linkedAccountsDashboard.accounts.map(acct => (
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

          {/* ── Next Actions ── */}
          {scorecard && scorecard.next_actions.length > 0 && (
            <Card className="p-5 space-y-2">
              <p className="text-sm font-semibold">Recommended Next Steps</p>
              {scorecard.next_actions.slice(0, 5).map((action, i) => (
                <div key={i} className="rounded-lg border border-border/70 p-3 flex items-start gap-3">
                  <Badge variant={action.priority === 'critical' ? 'destructive' : action.priority === 'high' ? 'destructive' : 'secondary'} className="capitalize shrink-0 mt-0.5">{action.priority}</Badge>
                  <div>
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* ── Decoded Bills Needing Review ── */}
          {decoderDashboard.pendingReviewCount > 0 && (
            <Card className="p-5 space-y-2 border-amber-500/30">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Bills Pending Review</p>
                <Badge variant="secondary">{decoderDashboard.pendingReviewCount} pending</Badge>
              </div>
              {decoderDashboard.bills.filter(b => b.review_status === 'pending_review').slice(0, 3).map((bill) => (
                <div key={bill.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{bill.provider_name || bill.bill_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">Due {bill.due_date || 'n/a'} • {(bill.extraction_confidence * 100).toFixed(0)}% confidence</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{bill.total_due ? currency(bill.total_due) : 'n/a'}</p>
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => setActiveTab('decoder')}>Review</Button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* ── Vehicle Equity Snapshot ── */}
          {scorecardDashboard.vehicles.filter(v => v.status === 'active').length > 0 && (
            <Card className="p-5 space-y-2">
              <p className="text-sm font-semibold">Vehicle Equity Position</p>
              {scorecardDashboard.vehicles.filter(v => v.status === 'active').map((v) => (
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

          {/* Cash Flow Trend */}
          {analysisDashboard.cashFlowPeriods.length > 0 && (
            <Card className="p-5 space-y-3">
              <p className="text-sm font-semibold">Cash Flow Trend</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {analysisDashboard.cashFlowPeriods.slice(0, 3).map((period) => (
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="p-5 space-y-2">
              <p className="text-sm font-semibold">Recent Document Intake</p>
              {dashboard.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Upload statements to begin structured extraction.</p>
              ) : (
                dashboard.documents.slice(0, 6).map((doc) => (
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
              {dashboard.insights.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active alerts. Run analysis and keep ingesting documents for richer intelligence.</p>
              ) : (
                dashboard.insights.slice(0, 6).map((insight) => (
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
        </>
      )}

      {/* ─── Accounts Tab ─── */}
      {activeTab === 'accounts' && (
        <>
          {linkedAccountsDashboard.accounts.length === 0 && !linkedAccountsLoading && (
            <Card className="p-8 text-center space-y-4">
              <CreditCard size={40} className="mx-auto text-muted-foreground/60" />
              <div>
                <p className="text-sm font-semibold">No Linked Accounts</p>
                <p className="text-xs text-muted-foreground mt-1">Connect your bank accounts to see balances, transactions, and financial insights in one place.</p>
              </div>
              <Button size="sm" onClick={handleStripeConnect} disabled={stripeConnecting}>
                {stripeConnecting ? 'Connecting…' : 'Link Bank Account'}
              </Button>
            </Card>
          )}

          {linkedAccountsLoading && (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground animate-pulse">Loading linked accounts…</p>
            </Card>
          )}

          {linkedAccountsDashboard.accounts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {linkedAccountsDashboard.accounts.map(acct => {
                const isEditing = editingAccountId === acct.id;
                return (
                <Card key={acct.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          placeholder={acct.institution_name || 'Nickname'}
                          className="w-full text-sm font-semibold bg-black/20 border border-border/70 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                          value={editNickname}
                          onChange={e => setEditNickname(e.target.value)}
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate">{acct.nickname || acct.institution_name || 'Unknown Institution'}</p>
                          <button
                            onClick={() => {
                              setEditingAccountId(acct.id);
                              setEditNickname(acct.nickname || '');
                              setEditAccountNotes(acct.user_notes || '');
                              setEditWebsiteUrl(acct.website_url || '');
                            }}
                            className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
                            title="Edit nickname & notes"
                          >
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
                        onChange={e => setEditAccountNotes(e.target.value)}
                      />
                      <input
                        type="url"
                        placeholder="Bank website URL (e.g. https://chase.com)"
                        className="w-full text-xs bg-black/20 border border-border/70 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                        value={editWebsiteUrl}
                        onChange={e => setEditWebsiteUrl(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex-1"
                          onClick={async () => {
                            await updateAccount(acct.id, {
                              nickname: editNickname || undefined,
                              user_notes: editAccountNotes || undefined,
                              website_url: editWebsiteUrl || undefined,
                            });
                            setEditingAccountId(null);
                          }}
                        >
                          <Check size={12} className="mr-1" /> Save
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditingAccountId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isEditing && acct.user_notes && (
                    <p className="text-xs text-muted-foreground/80 italic border-l-2 border-border/50 pl-2">{acct.user_notes}</p>
                  )}

                  {(() => {
                    const subtype = (acct.account_subtype || '').toLowerCase();
                    const isCreditCard = subtype === 'credit_card' || subtype === 'credit';
                    const bal = acct.latest_balance;

                    if (!bal) return (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 italic">
                        <ArrowsClockwise size={12} className="animate-spin" />
                        <span>Balance syncing…</span>
                      </div>
                    );

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
                          <p className="text-[10px] text-muted-foreground/60">
                            As of {new Date(bal.as_of).toLocaleString()}
                          </p>
                        </div>
                      );
                    }

                    // Non-credit-card accounts
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
                        <p className="text-[10px] text-muted-foreground/60">
                          As of {new Date(bal.as_of).toLocaleString()}
                        </p>
                      </div>
                    );
                  })()}

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
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex-1"
                          onClick={() => refreshAccount(acct.id)}
                        >
                          Refresh
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive"
                          onClick={() => { if (confirm('Disconnect this account? You can re-link it later.')) disconnectAccount(acct.id); }}
                        >
                          Disconnect
                        </Button>
                      </>
                    )}
                    {acct.status !== 'connected' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive flex-1"
                        onClick={() => { if (confirm('Remove this account permanently? All associated data will be deleted.')) removeAccount(acct.id); }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </Card>
                );
              })}
            </div>
          )}

          {linkedAccountsDashboard.accounts.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {linkedAccountsDashboard.accounts.length} account{linkedAccountsDashboard.accounts.length !== 1 ? 's' : ''} linked
              {linkedAccountsDashboard.totalTransactions > 0 && ` • ${linkedAccountsDashboard.totalTransactions} total transactions`}
              {stripeSyncing && ' • Syncing transactions…'}
            </p>
          )}
        </>
      )}

      {/* ─── Transactions Tab ─── */}
      {activeTab === 'transactions' && (
        <>
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

              {linkedAccountsDashboard.accounts.length > 1 && (
                <select
                  className="text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  value={txFilterAccount}
                  onChange={e => {
                    setTxFilterAccount(e.target.value);
                    applyFilters({ ...txFilters, connectionId: e.target.value || undefined, offset: 0 });
                  }}
                >
                  <option value="">All accounts</option>
                  {linkedAccountsDashboard.accounts.map(acct => (
                    <option key={acct.id} value={acct.id}>
                      {acct.institution_name} {acct.account_last4 ? `••${acct.account_last4}` : ''}
                    </option>
                  ))}
                </select>
              )}

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => applyFilters({ ...txFilters, search: txSearchTerm, offset: 0 })}
              >
                Search
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                disabled={txLoading}
                onClick={() => txRefresh()}
              >
                <ArrowsClockwise size={12} className={txLoading ? 'animate-spin' : ''} />
                Refresh
              </Button>
            </div>
          </Card>

          {/* Transactions list */}
          {txError && (
            <Card className="p-4 border-destructive/40 bg-destructive/5">
              <p className="text-xs text-destructive font-medium">Error loading transactions: {txError}</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => txRefresh()}>
                Retry
              </Button>
            </Card>
          )}

          {txLoading && txFeed.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground animate-pulse">Loading transactions…</p>
            </Card>
          )}

          {!txLoading && !txError && txFeed.length === 0 && (
            <Card className="p-8 text-center space-y-3">
              <ListBullets size={36} className="mx-auto text-muted-foreground/60" />
              <p className="text-sm font-semibold">No Transactions</p>
              <p className="text-xs text-muted-foreground">
                {linkedAccountsDashboard.accounts.length === 0
                  ? 'Link a bank account to see transactions here.'
                  : stripeSyncing
                    ? 'Syncing transactions from your bank… This can take up to 2 minutes.'
                    : 'Transactions will appear once your bank syncs data.'}
              </p>
              {linkedAccountsDashboard.accounts.length > 0 && (
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
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={txLoading}
                onClick={() => txLoadMore()}
              >
                {txLoading ? 'Loading…' : `Load More (${txPagination.total - txFeed.length} remaining)`}
              </Button>
            </div>
          )}

          {txPagination && (
            <p className="text-xs text-muted-foreground text-center">
              Showing {txFeed.length} of {txPagination.total} transactions
            </p>
          )}
        </>
      )}

      {/* ─── Ledger Tab ─── */}
      {activeTab === 'ledger' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Future Ledger</p>
              <p className="text-xs text-muted-foreground mt-0.5">Track upcoming money in and out.</p>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowLedgerForm(!showLedgerForm)}>
              <Plus size={14} className="mr-1" /> {showLedgerForm ? 'Cancel' : 'New Entry'}
            </Button>
          </div>

          {showLedgerForm && (
            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Rent, Paycheck, Insurance"
                    className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={ledgerTitle}
                    onChange={e => setLedgerTitle(e.target.value)}
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
                    value={ledgerAmount}
                    onChange={e => setLedgerAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Direction *</label>
                  <select
                    className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={ledgerDirection}
                    onChange={e => setLedgerDirection(e.target.value as 'inflow' | 'outflow')}
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
                    value={ledgerDueDate}
                    onChange={e => setLedgerDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Recurrence</label>
                  <select
                    className="w-full text-xs bg-black/20 border border-border/70 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={ledgerRecurrence}
                    onChange={e => setLedgerRecurrence(e.target.value)}
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
                    value={ledgerAccount}
                    onChange={e => setLedgerAccount(e.target.value)}
                  >
                    <option value="">No linked account</option>
                    {linkedAccountsDashboard.accounts.map(a => (
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
                  value={ledgerNotes}
                  onChange={e => setLedgerNotes(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={!ledgerTitle || !ledgerAmount || !ledgerDueDate}
                onClick={async () => {
                  await createLedgerEntry({
                    title: ledgerTitle,
                    amount: parseFloat(ledgerAmount),
                    direction: ledgerDirection,
                    due_date: ledgerDueDate,
                    recurrence: ledgerRecurrence || 'once',
                    notes: ledgerNotes || undefined,
                    connection_id: ledgerAccount || undefined,
                  });
                  setShowLedgerForm(false);
                  setLedgerTitle('');
                  setLedgerAmount('');
                  setLedgerDirection('outflow');
                  setLedgerDueDate('');
                  setLedgerRecurrence('once');
                  setLedgerNotes('');
                  setLedgerAccount('');
                  toast.success('Ledger entry created.');
                }}
              >
                <Plus size={12} className="mr-1" /> Create Entry
              </Button>
            </Card>
          )}

          {linkedAccountsDashboard.ledgerEntries.length === 0 && !showLedgerForm && (
            <Card className="p-8 text-center">
              <Note size={24} className="mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create entries for upcoming income and expenses.</p>
            </Card>
          )}

          {linkedAccountsDashboard.ledgerEntries.length > 0 && (
            <div className="space-y-1.5">
              {[...linkedAccountsDashboard.ledgerEntries]
                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                .map((entry: LedgerEntry) => {
                  const isPast = new Date(entry.due_date) < new Date() && entry.status === 'pending';
                  const linkedAcct = entry.connection_id
                    ? linkedAccountsDashboard.accounts.find(a => a.id === entry.connection_id)
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
                                  onClick={() => updateLedgerEntry(entry.id, { status: 'completed' })}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  className="text-muted-foreground/60 hover:text-foreground transition-colors"
                                  title="Skip"
                                  onClick={() => updateLedgerEntry(entry.id, { status: 'skipped' })}
                                >
                                  <ArrowsClockwise size={14} />
                                </button>
                              </>
                            )}
                            <button
                              className="text-destructive/60 hover:text-destructive transition-colors"
                              title="Delete"
                              onClick={() => { if (confirm('Delete this ledger entry?')) deleteLedgerEntry(entry.id); }}
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
        </>
      )}

      {/* ─── Bill Decoder Tab ─── */}
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
                  <option value="credit_card_statement">Credit Card Statement</option>
                  <option value="utility_bill">Utility Bill</option>
                  <option value="insurance_bill">Insurance Bill</option>
                  <option value="loan_statement">Loan Statement</option>
                  <option value="rent_mortgage">Rent / Mortgage</option>
                  <option value="subscription_bill">Subscription / Phone / Internet</option>
                  <option value="bank_statement">Bank Statement</option>
                  <option value="other">Medical / Other</option>
                </select>
              </label>
              <label className="text-sm text-muted-foreground">
                Upload source document
                <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleDocumentUpload} disabled={uploadingDoc || intelligenceSaving} className="mt-1" />
              </label>
            </div>
            {uploadingDoc && <p className="text-xs text-muted-foreground">Uploading and parsing document...</p>}

            {/* Decode button for existing un-decoded documents */}
            {dashboard.documents.filter(d => d.document_status === 'parsed').length > 0 && (
              <div className="border-t border-border/50 pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parsed Documents Available for Decoding</p>
                {dashboard.documents.filter(d => d.document_status === 'parsed').slice(0, 5).map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">{doc.source_type.replace(/_/g, ' ')} • {((doc.parse_confidence || 0) * 100).toFixed(0)}% parse confidence</p>
                    </div>
                    <Button size="sm" variant="outline" disabled={decoding} onClick={() => void decodeDocument(doc.id).then((b) => b && toast.success('Bill decoded. Review below.'))}>
                      {decoding ? 'Decoding...' : 'Decode'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Decoded Bills Awaiting Review */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Decoded Bills</p>
              <div className="flex gap-2">
                <Badge variant="secondary">{decoderDashboard.pendingReviewCount} pending</Badge>
                <Badge variant="default">{decoderDashboard.confirmedCount} confirmed</Badge>
              </div>
            </div>
            {decoderDashboard.bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decoded bills yet. Upload a document above and decode it to begin.</p>
            ) : (
              decoderDashboard.bills.map((bill: DecodedBill) => (
                <div key={bill.id} className="rounded-lg border border-border/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{bill.provider_name || 'Unknown Provider'}</p>
                        <Badge variant={bill.review_status === 'confirmed' || bill.review_status === 'merged' ? 'default' : bill.review_status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize text-xs">
                          {bill.review_status.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">{bill.bill_type.replace(/_/g, ' ')}</Badge>
                      </div>
                      {bill.account_name && <p className="text-xs text-muted-foreground">{bill.account_name}{bill.masked_account_number ? ` ••••${bill.masked_account_number}` : ''}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{bill.total_due != null ? currency(bill.total_due) : 'n/a'}</p>
                      <p className="text-xs text-muted-foreground">{(bill.extraction_confidence * 100).toFixed(0)}% confidence</p>
                    </div>
                  </div>

                  {/* Extracted fields grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {bill.due_date && (
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider">Due Date</p>
                        <p className="font-medium">{bill.due_date}</p>
                        {bill.field_confidence?.dueDate != null && <p className="text-muted-foreground">{(bill.field_confidence.dueDate * 100).toFixed(0)}% conf</p>}
                      </div>
                    )}
                    {bill.minimum_due != null && bill.minimum_due > 0 && (
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider">Minimum Due</p>
                        <p className="font-medium">{currency(bill.minimum_due)}</p>
                      </div>
                    )}
                    {bill.current_balance != null && bill.current_balance > 0 && (
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider">Current Balance</p>
                        <p className="font-medium">{currency(bill.current_balance)}</p>
                      </div>
                    )}
                    {bill.statement_balance != null && bill.statement_balance > 0 && (
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider">Statement Balance</p>
                        <p className="font-medium">{currency(bill.statement_balance)}</p>
                      </div>
                    )}
                    {bill.credit_limit != null && bill.credit_limit > 0 && (
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider">Credit Limit</p>
                        <p className="font-medium">{currency(bill.credit_limit)}</p>
                      </div>
                    )}
                    {bill.past_due_amount != null && bill.past_due_amount > 0 && (
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider">Past Due</p>
                        <p className="font-medium text-rose-300">{currency(bill.past_due_amount)}</p>
                      </div>
                    )}
                    {bill.late_fee != null && bill.late_fee > 0 && (
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider">Late Fee</p>
                        <p className="font-medium text-rose-300">{currency(bill.late_fee)}</p>
                      </div>
                    )}
                    {bill.billing_period_start && (
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider">Billing Period</p>
                        <p className="font-medium">{bill.billing_period_start} – {bill.billing_period_end || 'n/a'}</p>
                      </div>
                    )}
                  </div>

                  {/* Indicators */}
                  <div className="flex gap-2 flex-wrap text-xs">
                    {bill.autopay_detected && <Badge variant="outline" className="text-xs">Autopay Detected</Badge>}
                    {bill.is_recurring_candidate && <Badge variant="outline" className="text-xs">Recurring Candidate</Badge>}
                  </div>

                  {/* Provenance note */}
                  <p className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                    Source: uploaded document • Extraction confidence: {(bill.extraction_confidence * 100).toFixed(0)}% • Values are AI-extracted and should be reviewed before confirmation.
                  </p>

                  {/* Actions */}
                  {bill.review_status === 'pending_review' && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => void confirmBill(bill.id).then(() => toast.success('Bill confirmed and added to obligations.'))}>
                        Confirm & Add to Planner
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void confirmBill(bill.id, false).then(() => toast.success('Bill confirmed.'))}>
                        Confirm Only
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => void rejectBill(bill.id).then(() => toast.info('Bill rejected.'))}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {/* ─── Scorecard Tab ─── */}
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
              {/* Overall Score */}
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

              {/* Dimension Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {([
                  { key: 'liquidity', score: scorecard.liquidity_score, label: scorecard.liquidity_label, detail: scorecard.liquidity_detail },
                  { key: 'bill_pressure', score: scorecard.bill_pressure_score, label: scorecard.bill_pressure_label, detail: scorecard.bill_pressure_detail },
                  { key: 'debt_pressure', score: scorecard.debt_pressure_score, label: scorecard.debt_pressure_label, detail: scorecard.debt_pressure_detail },
                  { key: 'savings_health', score: scorecard.savings_health_score, label: scorecard.savings_health_label, detail: scorecard.savings_health_detail },
                  { key: 'organization', score: scorecard.organization_score, label: scorecard.organization_label, detail: scorecard.organization_detail },
                  { key: 'vehicle_position', score: scorecard.vehicle_position_score, label: scorecard.vehicle_position_label, detail: scorecard.vehicle_position_detail },
                ]).map((dim) => (
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

              {/* Scorecard Insights */}
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

              {/* Next Actions */}
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

      {/* ─── Vehicles Tab ─── */}
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

          {/* Vehicle List */}
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

      {/* ─── Income Analysis Tab ─── */}
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

          {/* Manual Income Entry */}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void confirmIncomeSignal(signal.id).then(() => toast.success('Income source confirmed.'))}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => void dismissSignal(signal.id, 'income').then(() => toast.info('Signal dismissed.'))}
                      >
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

      {/* ─── Cash Flow Tab ─── */}
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

      {/* ─── Recurring Detection Tab ─── */}
      {activeTab === 'recurring' && (
        <>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void confirmExpenseSignal(signal.id, undefined, true).then(() => toast.success('Expense confirmed and added to bill planner.'))}
                      >
                        Confirm & Add to Planner
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void confirmExpenseSignal(signal.id).then(() => toast.success('Expense confirmed.'))}
                      >
                        Confirm Only
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => void dismissSignal(signal.id, 'expense').then(() => toast.info('Signal dismissed.'))}
                      >
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

      {activeTab === 'planner' && (
        <>
          <Card className="p-5 space-y-3">
            <p className="text-sm font-semibold">Add Bill / Obligation</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input value={plannerLabel} onChange={(e) => setPlannerLabel(e.target.value)} placeholder="Bill label (e.g., Chase Card)" />
              <Input value={plannerDueDate} onChange={(e) => setPlannerDueDate(e.target.value)} type="date" />
              <Input value={plannerCategory} onChange={(e) => setPlannerCategory(e.target.value)} placeholder="Category" />
              <Input value={plannerAmount} onChange={(e) => setPlannerAmount(e.target.value)} placeholder="Amount due" />
              <Input value={plannerMinimum} onChange={(e) => setPlannerMinimum(e.target.value)} placeholder="Minimum due" />
              <Input value={plannerPlanned} onChange={(e) => setPlannerPlanned(e.target.value)} placeholder="Planned payment" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleSavePlanner()} disabled={intelligenceSaving}>
                {editingObligationId ? 'Update Obligation' : 'Save to Bill Planner'}
              </Button>
              {editingObligationId && (
                <Button variant="ghost" onClick={() => {
                  setEditingObligationId(null);
                  setPlannerLabel(''); setPlannerDueDate(''); setPlannerAmount('');
                  setPlannerMinimum(''); setPlannerPlanned('');
                }}>Cancel</Button>
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-2">
            <p className="text-sm font-semibold">Planner Board</p>
            {sortedObligations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No obligations yet. Upload statements or add planner entries manually.</p>
            ) : (
              sortedObligations.slice(0, 20).map((item) => (
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
                        onClick={() => {
                          setPlannerLabel(item.account_label || item.institution_name || '');
                          setPlannerCategory(item.category || 'bill');
                          setPlannerDueDate(item.due_date || '');
                          setPlannerAmount(String(item.amount_due || ''));
                          setPlannerMinimum(String(item.minimum_due || ''));
                          setPlannerPlanned(String(item.planned_payment || ''));
                          setEditingObligationId(item.id);
                        }}
                      >
                        <PencilSimple size={13} />
                      </button>
                      <button
                        title="Delete obligation"
                        className="text-muted-foreground/60 hover:text-rose-400 transition-colors"
                        onClick={() => void deleteObligation(item.id)}
                        disabled={intelligenceSaving}
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {activeTab === 'goals' && (
        <>
          <Card className="p-5 space-y-3">
            <p className="text-sm font-semibold">Savings Goal Strategy</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Goal name *" className={!goalName.trim() && goalTarget ? 'border-rose-500/60' : ''} />
                {!goalName.trim() && goalTarget && <p className="text-[10px] text-rose-400">Required</p>}
              </div>
              <div className="space-y-1">
                <Input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="Target amount *" type="number" min="0" step="100" className={goalName.trim() && (!goalTarget || Number(goalTarget) <= 0) ? 'border-rose-500/60' : ''} />
                {goalName.trim() && (!goalTarget || Number(goalTarget) <= 0) && <p className="text-[10px] text-rose-400">Required — enter a target &gt; $0</p>}
              </div>
              <Input value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} placeholder="Current amount (optional)" type="number" min="0" step="100" />
              <Input value={goalDate} onChange={(e) => setGoalDate(e.target.value)} type="date" />
              <Input value={goalMonthly} onChange={(e) => setGoalMonthly(e.target.value)} placeholder="Monthly contribution target" type="number" min="0" step="50" />
              <label className="text-sm text-muted-foreground">
                Priority
                <select
                  value={goalPriority}
                  onChange={(e) => setGoalPriority(e.target.value)}
                  className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
            <Button onClick={() => void handleSaveGoal()} disabled={intelligenceSaving || !goalName.trim() || Number(goalTarget) <= 0}>
              {intelligenceSaving ? 'Saving…' : 'Save Savings Goal'}
            </Button>
          </Card>

          <Card className="p-5 space-y-2">
            <p className="text-sm font-semibold">Goal Portfolio</p>
            {analysisDashboard.goals.length === 0 && sortedGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No savings goals yet.</p>
            ) : (
              (analysisDashboard.goals.length > 0 ? analysisDashboard.goals : sortedGoals).map((goal) => {
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
        </>
      )}

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

      {activeTab === 'insights' && (
        <Card className="p-5 space-y-2">
          <p className="text-sm font-semibold">Financial Insight Engine</p>
          <p className="text-xs text-muted-foreground">Insights are generated as planning support only and are not financial advice.</p>
          {dashboard.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No insights available.</p>
          ) : (
            dashboard.insights.map((insight) => (
              <div key={insight.id} className="rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold">{insight.title}</p>
                  <Badge variant={insight.severity === 'critical' || insight.severity === 'high' ? 'destructive' : 'secondary'} className="capitalize">{insight.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{insight.summary}</p>
                {insight.action_hint && <p className="text-xs mt-2 text-foreground/90">Action support: {insight.action_hint}</p>}
              </div>
            ))
          )}
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm font-semibold mb-1">Vuk Intelligence</p>
        <p className="text-sm text-muted-foreground">{pulse.narrative}</p>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Linked Accounts</p>
            <Badge variant="secondary">{summary.accounts.length + linkedAccountsDashboard.accounts.length}</Badge>
          </div>

          {summary.accounts.length === 0 && linkedAccountsDashboard.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No financial accounts linked yet.</p>
          ) : (
            <div className="space-y-2">
              {linkedAccountsDashboard.accounts.slice(0, 5).map((acct) => (
                <div key={acct.id} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{acct.institution_name || 'Account'}</p>
                    <p className="text-xs text-muted-foreground">
                      {acct.account_subtype || 'account'} {acct.account_last4 ? `••${acct.account_last4}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{currency(acct.latest_balance?.current_balance ?? 0)}</p>
                    <Badge variant={acct.status === 'connected' ? 'default' : 'secondary'} className="text-[9px] capitalize">{acct.status}</Badge>
                  </div>
                </div>
              ))}
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
            <div className="flex items-center gap-2">
              {linkedAccountsDashboard.accounts.length > 0 && txFeed.length === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  disabled={stripeSyncing}
                  onClick={async () => {
                    await syncTransactions();
                    txRefresh();
                  }}
                >
                  <ArrowsClockwise size={11} className={stripeSyncing ? 'animate-spin' : ''} />
                  {stripeSyncing ? 'Syncing…' : 'Sync'}
                </Button>
              )}
              <Wallet size={18} className="text-muted-foreground" />
            </div>
          </div>

          {summary.transactions.length === 0 && txFeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {linkedAccountsDashboard.accounts.length === 0
                ? 'Link a bank account to see transactions.'
                : stripeSyncing
                  ? 'Syncing transactions from your bank…'
                  : 'No transactions synced yet. Try clicking Sync above.'}
            </p>
          ) : (
            <div className="space-y-2">
              {txFeed.slice(0, 5).map((tx) => (
                <div key={`stripe-${tx.id}`} className="rounded-lg border border-border/70 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tx.merchant_name || tx.description || 'Transaction'}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.institution_name} {tx.account_last4 ? `••${tx.account_last4}` : ''} • {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : 'pending'}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${tx.direction === 'inflow' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {tx.direction === 'inflow' ? '+' : '−'}{currency(Math.abs(tx.amount))}
                  </p>
                </div>
              ))}
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
      {/* end content area */}
      </div>
    </div>
  );
}
