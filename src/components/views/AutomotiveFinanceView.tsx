import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAutomotiveFinance } from '@/hooks/use-automotive-finance';
import type { AutomotiveDeal, AutomotiveDealStatus, AutomotiveDealType } from '@/types/automotive-finance';
import {
  Brain,
  CarProfile,
  ChatCircleDots,
  Funnel,
  Lightning,
  Lock,
  PresentationChart,
  ShieldCheck,
  WarningDiamond,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

type WorkspaceKey =
  | 'command_center'
  | 'deal_workspace'
  | 'callback_workspace'
  | 'structure_workspace'
  | 'menu_workspace'
  | 'cit_workspace'
  | 'reporting_workspace'
  | 'lender_brain'
  | 'management_workspace'
  | 'executive_workspace';

type DealStatusFilter = 'all' | 'urgent' | 'blocked' | 'funding';

type CopilotWorkspace =
  | 'deal_workspace'
  | 'callback_workspace'
  | 'structure_workspace'
  | 'menu_workspace'
  | 'cit_workspace'
  | 'reporting_workspace'
  | 'lender_brain';

interface CopilotAnalyzeResponse {
  ai?: {
    executiveSummary?: string;
    strongestPath?: string;
    nextActions?: string[];
  };
  deterministicInsights?: {
    findings?: Array<{ title?: string; detail?: string }>;
  };
  strategyPaths?: Array<{ label?: string; objective?: string }>;
}

interface CallbacksPayload {
  callbacks?: unknown[];
}

interface GuidelinesPayload {
  guidelines?: unknown[];
}

interface KpiPayload {
  snapshot?: {
    gross?: { pvr?: number };
    products?: { vpi?: number };
    commissions?: { netCommissions?: number };
  };
}

interface ObjectionCoachingPayload {
  coaching?: {
    label?: string;
    goal?: string;
    scripts?: string[];
  };
}

interface ManagementAccessPayload {
  actor?: {
    globalRole?: string;
    permissions?: string[];
    activeStoreIds?: string[];
  };
  stores?: Array<{ id: string; store_name?: string }>;
  userProfiles?: Array<{ user_id?: string; display_name?: string; global_role?: string }>;
}

interface TeamDashboardPayload {
  managerPerformance?: Array<{
    displayName?: string;
    role?: string;
    workingDeals?: number;
    fundedDeals?: number;
    docsOrCallbackBlocked?: number;
    openCit?: number;
    avgPressure?: number;
    pvr?: number;
  }>;
  stuckDeals?: Array<{ dealName?: string; status?: string; ageDays?: number; reason?: string }>;
  openApprovals?: number;
}

interface ExecutiveDashboardPayload {
  storeComparisons?: Array<{
    storeName?: string;
    funded?: number;
    booked?: number;
    cancelled?: number;
    pvr?: number;
    openCit?: number;
    cancellations?: number;
  }>;
  totals?: {
    stores?: number;
    deals?: number;
    funded?: number;
    booked?: number;
    cancelled?: number;
  };
}

interface ApprovalListPayload {
  approvals?: Array<{ id?: string; request_type?: string; status?: string; priority?: string; created_at?: string }>;
}

interface TemplateListPayload {
  templates?: Array<{ id?: string; template_name?: string; template_type?: string; status?: string; version_number?: number }>;
}

interface PlaybookListPayload {
  lenderPlaybooks?: Array<{ id?: string; playbook_name?: string; status?: string; version_number?: number; lender_id?: string | null }>;
}

interface AuditPayload {
  auditEvents?: Array<{ action?: string; area?: string; created_at?: string; actor_user_id?: string | null }>;
}

interface CoachingPayload {
  coachingNotes?: Array<{ title?: string; note_type?: string; is_reference_case?: boolean; created_at?: string }>;
}

const WORKSPACES: Array<{ key: WorkspaceKey; label: string; role: string }> = [
  { key: 'command_center', label: 'Command Center', role: 'Operations Lead' },
  { key: 'deal_workspace', label: 'Deal Jacket', role: 'Live Deal Strategist' },
  { key: 'callback_workspace', label: 'Callbacks', role: 'Callback Strategist' },
  { key: 'structure_workspace', label: 'Structure', role: 'Structure Coach' },
  { key: 'menu_workspace', label: 'F&I Menu', role: 'Presentation Coach' },
  { key: 'cit_workspace', label: 'CIT and Funding', role: 'Funding Coach' },
  { key: 'reporting_workspace', label: 'Reporting', role: 'Performance Analyst' },
  { key: 'lender_brain', label: 'Lender Brain', role: 'Guideline Interpreter' },
  { key: 'management_workspace', label: 'Management', role: 'Finance Director' },
  { key: 'executive_workspace', label: 'Executive', role: 'Group Leadership' },
];

const OBJECTION_TYPES = [
  { value: 'payment_too_high', label: 'Payment is too high' },
  { value: 'no_products', label: 'No products' },
  { value: 'already_covered', label: 'Already covered' },
  { value: 'distrust', label: 'Trust concern' },
];

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function fmtDate(value: string | null | undefined) {
  if (!value) return 'n/a';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'n/a' : d.toLocaleString();
}

function scoreTone(score: number | null | undefined) {
  const n = Number(score || 0);
  if (n >= 75) return 'text-red-300';
  if (n >= 50) return 'text-amber-300';
  return 'text-emerald-300';
}

function workspaceToCopilot(workspace: WorkspaceKey) {
  if (workspace === 'command_center') return 'reporting_workspace';
  return workspace;
}

function asDealType(value: string): AutomotiveDealType {
  const allowed: AutomotiveDealType[] = ['retail', 'lease', 'balloon', 'business', 'commercial'];
  return allowed.includes(value as AutomotiveDealType) ? (value as AutomotiveDealType) : 'retail';
}

function asDealStatus(value: string): AutomotiveDealStatus {
  return value as AutomotiveDealStatus;
}

function asCopilotWorkspace(value: string): CopilotWorkspace {
  const allowed: CopilotWorkspace[] = [
    'deal_workspace',
    'callback_workspace',
    'structure_workspace',
    'menu_workspace',
    'cit_workspace',
    'reporting_workspace',
    'lender_brain',
  ];
  return allowed.includes(value as CopilotWorkspace) ? (value as CopilotWorkspace) : 'deal_workspace';
}

export function AutomotiveFinanceView() {
  const {
    dashboard,
    loading,
    saving,
    error,
    refresh,
    createDeal,
    setDealStatus,
    analyzeDealCopilot,
    getObjectionCoaching,
    listCallbacks,
    listGuidelines,
    getKpiSnapshot,
    listCitCases,
    listCancellations,
    listCustomerIssues,
    updateCopilotMemory,
    bootstrapManagement,
    getManagementAccessProfile,
    listApprovals,
    listTemplates,
    listLenderPlaybooks,
    getTeamDashboard,
    getExecutiveDashboard,
    searchAuditEvents,
    listCoachingNotes,
  } = useAutomotiveFinance();

  const [workspace, setWorkspace] = useState<WorkspaceKey>('command_center');
  const [dealSearch, setDealSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DealStatusFilter>('all');
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [customerMode, setCustomerMode] = useState(false);
  const [presentationLock, setPresentationLock] = useState(false);

  const [newDealName, setNewDealName] = useState('');
  const [newDealType, setNewDealType] = useState('retail');
  const [newDealTarget, setNewDealTarget] = useState('');

  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotResult, setCopilotResult] = useState<CopilotAnalyzeResponse | null>(null);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotMode, setCopilotMode] = useState<'concise' | 'detailed'>('concise');
  const [memoryKey, setMemoryKey] = useState('');
  const [memoryValue, setMemoryValue] = useState('');

  const [objectionType, setObjectionType] = useState('payment_too_high');
  const [objectionResult, setObjectionResult] = useState<ObjectionCoachingPayload | null>(null);

  const [callbacksPayload, setCallbacksPayload] = useState<CallbacksPayload | null>(null);
  const [guidelinePayload, setGuidelinePayload] = useState<GuidelinesPayload | null>(null);
  const [kpiPayload, setKpiPayload] = useState<KpiPayload | null>(null);
  const [managementAccess, setManagementAccess] = useState<ManagementAccessPayload | null>(null);
  const [teamDashboard, setTeamDashboard] = useState<TeamDashboardPayload | null>(null);
  const [executiveDashboard, setExecutiveDashboard] = useState<ExecutiveDashboardPayload | null>(null);
  const [approvalPayload, setApprovalPayload] = useState<ApprovalListPayload | null>(null);
  const [templatePayload, setTemplatePayload] = useState<TemplateListPayload | null>(null);
  const [playbookPayload, setPlaybookPayload] = useState<PlaybookListPayload | null>(null);
  const [auditPayload, setAuditPayload] = useState<AuditPayload | null>(null);
  const [coachingPayload, setCoachingPayload] = useState<CoachingPayload | null>(null);

  const deals = useMemo(() => dashboard.deals || [], [dashboard.deals]);

  useEffect(() => {
    if (!selectedDealId && deals.length > 0) {
      setSelectedDealId(deals[0].id);
    }
  }, [deals, selectedDealId]);

  const selectedDeal = useMemo<AutomotiveDeal | null>(() => {
    if (!selectedDealId) return deals[0] || null;
    return deals.find((deal) => deal.id === selectedDealId) || null;
  }, [deals, selectedDealId]);

  const filteredDeals = useMemo(() => {
    const search = dealSearch.trim().toLowerCase();
    return deals.filter((deal) => {
      const isUrgent = (deal.open_flag_count || 0) > 0 || (deal.structure_pressure_score || 0) >= 60;
      const isBlocked = ['docs_pending', 'docs_under_review', 'callback_received', 'callback_interpreted', 'cit_hold'].includes(deal.status);
      const isFunding = ['submitted', 'booked', 'funded', 'cit_hold'].includes(deal.status);

      if (statusFilter === 'urgent' && !isUrgent) return false;
      if (statusFilter === 'blocked' && !isBlocked) return false;
      if (statusFilter === 'funding' && !isFunding) return false;

      if (!search) return true;
      const haystack = [
        deal.deal_name,
        deal.vehicle_summary,
        deal.lender_name,
        deal.status,
        deal.deal_type,
        deal.source_channel,
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [deals, dealSearch, statusFilter]);

  const urgentQueue = useMemo(() => {
    return deals
      .filter((deal) => (deal.open_flag_count || 0) > 0 || (deal.issue_count || 0) > 0 || deal.has_open_cit)
      .sort((a, b) => {
        const aScore = (a.open_flag_count || 0) * 3 + (a.issue_count || 0) * 2 + (a.has_open_cit ? 3 : 0) + ((a.structure_pressure_score || 0) / 25);
        const bScore = (b.open_flag_count || 0) * 3 + (b.issue_count || 0) * 2 + (b.has_open_cit ? 3 : 0) + ((b.structure_pressure_score || 0) / 25);
        return bScore - aScore;
      })
      .slice(0, 8);
  }, [deals]);

  const workspaceRole = useMemo(() => {
    const row = WORKSPACES.find((w) => w.key === workspace);
    return row?.role || 'Finance Copilot';
  }, [workspace]);

  const handleCreateDeal = async () => {
    if (!newDealName.trim()) {
      toast.error('Deal name is required.');
      return;
    }

    try {
      await createDeal({
        dealName: newDealName.trim(),
        dealType: asDealType(newDealType),
        customerPaymentTarget: Number(newDealTarget || 0),
      });
      setNewDealName('');
      setNewDealTarget('');
      toast.success('Deal added to working pipeline.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create deal.');
    }
  };

  const runCopilot = async (quickQuestion?: string) => {
    if (!selectedDeal) {
      toast.error('Select a deal first.');
      return;
    }

    setCopilotBusy(true);
    try {
      const result = await analyzeDealCopilot({
        dealId: selectedDeal.id,
        workspace: asCopilotWorkspace(workspaceToCopilot(workspace)),
        question: quickQuestion || copilotQuestion || undefined,
        mode: copilotMode,
      });
      setCopilotResult(result as CopilotAnalyzeResponse);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Copilot analysis failed.');
    } finally {
      setCopilotBusy(false);
    }
  };

  const runObjectionCoach = async () => {
    if (!selectedDeal) {
      toast.error('Select a deal first.');
      return;
    }

    try {
      const result = await getObjectionCoaching(selectedDeal.id, objectionType);
      setObjectionResult(result as ObjectionCoachingPayload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Objection coaching failed.');
    }
  };

  const saveMemory = async () => {
    if (!memoryKey.trim()) {
      toast.error('Memory key is required.');
      return;
    }
    try {
      await updateCopilotMemory(memoryKey.trim(), memoryValue, 0.9);
      toast.success('Copilot memory preference saved.');
      setMemoryKey('');
      setMemoryValue('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save memory preference.');
    }
  };

  const loadWorkspaceData = useCallback(async () => {
    if (!selectedDeal) return;

    try {
      if (workspace === 'callback_workspace') {
        const callbacks = await listCallbacks(selectedDeal.id);
        setCallbacksPayload(callbacks as CallbacksPayload);
      }

      if (workspace === 'lender_brain') {
        if (!selectedDeal.lender_id) {
          setGuidelinePayload({ guidelines: [] });
        } else {
          const guidelines = await listGuidelines(selectedDeal.lender_id);
          setGuidelinePayload(guidelines as GuidelinesPayload);
        }
      }

      if (workspace === 'reporting_workspace' || workspace === 'command_center') {
        const kpi = await getKpiSnapshot({
          dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          dateTo: new Date().toISOString().slice(0, 10),
        });
        setKpiPayload(kpi as KpiPayload);
      }

      if (workspace === 'cit_workspace') {
        await Promise.all([
          listCitCases(),
          listCancellations(),
          listCustomerIssues(),
        ]);
      }

      if (workspace === 'management_workspace') {
        await bootstrapManagement();
        const [access, approvals, templates, playbooks, team, audits, coaching] = await Promise.all([
          getManagementAccessProfile(),
          listApprovals({ limit: 30 }),
          listTemplates({ limit: 30 }),
          listLenderPlaybooks({ limit: 30 }),
          getTeamDashboard({ limit: 100 }),
          searchAuditEvents({ limit: 50 }),
          listCoachingNotes({ limit: 20 }),
        ]);
        setManagementAccess(access as ManagementAccessPayload);
        setApprovalPayload(approvals as ApprovalListPayload);
        setTemplatePayload(templates as TemplateListPayload);
        setPlaybookPayload(playbooks as PlaybookListPayload);
        setTeamDashboard(team as TeamDashboardPayload);
        setAuditPayload(audits as AuditPayload);
        setCoachingPayload(coaching as CoachingPayload);
      }

      if (workspace === 'executive_workspace') {
        await bootstrapManagement();
        const [access, executive, team, audits] = await Promise.all([
          getManagementAccessProfile(),
          getExecutiveDashboard(),
          getTeamDashboard({ limit: 150 }),
          searchAuditEvents({ limit: 75 }),
        ]);
        setManagementAccess(access as ManagementAccessPayload);
        setExecutiveDashboard(executive as ExecutiveDashboardPayload);
        setTeamDashboard(team as TeamDashboardPayload);
        setAuditPayload(audits as AuditPayload);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed loading workspace data.');
    }
  }, [
    selectedDeal,
    workspace,
    listCallbacks,
    listGuidelines,
    getKpiSnapshot,
    listCitCases,
    listCancellations,
    listCustomerIssues,
    bootstrapManagement,
    getManagementAccessProfile,
    listApprovals,
    listTemplates,
    listLenderPlaybooks,
    getTeamDashboard,
    getExecutiveDashboard,
    searchAuditEvents,
    listCoachingNotes,
  ]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [workspace, selectedDealId, loadWorkspaceData]);

  const aiBlock = copilotResult?.ai;
  const findings = copilotResult?.deterministicInsights?.findings || [];
  const nextActions = copilotResult?.ai?.nextActions || [];
  const strategyPaths = copilotResult?.strategyPaths || [];
  const callbackCount = Array.isArray(callbacksPayload?.callbacks) ? callbacksPayload.callbacks.length : 0;
  const guidelineCount = Array.isArray(guidelinePayload?.guidelines) ? guidelinePayload.guidelines.length : 0;
  const pvr = kpiPayload?.snapshot?.gross?.pvr || 0;
  const vpi = kpiPayload?.snapshot?.products?.vpi || 0;
  const netCommissions = kpiPayload?.snapshot?.commissions?.netCommissions || 0;
  const objectionCoaching = objectionResult?.coaching;
  const managerRows = teamDashboard?.managerPerformance || [];
  const stuckDeals = teamDashboard?.stuckDeals || [];
  const approvals = approvalPayload?.approvals || [];
  const templates = templatePayload?.templates || [];
  const playbooks = playbookPayload?.lenderPlaybooks || [];
  const auditEvents = auditPayload?.auditEvents || [];
  const coachingNotes = coachingPayload?.coachingNotes || [];
  const storeComparisons = executiveDashboard?.storeComparisons || [];

  if (customerMode) {
    return (
      <div className="settings-panel p-5 md:p-8 max-w-7xl mx-auto automotive-command-shell space-y-6">
        <div className="automotive-customer-header">
          <div>
            <p className="executive-eyebrow">Customer Presentation Mode</p>
            <h1 className="text-3xl font-semibold tracking-tight">Protection Options and Payment Paths</h1>
            <p className="text-sm text-slate-300/80 mt-2 max-w-3xl">
              Clean presentation mode hides operational flags and manager-only signals. Keep the discussion clear, transparent, and pressure-free.
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={() => setPresentationLock((v) => !v)} className="gap-2">
              <Lock size={14} />
              {presentationLock ? 'Unlock Screen' : 'Lock Screen'}
            </Button>
            <Button variant="outline" onClick={() => setCustomerMode(false)}>Back to Manager Mode</Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5 bg-slate-900/70 border-slate-700/70">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Deal</p>
            <p className="text-xl font-semibold mt-2">{selectedDeal?.deal_name || 'No deal selected'}</p>
            <p className="text-sm text-slate-300 mt-2">{selectedDeal?.vehicle_summary || 'Vehicle details pending'}</p>
          </Card>
          <Card className="p-5 bg-slate-900/70 border-slate-700/70">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Estimated Payment</p>
            <p className="text-3xl font-semibold mt-2">{money(selectedDeal?.payment_estimate)}</p>
            <p className="text-sm text-slate-300 mt-2">Customer target: {money(selectedDeal?.customer_payment_target)}</p>
          </Card>
          <Card className="p-5 bg-slate-900/70 border-slate-700/70">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Available Products</p>
            <p className="text-3xl font-semibold mt-2">{dashboard.products.length}</p>
            <p className="text-sm text-slate-300 mt-2">Presented transparently with clear opt-in choices.</p>
          </Card>
        </div>

        <Card className="p-6 bg-slate-950/80 border-slate-700/70">
          <h2 className="text-xl font-semibold mb-4">Package Comparison</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {['Core Protection', 'Balanced Coverage', 'Comprehensive Coverage'].map((name, index) => (
              <div key={name} className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 space-y-2">
                <p className="text-sm uppercase tracking-[0.12em] text-slate-400">Option {index + 1}</p>
                <p className="text-lg font-semibold">{name}</p>
                <p className="text-sm text-slate-300">
                  {index === 0 && 'Focused on essential coverage and payment comfort.'}
                  {index === 1 && 'Balances payment and long-term ownership protection.'}
                  {index === 2 && 'Highest coverage depth with strongest risk transfer.'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="settings-panel p-4 md:p-7 max-w-[1500px] mx-auto automotive-command-shell space-y-5">
      <div className="automotive-command-header">
        <div>
          <p className="executive-eyebrow">Automotive Finance Manager • Phase 4</p>
          <h1 className="text-3xl font-semibold tracking-tight">Live Finance Copilot Command Center</h1>
          <p className="text-sm text-slate-300/80 mt-2 max-w-4xl">
            Context-aware intelligence for structure, callbacks, menu strategy, and funding execution. Built for live desk pressure, not generic assistant prompts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading || saving}>Refresh</Button>
          <Button variant="outline" onClick={() => setCustomerMode(true)} className="gap-2">
            <PresentationChart size={14} />
            Customer Mode
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-3 border-rose-400/60 bg-rose-900/10 text-rose-300 text-sm">{error}</Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="automotive-kpi-tile">
          <p>Working Deals</p>
          <h3>{dashboard.summary.totalDeals}</h3>
        </Card>
        <Card className="automotive-kpi-tile">
          <p>Needs Docs</p>
          <h3>{dashboard.summary.dealsNeedingDocs}</h3>
        </Card>
        <Card className="automotive-kpi-tile">
          <p>Callbacks Waiting</p>
          <h3>{dashboard.summary.callbacksWaiting}</h3>
        </Card>
        <Card className="automotive-kpi-tile">
          <p>Open CIT</p>
          <h3>{dashboard.summary.dealsInCit}</h3>
        </Card>
        <Card className="automotive-kpi-tile">
          <p>Pending Commissions</p>
          <h3>{dashboard.summary.commissionsPending}</h3>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 xl:col-span-3 space-y-4">
          <Card className="p-4 bg-slate-950/70 border-slate-700/70 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2"><CarProfile size={16} /> Working Pipeline</h2>
              <Badge variant="secondary">{filteredDeals.length}</Badge>
            </div>
            <Input value={dealSearch} onChange={(e) => setDealSearch(e.target.value)} placeholder="Search customer, vehicle, lender" />
            <div className="grid grid-cols-4 gap-1 text-xs">
              {[
                ['all', 'All'],
                ['urgent', 'Urgent'],
                ['blocked', 'Blocked'],
                ['funding', 'Funding'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`rounded-md border px-2 py-1 ${statusFilter === value ? 'border-cyan-300/60 bg-cyan-900/30 text-cyan-200' : 'border-slate-700/70 bg-slate-900/70 text-slate-300'}`}
                  onClick={() => setStatusFilter(value as DealStatusFilter)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1">
              {filteredDeals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => setSelectedDealId(deal.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${selectedDeal?.id === deal.id ? 'border-cyan-300/60 bg-cyan-900/20' : 'border-slate-700/70 bg-slate-900/60 hover:bg-slate-900/90'}`}
                >
                  <div className="flex justify-between gap-2 items-center">
                    <p className="font-medium text-sm truncate">{deal.deal_name}</p>
                    <Badge variant="outline">{deal.deal_type}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{deal.vehicle_summary || 'Vehicle pending'} • {deal.status.replace(/_/g, ' ')}</p>
                  <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-2">
                    <span>Flags: {deal.open_flag_count || 0}</span>
                    <span>Callback: {deal.callback_status || 'none'}</span>
                    <span>Pressure: {Math.round(Number(deal.structure_pressure_score || 0))}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-slate-950/70 border-slate-700/70 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Lightning size={14} /> Quick Intake</h3>
            <Input value={newDealName} onChange={(e) => setNewDealName(e.target.value)} placeholder="Customer - Unit - Deal" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={newDealType} onChange={(e) => setNewDealType(e.target.value)} placeholder="Deal type" />
              <Input value={newDealTarget} onChange={(e) => setNewDealTarget(e.target.value)} placeholder="Payment target" type="number" />
            </div>
            <Button onClick={() => void handleCreateDeal()} disabled={saving}>Create Deal</Button>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-6 space-y-4">
          <Card className="p-3 bg-slate-950/70 border-slate-700/70">
            <div className="flex flex-wrap gap-2">
              {WORKSPACES.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setWorkspace(item.key)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${workspace === item.key ? 'border-cyan-300/60 bg-cyan-900/30 text-cyan-200' : 'border-slate-700/70 bg-slate-900/70 text-slate-300'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5 bg-slate-950/70 border-slate-700/70 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Current Deal</p>
                <h2 className="text-2xl font-semibold">{selectedDeal?.deal_name || 'No deal selected'}</h2>
                <p className="text-sm text-slate-300 mt-1">
                  {selectedDeal?.vehicle_summary || 'Vehicle pending'} • {selectedDeal?.lender_name || 'No lender linked'} • Last activity {fmtDate(selectedDeal?.last_activity_at)}
                </p>
              </div>
              {selectedDeal && (
                <select
                  aria-label="Set deal status"
                  value={selectedDeal.status}
                  onChange={(e) => void setDealStatus(selectedDeal.id, asDealStatus(e.target.value))}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                >
                  {[
                    'lead_received', 'intake', 'docs_pending', 'docs_under_review', 'document_review', 'structure_in_progress',
                    'structure_analysis', 'callback_received', 'callback_interpreted', 'menu_ready', 'presented', 'submitted',
                    'booked', 'funded', 'cit_hold', 'issue_open', 'cancelled', 'archived',
                  ].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              )}
            </div>

            {workspace === 'command_center' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs text-slate-400 uppercase tracking-[0.12em]">Urgent Queue</p>
                    <p className="text-3xl font-semibold mt-2">{urgentQueue.length}</p>
                    <p className="text-xs text-slate-400 mt-2">Files needing immediate manager action.</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs text-slate-400 uppercase tracking-[0.12em]">Booked Not Funded</p>
                    <p className="text-3xl font-semibold mt-2">{dashboard.summary.bookedNotFunded}</p>
                    <p className="text-xs text-slate-400 mt-2">Funding risk queue under active follow-up.</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs text-slate-400 uppercase tracking-[0.12em]">Customer Issues</p>
                    <p className="text-3xl font-semibold mt-2">{dashboard.summary.customerIssues}</p>
                    <p className="text-xs text-slate-400 mt-2">Open issues requiring service-quality response.</p>
                  </Card>
                </div>
                <Card className="p-4 bg-slate-900/60 border-slate-700/70">
                  <p className="text-sm font-semibold mb-3">High Priority Queue</p>
                  <div className="space-y-2">
                    {urgentQueue.map((deal) => (
                      <div key={deal.id} className="rounded-lg border border-slate-700/70 bg-slate-950/60 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{deal.deal_name}</p>
                          <Badge variant="outline">{deal.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Flags {deal.open_flag_count || 0} • Issues {deal.issue_count || 0} • Pressure {Math.round(Number(deal.structure_pressure_score || 0))}
                        </p>
                      </div>
                    ))}
                    {urgentQueue.length === 0 && <p className="text-sm text-slate-400">No urgent files right now.</p>}
                  </div>
                </Card>
              </div>
            )}

            {workspace === 'deal_workspace' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">File Quality</p>
                    <p className="text-sm mt-2">Open flags: {selectedDeal?.open_flag_count || 0}</p>
                    <p className="text-sm">Menu status: {selectedDeal?.menu_status || 'not_started'}</p>
                    <p className="text-sm">Callback status: {selectedDeal?.callback_status || 'none'}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Scorecard Snapshot</p>
                    <p className={`text-sm mt-2 ${scoreTone(selectedDeal?.structure_pressure_score)}`}>
                      Structure pressure: {Math.round(Number(selectedDeal?.structure_pressure_score || 0))}
                    </p>
                    <p className={`text-sm ${scoreTone(100 - Number(selectedDeal?.approval_readiness_score || 0))}`}>
                      Approval readiness: {Math.round(Number(selectedDeal?.approval_readiness_score || 0))}
                    </p>
                    <p className="text-sm">Payment estimate: {money(selectedDeal?.payment_estimate)}</p>
                  </Card>
                </div>
                <Card className="p-4 bg-slate-900/60 border-slate-700/70">
                  <p className="text-sm text-slate-300">{selectedDeal?.file_summary || 'No file summary yet. Run copilot review for structured strategy guidance.'}</p>
                </Card>
              </div>
            )}

            {workspace === 'callback_workspace' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Callback Strategy Workspace</p>
                  <Button variant="outline" size="sm" onClick={() => void loadWorkspaceData()}>Refresh Callback Data</Button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Latest Callback Status</p>
                    <p className="text-lg font-semibold mt-2">{selectedDeal?.callback_status || 'none'}</p>
                    <p className="text-xs text-slate-400 mt-2">Total callback records: {selectedDeal?.callback_count || 0}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Callback Options Loaded</p>
                    <p className="text-lg font-semibold mt-2">{callbackCount}</p>
                    <p className="text-xs text-slate-400 mt-2">Use copilot to compare approval-first vs gross-preserving paths.</p>
                  </Card>
                </div>
              </div>
            )}

            {workspace === 'structure_workspace' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-4 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Payment</p>
                    <p className="text-xl font-semibold mt-2">{money(selectedDeal?.payment_estimate)}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Pressure</p>
                    <p className={`text-xl font-semibold mt-2 ${scoreTone(selectedDeal?.structure_pressure_score)}`}>
                      {Math.round(Number(selectedDeal?.structure_pressure_score || 0))}
                    </p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Readiness</p>
                    <p className="text-xl font-semibold mt-2">{Math.round(Number(selectedDeal?.approval_readiness_score || 0))}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Target</p>
                    <p className="text-xl font-semibold mt-2">{money(selectedDeal?.customer_payment_target)}</p>
                  </Card>
                </div>
                <p className="text-sm text-slate-300">Run copilot in detailed mode to generate structure paths: best-shot, payment-first, and gross-protected.</p>
              </div>
            )}

            {workspace === 'menu_workspace' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">Use copilot to tune package sequencing, manage objection flow, and preserve trust while protecting sustainable backend gross.</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Active Products</p>
                    <p className="text-2xl font-semibold mt-2">{dashboard.products.length}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Presentation Status</p>
                    <p className="text-2xl font-semibold mt-2">{selectedDeal?.menu_status || 'not_started'}</p>
                  </Card>
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <select
                    aria-label="Objection type"
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    value={objectionType}
                    onChange={(e) => setObjectionType(e.target.value)}
                  >
                    {OBJECTION_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <Button onClick={() => void runObjectionCoach()} className="md:col-span-2">Generate Objection Coach</Button>
                </div>
                {objectionCoaching && (
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70 space-y-2">
                    <p className="font-medium">{objectionCoaching.label || 'Objection Coaching'}</p>
                    <p className="text-sm text-slate-300">{objectionCoaching.goal || ''}</p>
                    <div className="space-y-1">
                      {Array.isArray(objectionCoaching.scripts) && objectionCoaching.scripts.slice(0, 3).map((line, idx) => (
                        <p key={idx} className="text-sm text-slate-200">• {line}</p>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {workspace === 'cit_workspace' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Open CIT</p>
                    <p className="text-2xl font-semibold mt-2">{dashboard.summary.dealsInCit}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Cancellation Requests</p>
                    <p className="text-2xl font-semibold mt-2">{dashboard.summary.cancellationRequests}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Customer Issues</p>
                    <p className="text-2xl font-semibold mt-2">{dashboard.summary.customerIssues}</p>
                  </Card>
                </div>
                <p className="text-sm text-slate-300">Run copilot for prioritized follow-up plan and professional outreach language.</p>
              </div>
            )}

            {workspace === 'reporting_workspace' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">KPI Intelligence</p>
                  <Button variant="outline" size="sm" onClick={() => void loadWorkspaceData()}>Refresh KPI</Button>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">PVR</p>
                    <p className="text-2xl font-semibold mt-2">{money(pvr)}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">VPI</p>
                    <p className="text-2xl font-semibold mt-2">{Number(vpi).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Net Commissions</p>
                    <p className="text-2xl font-semibold mt-2">{money(netCommissions)}</p>
                  </Card>
                </div>
              </div>
            )}

            {workspace === 'lender_brain' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">Guideline-aware coaching cites lender criteria where available and labels inferred reasoning separately.</p>
                <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Guidelines in Context</p>
                  <p className="text-2xl font-semibold mt-2">{guidelineCount}</p>
                  <p className="text-xs text-slate-400 mt-2">Documents and parsed criteria available for this lender/program context.</p>
                </Card>
              </div>
            )}

            {workspace === 'management_workspace' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Role</p>
                    <p className="text-xl font-semibold mt-2">{managementAccess?.actor?.globalRole || 'finance_manager'}</p>
                    <p className="text-xs text-slate-400 mt-2">Permissions: {(managementAccess?.actor?.permissions || []).length}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Open Approvals</p>
                    <p className="text-xl font-semibold mt-2">{teamDashboard?.openApprovals || approvals.filter((a) => ['pending', 'in_review', 'revise_required'].includes(String(a.status))).length}</p>
                    <p className="text-xs text-slate-400 mt-2">Decision discipline across review workflows.</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Stuck Deals</p>
                    <p className="text-xl font-semibold mt-2">{stuckDeals.length}</p>
                    <p className="text-xs text-slate-400 mt-2">Follow-through risk requiring management action.</p>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-sm font-semibold mb-2">Manager Performance Signals</p>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {managerRows.slice(0, 8).map((row, idx) => (
                        <div key={idx} className="rounded-md border border-slate-700/70 bg-slate-950/70 p-2 text-xs">
                          <p className="font-medium text-sm">{row.displayName || 'Manager'}</p>
                          <p className="text-slate-400 mt-1">{row.role || 'finance_manager'}</p>
                          <p className="text-slate-300 mt-1">Deals {row.workingDeals || 0} • Funded {row.fundedDeals || 0} • Blocked {row.docsOrCallbackBlocked || 0} • Open CIT {row.openCit || 0}</p>
                          <p className="text-slate-300">Pressure {Math.round(Number(row.avgPressure || 0))} • PVR {money(row.pvr || 0)}</p>
                        </div>
                      ))}
                      {managerRows.length === 0 && <p className="text-xs text-slate-400">No manager performance data yet.</p>}
                    </div>
                  </Card>

                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-sm font-semibold mb-2">Workflow Reviews and Standards</p>
                    <div className="space-y-2 text-xs max-h-56 overflow-y-auto pr-1">
                      <p className="text-slate-300">Approvals loaded: {approvals.length}</p>
                      <p className="text-slate-300">Templates loaded: {templates.length}</p>
                      <p className="text-slate-300">Lender playbooks loaded: {playbooks.length}</p>
                      {approvals.slice(0, 4).map((approval, idx) => (
                        <div key={idx} className="rounded-md border border-slate-700/70 bg-slate-950/70 p-2">
                          <p className="font-medium">{String(approval.request_type || 'review')}</p>
                          <p className="text-slate-400">Status {String(approval.status || 'pending')} • Priority {String(approval.priority || 'normal')}</p>
                        </div>
                      ))}
                      {approvals.length === 0 && <p className="text-slate-400">No open approval queue.</p>}
                    </div>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-sm font-semibold mb-2">Recent Audit Trail</p>
                    <div className="space-y-2 text-xs max-h-52 overflow-y-auto pr-1">
                      {auditEvents.slice(0, 8).map((event, idx) => (
                        <div key={idx} className="rounded-md border border-slate-700/70 bg-slate-950/70 p-2">
                          <p className="font-medium">{String(event.action || 'action')}</p>
                          <p className="text-slate-400">{String(event.area || 'area')} • {fmtDate(event.created_at)}</p>
                        </div>
                      ))}
                      {auditEvents.length === 0 && <p className="text-slate-400">No audit events loaded.</p>}
                    </div>
                  </Card>

                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-sm font-semibold mb-2">Coaching and Playback</p>
                    <div className="space-y-2 text-xs max-h-52 overflow-y-auto pr-1">
                      {coachingNotes.slice(0, 8).map((note, idx) => (
                        <div key={idx} className="rounded-md border border-slate-700/70 bg-slate-950/70 p-2">
                          <p className="font-medium">{String(note.title || 'Coaching note')}</p>
                          <p className="text-slate-400">{String(note.note_type || 'general')} • {note.is_reference_case ? 'Reference case' : 'Working note'}</p>
                        </div>
                      ))}
                      {coachingNotes.length === 0 && <p className="text-slate-400">No coaching notes loaded.</p>}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {workspace === 'executive_workspace' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-5 gap-3">
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Stores</p>
                    <p className="text-2xl font-semibold mt-2">{executiveDashboard?.totals?.stores || managementAccess?.stores?.length || 0}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Deals</p>
                    <p className="text-2xl font-semibold mt-2">{executiveDashboard?.totals?.deals || 0}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Funded</p>
                    <p className="text-2xl font-semibold mt-2">{executiveDashboard?.totals?.funded || 0}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Booked</p>
                    <p className="text-2xl font-semibold mt-2">{executiveDashboard?.totals?.booked || 0}</p>
                  </Card>
                  <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Cancelled</p>
                    <p className="text-2xl font-semibold mt-2">{executiveDashboard?.totals?.cancelled || 0}</p>
                  </Card>
                </div>

                <Card className="p-3 bg-slate-900/70 border-slate-700/70">
                  <p className="text-sm font-semibold mb-2">Store Comparison</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {storeComparisons.map((store, idx) => (
                      <div key={idx} className="rounded-md border border-slate-700/70 bg-slate-950/70 p-2 text-xs">
                        <p className="font-medium text-sm">{store.storeName || 'Store'}</p>
                        <p className="text-slate-300 mt-1">
                          Funded {store.funded || 0} • Booked {store.booked || 0} • Cancelled {store.cancelled || 0} • Open CIT {store.openCit || 0}
                        </p>
                        <p className="text-slate-300">PVR {money(store.pvr || 0)} • Cancellations {store.cancellations || 0}</p>
                      </div>
                    ))}
                    {storeComparisons.length === 0 && <p className="text-xs text-slate-400">No cross-store data available yet.</p>}
                  </div>
                </Card>
              </div>
            )}
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-3 space-y-4">
          <Card className="p-4 bg-slate-950/80 border-cyan-300/30 space-y-3 automotive-copilot-rail">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2"><Brain size={16} /> Copilot</h2>
              <Badge variant="secondary">{workspaceRole}</Badge>
            </div>
            <p className="text-xs text-slate-300/85">Contextual role shifts by workspace. This rail is strategy support, not final underwriting authority.</p>
            <Textarea
              value={copilotQuestion}
              onChange={(e) => setCopilotQuestion(e.target.value)}
              placeholder="Ask what to fix, what to say, what to submit, or which path is strongest."
              rows={4}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Copilot response mode"
                value={copilotMode}
                onChange={(e) => setCopilotMode(e.target.value as 'concise' | 'detailed')}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-xs"
              >
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
              </select>
              <Button onClick={() => void runCopilot()} disabled={copilotBusy || !selectedDeal} className="gap-2">
                <ChatCircleDots size={14} />
                {copilotBusy ? 'Analyzing' : 'Run Copilot'}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs">
              <button className="text-left rounded-md border border-slate-700/70 px-2 py-1 bg-slate-900/60" onClick={() => void runCopilot('What is the weakest part of this file right now?')}>Weakest file area</button>
              <button className="text-left rounded-md border border-slate-700/70 px-2 py-1 bg-slate-900/60" onClick={() => void runCopilot('Which path protects gross with lower funding risk?')}>Protect gross safely</button>
              <button className="text-left rounded-md border border-slate-700/70 px-2 py-1 bg-slate-900/60" onClick={() => void runCopilot('Give me customer wording for this structure.')}>Customer talk track</button>
            </div>
          </Card>

          <Card className="p-4 bg-slate-950/70 border-slate-700/70 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck size={14} /> AI Output</h3>
            {aiBlock ? (
              <div className="space-y-3 text-sm">
                <p className="text-slate-200">{String(aiBlock.executiveSummary || '')}</p>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1">Strongest Path</p>
                  <p className="text-slate-200">{String(aiBlock.strongestPath || 'n/a')}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1">Next Actions</p>
                  <div className="space-y-1">
                    {nextActions.slice(0, 4).map((step, idx) => <p key={idx} className="text-slate-300">• {step}</p>)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Run copilot to populate contextual guidance.</p>
            )}
          </Card>

          <Card className="p-4 bg-slate-950/70 border-slate-700/70 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><WarningDiamond size={14} /> Deterministic Findings</h3>
            {findings.length > 0 ? (
              <div className="space-y-2 text-sm">
                {findings.slice(0, 5).map((finding, idx) => (
                  <div key={idx} className="rounded-md border border-slate-700/70 bg-slate-900/60 p-2">
                    <p className="font-medium">{String(finding.title || 'Finding')}</p>
                    <p className="text-slate-400 mt-1">{String(finding.detail || '')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No findings yet.</p>
            )}
          </Card>

          <Card className="p-4 bg-slate-950/70 border-slate-700/70 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Funnel size={14} /> Strategy Paths</h3>
            {strategyPaths.length > 0 ? (
              <div className="space-y-2 text-sm">
                {strategyPaths.slice(0, 3).map((path, idx) => (
                  <div key={idx} className="rounded-md border border-slate-700/70 bg-slate-900/60 p-2">
                    <p className="font-medium">{String(path.label || 'Path')}</p>
                    <p className="text-slate-400 mt-1">{String(path.objective || '')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Run copilot to generate strategy paths.</p>
            )}
          </Card>

          <Card className="p-4 bg-slate-950/70 border-slate-700/70 space-y-2">
            <h3 className="text-sm font-semibold">Manager Memory Controls</h3>
            <Input value={memoryKey} onChange={(e) => setMemoryKey(e.target.value)} placeholder="memory key (ex: preferred_menu_style)" />
            <Textarea value={memoryValue} onChange={(e) => setMemoryValue(e.target.value)} placeholder="memory value" rows={3} />
            <Button onClick={() => void saveMemory()}>Save Memory Signal</Button>
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card className="p-3 bg-slate-950/60 border-slate-700/70">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Recent Intake</p>
          <p className="text-lg font-semibold mt-2">{dashboard.deals.filter((d) => ['lead_received', 'intake'].includes(d.status)).length}</p>
        </Card>
        <Card className="p-3 bg-slate-950/60 border-slate-700/70">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Menu Ready</p>
          <p className="text-lg font-semibold mt-2">{dashboard.summary.dealsReadyForMenu}</p>
        </Card>
        <Card className="p-3 bg-slate-950/60 border-slate-700/70">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Lender Activity</p>
          <p className="text-lg font-semibold mt-2">{dashboard.deals.filter((d) => d.callback_status).length}</p>
        </Card>
        <Card className="p-3 bg-slate-950/60 border-slate-700/70">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Open Risk Files</p>
          <p className="text-lg font-semibold mt-2">{urgentQueue.length}</p>
        </Card>
      </div>
    </div>
  );
}
