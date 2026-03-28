import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFinancialHealth } from '@/hooks/use-financial-health';
import { useFinancialIntelligence } from '@/hooks/use-financial-intelligence';
import { toast } from 'sonner';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { Bank } from '@phosphor-icons/react/Bank';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { FileArrowUp } from '@phosphor-icons/react/FileArrowUp';
import { Heartbeat } from '@phosphor-icons/react/Heartbeat';
import { Lightbulb } from '@phosphor-icons/react/Lightbulb';
import { PiggyBank } from '@phosphor-icons/react/PiggyBank';
import { TrendDown } from '@phosphor-icons/react/TrendDown';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { Wallet } from '@phosphor-icons/react/Wallet';
import type { FinancialDocumentSourceType } from '@/types/financial-intelligence';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'documents' | 'planner' | 'goals' | 'calendar' | 'insights'>('dashboard');
  const [selectedDocumentType, setSelectedDocumentType] = useState<FinancialDocumentSourceType>('bank_statement');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [plannerLabel, setPlannerLabel] = useState('');
  const [plannerCategory, setPlannerCategory] = useState('bill');
  const [plannerDueDate, setPlannerDueDate] = useState('');
  const [plannerAmount, setPlannerAmount] = useState('');
  const [plannerMinimum, setPlannerMinimum] = useState('');
  const [plannerPlanned, setPlannerPlanned] = useState('');

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

  const {
    summary,
    loading,
    syncing,
    error,
    sync,
    createLinkToken,
    exchangePublicToken,
  } = useFinancialHealth();

  const {
    dashboard,
    loading: intelligenceLoading,
    saving: intelligenceSaving,
    error: intelligenceError,
    uploadAndIngestDocument,
    saveObligation,
    saveGoal,
    saveCalendarEvent,
    refreshInsights,
  } = useFinancialIntelligence();

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

  const handleDocumentUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingDoc(true);
    try {
      await uploadAndIngestDocument(file, selectedDocumentType);
      toast.success('Financial document uploaded and parsed.');
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
        accountLabel: plannerLabel.trim(),
        category: plannerCategory,
        dueDate: plannerDueDate,
        amountDue: Number(plannerAmount || 0),
        minimumDue: Number(plannerMinimum || 0),
        plannedPayment: Number(plannerPlanned || 0),
        status: 'planned',
      });
      toast.success('Bill saved to planner.');
      setPlannerLabel('');
      setPlannerDueDate('');
      setPlannerAmount('');
      setPlannerMinimum('');
      setPlannerPlanned('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save planner item.');
    }
  }, [plannerAmount, plannerCategory, plannerDueDate, plannerLabel, plannerMinimum, plannerPlanned, saveObligation]);

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

  const sortedObligations = useMemo(
    () => [...dashboard.obligations].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
    [dashboard.obligations]
  );

  const sortedGoals = useMemo(
    () => [...dashboard.goals].sort((a, b) => a.name.localeCompare(b.name)),
    [dashboard.goals]
  );

  const pulse = summary.pulse;
  const snap = dashboard.snapshot;

  return (
    <div className="settings-panel p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="executive-eyebrow">Money Intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight">Financial Intelligence Command</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload statements, structure obligations, plan bills and savings, and run a private executive-grade finance operating layer.
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
          <Button variant="outline" onClick={() => void refreshInsights()} disabled={intelligenceSaving || intelligenceLoading} className="gap-2">
            <Lightbulb size={14} />
            Refresh Insights
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {error}
        </Card>
      )}

      {intelligenceError && (
        <Card className="p-4 border-destructive/50 text-sm text-destructive">
          {intelligenceError}
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-black/25 border border-border/70">
          <TabsTrigger value="dashboard" className="gap-1.5"><ChartLineUp size={14} /> Dashboard</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><FileArrowUp size={14} /> Documents</TabsTrigger>
          <TabsTrigger value="planner" className="gap-1.5"><Wallet size={14} /> Bill Planner</TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5"><PiggyBank size={14} /> Savings Goals</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5"><CalendarBlank size={14} /> Calendar</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5"><Lightbulb size={14} /> Insights</TabsTrigger>
        </TabsList>
      </Tabs>

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

      {activeTab === 'dashboard' && (
        <>
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
                <p className="text-sm text-muted-foreground">No active alerts. Keep ingesting documents and updating planner events for richer intelligence.</p>
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

      {activeTab === 'documents' && (
        <Card className="p-5 space-y-4">
          <p className="text-sm font-semibold">Financial Document Ingestion</p>
          <p className="text-xs text-muted-foreground">Upload source documents. Companion preserves source traceability and structures obligations with confidence scoring.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm text-muted-foreground">
              Document type
              <select
                value={selectedDocumentType}
                onChange={(e) => setSelectedDocumentType(e.target.value as FinancialDocumentSourceType)}
                className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3"
              >
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
            <Button onClick={() => void handleSavePlanner()} disabled={intelligenceSaving}>Save to Bill Planner</Button>
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
                  <div className="text-right">
                    <p className="text-sm font-semibold">{currency(item.amount_due || item.minimum_due || 0)}</p>
                    <Badge variant={item.status === 'overdue' ? 'destructive' : 'secondary'} className="capitalize">{item.status}</Badge>
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
              <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Goal name" />
              <Input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="Target amount" />
              <Input value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} placeholder="Current amount" />
              <Input value={goalDate} onChange={(e) => setGoalDate(e.target.value)} type="date" />
              <Input value={goalMonthly} onChange={(e) => setGoalMonthly(e.target.value)} placeholder="Monthly contribution target" />
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
            <Button onClick={() => void handleSaveGoal()} disabled={intelligenceSaving}>Save Savings Goal</Button>
          </Card>

          <Card className="p-5 space-y-2">
            <p className="text-sm font-semibold">Goal Portfolio</p>
            {sortedGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No savings goals yet.</p>
            ) : (
              sortedGoals.map((goal) => {
                const progress = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
                return (
                  <div key={goal.id} className="rounded-lg border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{goal.name}</p>
                      <Badge variant="secondary" className="capitalize">{goal.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currency(goal.current_amount)} / {currency(goal.target_amount)} • {progress.toFixed(0)}%
                    </p>
                    <Progress value={progress} className="mt-2 h-2" />
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
