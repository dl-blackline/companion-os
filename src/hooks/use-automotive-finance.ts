import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type {
  AutomotiveDealStatus,
  AutomotiveDealType,
  AutomotiveFinanceDashboard,
  AutomotiveReviewSeverity,
} from '@/types/automotive-finance';
import type {
  VehicleRole,
  VehicleCondition,
  ObligationType,
  CitStatus,
  CancellationStatus,
  IssueStatus,
} from '@/types/automotive-domain';

const EMPTY_DASHBOARD: AutomotiveFinanceDashboard = {
  summary: {
    totalDeals: 0,
    openFlags: 0,
    dealsReadyForMenu: 0,
    dealsInCit: 0,
    dealsNeedingDocs: 0,
    callbacksWaiting: 0,
    bookedNotFunded: 0,
    cancellationRequests: 0,
    customerIssues: 0,
    commissionsPending: 0,
  },
  deals: [],
  recentFlags: [],
  products: [],
  presentations: [],
  recentDocuments: [],
};

interface CreateDealInput {
  dealName: string;
  dealType: AutomotiveDealType;
  sourceChannel?: string;
  customerPaymentTarget?: number;
  notes?: string;
}

interface UpsertStructureInput {
  dealId: string;
  sellingPrice?: number;
  cashDown?: number;
  rebates?: number;
  tradeAllowance?: number;
  tradePayoff?: number;
  amountFinanced?: number;
  termMonths?: number;
  aprPercent?: number;
  paymentEstimate?: number;
  backendTotal?: number;
  ttlFees?: number;
  collateralValueBasis?: string;
  collateralValue?: number;
}

interface UpsertProductInput {
  id?: string;
  name: string;
  category: string;
  provider?: string;
  cost?: number;
  sellPrice?: number;
  isActive?: boolean;
}

interface AddReviewFlagInput {
  dealId: string;
  category: string;
  severity: AutomotiveReviewSeverity;
  message: string;
  recommendedAction?: string;
}

interface CaptureAcknowledgmentInput {
  dealId: string;
  presentationId: string;
  customerName: string;
  typedSignature: string;
}

// ── Phase 2 Input Types ────────────────────────────────────────────────────

interface UpsertVehicleInput {
  dealId: string;
  id?: string;
  vehicleRole?: VehicleRole;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trimLevel?: string;
  mileage?: number;
  condition?: VehicleCondition;
  msrp?: number;
  invoiceCost?: number;
  nadaValue?: number;
  kbbValue?: number;
  wholesaleValue?: number;
  bookValueBasis?: string;
  payoffAmount?: number;
  payoffLender?: string;
  stockNumber?: string;
}

interface UpsertObligationInput {
  dealId: string;
  id?: string;
  applicantId?: string;
  obligationType: ObligationType;
  creditorName?: string;
  monthlyPayment: number;
  balanceRemaining?: number;
  isBureauVerified?: boolean;
  isPayingOff?: boolean;
  source?: 'manual' | 'credit_bureau' | 'integration';
  notes?: string;
}

interface UpsertLenderInput {
  id?: string;
  lenderName: string;
  lenderType?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  portalUrl?: string;
  notes?: string;
}

interface IngestCallbackInput {
  dealId: string;
  rawCallbackText: string;
}

interface OpenCitCaseInput {
  dealId: string;
  caseTitle?: string;
  openedReason?: string;
  stipsRequired?: string[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  notes?: string;
}

interface OpenCancellationInput {
  dealId: string;
  productId?: string;
  cancellationReason?: string;
  requestedBy?: string;
  estimatedRefund?: number;
  notes?: string;
}

interface OpenIssueInput {
  dealId: string;
  issueType: string;
  issueDescription?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  notes?: string;
}

interface KpiSnapshotInput {
  dateFrom?: string;
  dateTo?: string;
  saveSnapshot?: boolean;
  label?: string;
}

interface OutboundPayload {
  dealId: string;
  destinationId: string;
}

type CopilotWorkspace =
  | 'deal_workspace'
  | 'callback_workspace'
  | 'structure_workspace'
  | 'menu_workspace'
  | 'cit_workspace'
  | 'reporting_workspace'
  | 'lender_brain';

interface CopilotAnalyzeInput {
  dealId: string;
  workspace: CopilotWorkspace;
  question?: string;
  mode?: 'concise' | 'detailed';
}

interface TeamDashboardInput {
  storeId?: string;
  limit?: number;
}

interface ExecutiveDashboardInput {
  groupId?: string;
}

export function useAutomotiveFinance() {
  const { getAccessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<AutomotiveFinanceDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) {
      throw new Error('You must be signed in to access Automotive Finance.');
    }

    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Automotive finance request failed.');
    }

    return payload.data as AutomotiveFinanceDashboard;
  }, [getAccessToken]);

  // Generic caller for Phase 2 endpoints that return arbitrary data (not dashboard).
  const callEndpoint = useCallback(async (
    endpoint: string,
    body: Record<string, unknown>,
    options?: { suppressStatusCodes?: number[] },
  ) => {
    const token = getAccessToken();
    if (!token) throw new Error('You must be signed in.');

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/.netlify/functions/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        const status = response.status;
        const suppressed = options?.suppressStatusCodes || [];
        if (suppressed.includes(status)) {
          setSaving(false);
          return {} as Record<string, unknown>;
        }
        throw new Error(payload?.error || `${endpoint} request failed (HTTP ${status}).`);
      }
      return payload.data as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : `${endpoint} request failed.`;
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [getAccessToken]);

  const callManagement = useCallback(async (body: Record<string, unknown>) => {
    // Some environments may not have Phase 5 endpoint/migration available yet.
    // Gracefully degrade management features in those cases.
    return callEndpoint('automotive-management', body, { suppressStatusCodes: [404, 406] });
  }, [callEndpoint]);

  const getEndpoint = useCallback(async (endpoint: string, params?: Record<string, string | number | undefined>) => {
    const token = getAccessToken();
    if (!token) throw new Error('You must be signed in.');

    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          search.set(key, String(value));
        }
      });
      const url = search.size > 0
        ? `/.netlify/functions/${endpoint}?${search.toString()}`
        : `/.netlify/functions/${endpoint}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `${endpoint} request failed.`);
      }
      return payload.data as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : `${endpoint} request failed.`;
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!user) {
      setDashboard(EMPTY_DASHBOARD);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/automotive-finance');
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load automotive dashboard.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  const postAction = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/automotive-finance', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setDashboard(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Automotive finance operation failed.';
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  const createDeal = useCallback(async (input: CreateDealInput) => {
    return postAction({ action: 'create_deal', ...input });
  }, [postAction]);

  const setDealStatus = useCallback(async (dealId: string, status: AutomotiveDealStatus) => {
    return postAction({ action: 'set_deal_status', dealId, status });
  }, [postAction]);

  const upsertStructure = useCallback(async (input: UpsertStructureInput) => {
    return postAction({ action: 'upsert_structure', ...input });
  }, [postAction]);

  const upsertProduct = useCallback(async (input: UpsertProductInput) => {
    return postAction({ action: 'upsert_product', ...input });
  }, [postAction]);

  const addReviewFlag = useCallback(async (input: AddReviewFlagInput) => {
    return postAction({ action: 'add_review_flag', ...input });
  }, [postAction]);

  const upsertPresentation = useCallback(async (dealId: string, title: string, menuPayload: Record<string, unknown>) => {
    return postAction({
      action: 'upsert_presentation',
      dealId,
      title,
      menuPayload,
    });
  }, [postAction]);

  const captureAcknowledgment = useCallback(async (input: CaptureAcknowledgmentInput) => {
    return postAction({ action: 'capture_acknowledgment', ...input });
  }, [postAction]);

  // ── Phase 2: Structure + Vehicles + Obligations ─────────────────────────

  const analyzeStructure = useCallback(async (dealId: string) => {
    return callEndpoint('automotive-structure', { action: 'analyze_structure', dealId });
  }, [callEndpoint]);

  const getScenarios = useCallback(async (dealId: string, objective?: 'payment' | 'ltv' | 'approval') => {
    return callEndpoint('automotive-structure', { action: 'get_scenarios', dealId, objective });
  }, [callEndpoint]);

  const getStructureWorkspace = useCallback(async (dealId: string) => {
    return getEndpoint('automotive-structure', { dealId });
  }, [getEndpoint]);

  const upsertVehicle = useCallback(async (input: UpsertVehicleInput) => {
    return callEndpoint('automotive-structure', { action: 'upsert_vehicle', ...input });
  }, [callEndpoint]);

  const upsertObligation = useCallback(async (input: UpsertObligationInput) => {
    return callEndpoint('automotive-structure', { action: 'upsert_obligation', ...input });
  }, [callEndpoint]);

  const deleteObligation = useCallback(async (obligationId: string) => {
    return callEndpoint('automotive-structure', { action: 'delete_obligation', obligationId });
  }, [callEndpoint]);

  // ── Phase 2: Lenders + Callbacks ────────────────────────────────────────

  const upsertLender = useCallback(async (input: UpsertLenderInput) => {
    return callEndpoint('automotive-lenders', { action: 'upsert_lender', ...input });
  }, [callEndpoint]);

  const ingestCallback = useCallback(async (input: IngestCallbackInput) => {
    return callEndpoint('automotive-lenders', { action: 'ingest_callback', ...input });
  }, [callEndpoint]);

  const listCallbacks = useCallback(async (dealId: string) => {
    return callEndpoint('automotive-lenders', { action: 'list_callbacks', dealId });
  }, [callEndpoint]);

  const listLenders = useCallback(async () => {
    return callEndpoint('automotive-lenders', { action: 'list_lenders' });
  }, [callEndpoint]);

  const listGuidelines = useCallback(async (lenderId: string) => {
    return callEndpoint('automotive-lenders', { action: 'list_guidelines', lenderId });
  }, [callEndpoint]);

  // ── Phase 2: CIT + Cancellations + Issues + Commissions ─────────────────

  const openCitCase = useCallback(async (input: OpenCitCaseInput) => {
    return callEndpoint('automotive-post-sale', { action: 'open_cit_case', ...input });
  }, [callEndpoint]);

  const updateCitStatus = useCallback(async (citCaseId: string, newStatus: CitStatus, extras?: Record<string, unknown>) => {
    return callEndpoint('automotive-post-sale', { action: 'update_cit_status', citCaseId, newStatus, ...extras });
  }, [callEndpoint]);

  const openCancellation = useCallback(async (input: OpenCancellationInput) => {
    return callEndpoint('automotive-post-sale', { action: 'open_cancellation', ...input });
  }, [callEndpoint]);

  const updateCancellationStatus = useCallback(async (cancellationId: string, newStatus: CancellationStatus, extras?: Record<string, unknown>) => {
    return callEndpoint('automotive-post-sale', { action: 'update_cancellation_status', cancellationId, newStatus, ...extras });
  }, [callEndpoint]);

  const openCustomerIssue = useCallback(async (input: OpenIssueInput) => {
    return callEndpoint('automotive-post-sale', { action: 'open_customer_issue', ...input });
  }, [callEndpoint]);

  const updateIssueStatus = useCallback(async (issueId: string, newStatus: IssueStatus, resolutionNote?: string) => {
    return callEndpoint('automotive-post-sale', { action: 'update_issue_status', issueId, newStatus, resolutionNote });
  }, [callEndpoint]);

  const listCitCases = useCallback(async (dealId?: string) => {
    return callEndpoint('automotive-post-sale', { action: 'list_cit_cases', dealId });
  }, [callEndpoint]);

  const listCancellations = useCallback(async (dealId?: string) => {
    return callEndpoint('automotive-post-sale', { action: 'list_cancellations', dealId });
  }, [callEndpoint]);

  const listCustomerIssues = useCallback(async (dealId?: string) => {
    return callEndpoint('automotive-post-sale', { action: 'list_customer_issues', dealId });
  }, [callEndpoint]);

  // ── Phase 2: Reporting ───────────────────────────────────────────────────

  const getKpiSnapshot = useCallback(async (input: KpiSnapshotInput) => {
    return callEndpoint('automotive-reporting', { action: 'get_kpi_snapshot', ...input });
  }, [callEndpoint]);

  const getPipelineSummary = useCallback(async () => {
    return callEndpoint('automotive-reporting', { action: 'get_pipeline_summary' });
  }, [callEndpoint]);

  // ── Phase 2: Integrations ────────────────────────────────────────────────

  const previewOutbound = useCallback(async (dealId: string, destinationType: string) => {
    return callEndpoint('automotive-integrations', { action: 'preview_outbound', dealId, destinationType });
  }, [callEndpoint]);

  const sendOutbound = useCallback(async (input: OutboundPayload) => {
    return callEndpoint('automotive-integrations', { action: 'send_outbound', ...input });
  }, [callEndpoint]);

  const listSources = useCallback(async () => {
    return callEndpoint('automotive-integrations', { action: 'list_sources' });
  }, [callEndpoint]);

  const listDestinations = useCallback(async () => {
    return callEndpoint('automotive-integrations', { action: 'list_destinations' });
  }, [callEndpoint]);

  const getIntegrationEvents = useCallback(async (dealId?: string, limit?: number) => {
    return callEndpoint('automotive-integrations', { action: 'get_events', dealId, limit });
  }, [callEndpoint]);

  const listSnapshots = useCallback(async () => {
    return callEndpoint('automotive-reporting', { action: 'list_snapshots' });
  }, [callEndpoint]);

  // ── Phase 4: Contextual Copilot ─────────────────────────────────────────

  const analyzeDealCopilot = useCallback(async (input: CopilotAnalyzeInput) => {
    return callEndpoint('automotive-copilot', { action: 'analyze_deal_copilot', ...input });
  }, [callEndpoint]);

  const getObjectionCoaching = useCallback(async (dealId: string, objectionType: string) => {
    return callEndpoint('automotive-copilot', {
      action: 'get_objection_coaching',
      dealId,
      objectionType,
    });
  }, [callEndpoint]);

  const listCopilotMemory = useCallback(async () => {
    return callEndpoint('automotive-copilot', { action: 'list_memory' });
  }, [callEndpoint]);

  const updateCopilotMemory = useCallback(async (key: string, value: unknown, confidence = 0.8) => {
    return callEndpoint('automotive-copilot', {
      action: 'update_memory',
      key,
      value,
      confidence,
    });
  }, [callEndpoint]);

  // ── Phase 5: Management Scale Layer ────────────────────────────────────

  const bootstrapManagement = useCallback(async () => {
    return callManagement({ action: 'bootstrap_management' });
  }, [callManagement]);

  const getManagementAccessProfile = useCallback(async () => {
    return callManagement({ action: 'get_access_profile' });
  }, [callManagement]);

  const upsertStore = useCallback(async (input: Record<string, unknown>) => {
    return callManagement({ action: 'upsert_store', ...input });
  }, [callManagement]);

  const upsertUserProfile = useCallback(async (input: Record<string, unknown>) => {
    return callManagement({ action: 'upsert_user_profile', ...input });
  }, [callManagement]);

  const assignUserStore = useCallback(async (input: Record<string, unknown>) => {
    return callManagement({ action: 'assign_user_store', ...input });
  }, [callManagement]);

  const createApprovalRequest = useCallback(async (input: Record<string, unknown>) => {
    return callManagement({ action: 'create_approval_request', ...input });
  }, [callManagement]);

  const decideApprovalRequest = useCallback(async (approvalRequestId: string, decisionAction: 'approve' | 'reject' | 'revise_required', note?: string, payload?: Record<string, unknown>) => {
    return callManagement({
      action: 'decide_approval_request',
      approvalRequestId,
      decision: decisionAction,
      note,
      payload,
    });
  }, [callManagement]);

  const listApprovals = useCallback(async (input?: Record<string, unknown>) => {
    return callManagement({ action: 'list_approvals', ...(input || {}) });
  }, [callManagement]);

  const upsertTemplateSet = useCallback(async (input: Record<string, unknown>) => {
    return callManagement({ action: 'upsert_template_set', ...input });
  }, [callManagement]);

  const upsertTemplate = useCallback(async (input: Record<string, unknown>) => {
    return callManagement({ action: 'upsert_template', ...input });
  }, [callManagement]);

  const listTemplates = useCallback(async (input?: Record<string, unknown>) => {
    return callManagement({ action: 'list_templates', ...(input || {}) });
  }, [callManagement]);

  const upsertLenderPlaybook = useCallback(async (input: Record<string, unknown>) => {
    return callManagement({ action: 'upsert_lender_playbook', ...input });
  }, [callManagement]);

  const listLenderPlaybooks = useCallback(async (input?: Record<string, unknown>) => {
    return callManagement({ action: 'list_lender_playbooks', ...(input || {}) });
  }, [callManagement]);

  const getTeamDashboard = useCallback(async (input?: TeamDashboardInput) => {
    return callManagement({ action: 'get_team_dashboard', ...(input || {}) });
  }, [callManagement]);

  const getExecutiveDashboard = useCallback(async (input?: ExecutiveDashboardInput) => {
    return callManagement({ action: 'get_executive_dashboard', ...(input || {}) });
  }, [callManagement]);

  const searchAuditEvents = useCallback(async (input?: Record<string, unknown>) => {
    return callManagement({ action: 'search_audit_events', ...(input || {}) });
  }, [callManagement]);

  const addCoachingNote = useCallback(async (input: Record<string, unknown>) => {
    return callManagement({ action: 'add_coaching_note', ...input });
  }, [callManagement]);

  const listCoachingNotes = useCallback(async (input?: Record<string, unknown>) => {
    return callManagement({ action: 'list_coaching_notes', ...(input || {}) });
  }, [callManagement]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    dashboard,
    loading,
    saving,
    error,
    refresh,
    createDeal,
    setDealStatus,
    upsertStructure,
    upsertProduct,
    addReviewFlag,
    upsertPresentation,
    captureAcknowledgment,
    // Phase 2 — structure
    analyzeStructure,
    getScenarios,
    getStructureWorkspace,
    upsertVehicle,
    upsertObligation,
    deleteObligation,
    // Phase 2 — lenders + callbacks
    upsertLender,
    ingestCallback,
    listCallbacks,
    listLenders,
    listGuidelines,
    // Phase 2 — post-sale
    openCitCase,
    updateCitStatus,
    openCancellation,
    updateCancellationStatus,
    openCustomerIssue,
    updateIssueStatus,
    listCitCases,
    listCancellations,
    listCustomerIssues,
    // Phase 2 — reporting
    getKpiSnapshot,
    getPipelineSummary,
    listSnapshots,
    // Phase 2 — integrations
    previewOutbound,
    sendOutbound,
    listSources,
    listDestinations,
    getIntegrationEvents,
    // Phase 4 — copilot
    analyzeDealCopilot,
    getObjectionCoaching,
    listCopilotMemory,
    updateCopilotMemory,
    // Phase 5 — management
    bootstrapManagement,
    getManagementAccessProfile,
    upsertStore,
    upsertUserProfile,
    assignUserStore,
    createApprovalRequest,
    decideApprovalRequest,
    listApprovals,
    upsertTemplateSet,
    upsertTemplate,
    listTemplates,
    upsertLenderPlaybook,
    listLenderPlaybooks,
    getTeamDashboard,
    getExecutiveDashboard,
    searchAuditEvents,
    addCoachingNote,
    listCoachingNotes,
  };
}
