/**
 * lib/automotive/copilot-intelligence.js
 *
 * Phase 4 intelligence scaffolding for contextual automotive finance copilot behavior.
 * This module is intentionally deterministic-first and AI-augmented second.
 */

import { sanitizeAiResponse } from './compliance-guardrails.js';

export const COPILOT_WORKSPACES = Object.freeze({
  deal_workspace: 'deal_workspace',
  callback_workspace: 'callback_workspace',
  structure_workspace: 'structure_workspace',
  menu_workspace: 'menu_workspace',
  cit_workspace: 'cit_workspace',
  reporting_workspace: 'reporting_workspace',
  lender_brain: 'lender_brain',
});

export const COPILOT_ROLE_BY_WORKSPACE = Object.freeze({
  deal_workspace: 'Live Deal Strategist',
  callback_workspace: 'Callback Strategist',
  structure_workspace: 'Structure Coach',
  menu_workspace: 'F&I Presentation Coach',
  cit_workspace: 'Funding and CIT Coach',
  reporting_workspace: 'Performance Analyst',
  lender_brain: 'Guideline Interpreter',
});

export const OBJECTION_PLAYBOOKS = Object.freeze({
  payment_too_high: {
    label: 'Payment is too high',
    goal: 'Acknowledge concern and explore options without pressure or concealment.',
    prompts: [
      'Would it help if I show a lower-payment option with fewer products first?',
      'Is your target a hard cap, or do you want to see two side-by-side payment choices?',
    ],
  },
  no_products: {
    label: "I do not want any products",
    goal: 'Respect decline while clarifying risk ownership and choice.',
    prompts: [
      'Would it help if we reviewed only the two products with the highest usage rate?',
      'Would you like the bare payment first, then an optional protection version for comparison?',
    ],
  },
  already_covered: {
    label: 'I already have coverage',
    goal: 'Validate existing coverage and compare specific gaps factually.',
    prompts: [
      'If you have the policy details, we can compare deductibles and limits side by side.',
      'Would you like me to show only what is redundant versus what could fill a gap?',
    ],
  },
  distrust: {
    label: 'I do not trust this',
    goal: 'Rebuild trust through transparency and simple language.',
    prompts: [
      'Would it help if we slow down and review each line item in plain terms?',
      'I can print both options and you can take a copy before deciding.',
    ],
  },
});

function toPct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n.toFixed(digits)}%`;
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function severityFromPressure(pressureScore) {
  if (pressureScore >= 80) return 'critical';
  if (pressureScore >= 60) return 'high';
  if (pressureScore >= 40) return 'medium';
  return 'low';
}

export function buildContextDigest(context) {
  const deal = context.deal || {};
  const metrics = context.metrics || {};
  const docs = context.documents || [];
  const flags = context.flags || [];
  const callbacks = context.callbacks || [];
  const callbackOptions = context.callbackOptions || [];
  const openCit = (context.citCases || []).filter((row) => !['resolved', 'unfunded', 'archived'].includes(row.current_status));
  const openIssues = (context.issues || []).filter((row) => !['resolved', 'closed'].includes(row.current_status));
  const openCancellations = (context.cancellations || []).filter((row) => !['refunded', 'closed'].includes(row.current_status));

  const weakDocs = docs.filter((doc) => ['uploaded', 'needs_review', 'rejected'].includes(doc.document_status));
  const latestCallback = callbacks[0] || null;

  return {
    dealId: deal.id,
    dealName: deal.deal_name,
    dealType: deal.deal_type,
    status: deal.status,
    paymentTarget: deal.customer_payment_target,
    metrics: {
      ltv: safeNum(metrics.ltv_percent, null),
      pti: safeNum(metrics.pti_percent, null),
      dti: safeNum(metrics.dti_percent, null),
      pressure: safeNum(metrics.structure_pressure_score, null),
      readiness: safeNum(metrics.approval_readiness_score, null),
      payment: safeNum(metrics.payment_estimate, null),
      frontGross: safeNum(metrics.front_gross, null),
      backGross: safeNum(metrics.back_gross, null),
    },
    openFlagCount: flags.length,
    weakDocumentCount: weakDocs.length,
    latestCallbackStatus: latestCallback?.status || null,
    callbackOptionCount: callbackOptions.length,
    openCitCount: openCit.length,
    openIssueCount: openIssues.length,
    openCancellationCount: openCancellations.length,
  };
}

export function generateDeterministicInsights(workspace, context) {
  const digest = buildContextDigest(context);
  const findings = [];
  const nextSteps = [];
  const citations = [];

  if (digest.metrics.pressure != null && digest.metrics.pressure >= 60) {
    findings.push({
      severity: severityFromPressure(digest.metrics.pressure),
      title: 'Structure pressure is elevated',
      detail: `Current pressure score is ${digest.metrics.pressure}. Reduce risk before lender resubmission.`,
      source: 'system_computed',
    });
    nextSteps.push('Run scenario comparison with approval-first objective and trim backend load if needed.');
    citations.push('Deal metrics: structure_pressure_score');
  }

  if (digest.weakDocumentCount > 0) {
    findings.push({
      severity: digest.weakDocumentCount > 2 ? 'high' : 'medium',
      title: 'Document quality still blocks clean submission',
      detail: `${digest.weakDocumentCount} document(s) are still in uploaded, needs_review, or rejected status.`,
      source: 'document',
    });
    nextSteps.push('Prioritize document review and clear mismatches before lender-facing changes.');
    citations.push('Document statuses from automotive_documents');
  }

  if (digest.openFlagCount > 0) {
    findings.push({
      severity: digest.openFlagCount > 3 ? 'high' : 'medium',
      title: 'Open file-quality flags remain',
      detail: `${digest.openFlagCount} unresolved review flag(s) are still active.`,
      source: 'user_manual',
    });
    nextSteps.push('Resolve high-severity flags first and document rationale for remaining exceptions.');
    citations.push('Open flags from automotive_review_flags');
  }

  if (workspace === COPILOT_WORKSPACES.callback_workspace) {
    if (digest.callbackOptionCount === 0) {
      findings.push({
        severity: 'medium',
        title: 'No structured callback options available',
        detail: 'Ingest callback text first so options can be compared side-by-side.',
        source: 'lender_callback',
      });
      nextSteps.push('Run callback ingestion, then evaluate approval-first versus payment-first path.');
    } else {
      findings.push({
        severity: 'low',
        title: 'Callback options are available for strategy comparison',
        detail: `${digest.callbackOptionCount} option(s) are ready for tradeoff review.`,
        source: 'lender_callback',
      });
      nextSteps.push('Select one option for approvability and one for customer payment; compare required cash and stip burden.');
      citations.push('Callback option data from automotive_callback_options');
    }
  }

  if (workspace === COPILOT_WORKSPACES.cit_workspace && digest.openCitCount > 0) {
    findings.push({
      severity: 'high',
      title: 'Open CIT exposure requires active follow-up',
      detail: `${digest.openCitCount} case(s) remain open and can delay funding completion.`,
      source: 'integration',
    });
    nextSteps.push('Sort open CIT by aging and missing stips; assign clear owner and next contact timestamp.');
    citations.push('CIT statuses from automotive_cit_cases');
  }

  if (workspace === COPILOT_WORKSPACES.menu_workspace && digest.metrics.paymentTarget && digest.metrics.payment) {
    const delta = safeNum(digest.metrics.payment) - safeNum(digest.metrics.paymentTarget);
    if (delta > 75) {
      findings.push({
        severity: 'medium',
        title: 'Payment exceeds target materially',
        detail: `Current payment is approximately $${Math.round(delta)} above the stated target.`,
        source: 'system_computed',
      });
      nextSteps.push('Prepare a transparent package ladder with a payment-first fallback option.');
      citations.push('Payment estimate versus customer payment target');
    }
  }

  if (nextSteps.length === 0) {
    nextSteps.push('No critical blockers detected. Continue with clean documentation and disciplined structure updates.');
  }

  return { digest, findings, nextSteps, citations };
}

export function buildStrategyPaths(context) {
  const digest = buildContextDigest(context);
  const payment = safeNum(digest.metrics.payment, 0);

  return [
    {
      key: 'approval_first',
      label: 'Approval-First Path',
      objective: 'Maximize probability of lender acceptance with conservative structure.',
      actions: [
        'Trim high-risk backend items first.',
        'Reduce LTV and PTI pressure where possible with cash/trade adjustments.',
        'Attach clean income and residence proof before resubmission.',
      ],
      risk: 'May reduce gross and product attachment.',
    },
    {
      key: 'gross_preserving',
      label: 'Gross-Preserving Path',
      objective: 'Protect backend and reserve while staying inside callback tolerance.',
      actions: [
        'Prioritize high-value, low-chargeback products.',
        'Use transparent package framing with clear disclosure of payment impact.',
        'Avoid overpacking if payment exceeds target by more than $75.',
      ],
      risk: 'Can increase payment objection risk if not framed cleanly.',
    },
    {
      key: 'payment_first',
      label: 'Payment-First Path',
      objective: 'Increase customer acceptance by reducing payment friction.',
      actions: [
        `Target monthly payment at or below ${payment ? `$${Math.round(payment)}` : 'current estimate'} with lighter package mix.`,
        'Stage optional products in a second pass after base acceptance.',
        'Use concise benefit language and avoid feature overload.',
      ],
      risk: 'May reduce immediate per-unit gross.',
    },
  ];
}

export function buildCopilotPrompt({ workspace, context, userQuestion, mode = 'concise' }) {
  const role = COPILOT_ROLE_BY_WORKSPACE[workspace] || 'Finance Copilot';
  const digest = buildContextDigest(context);

  const system = [
    'You are Companion, an elite automotive finance copilot for a dealership F&I office.',
    `Current role: ${role}.`,
    'Return practical operational guidance. Use short sections and action-oriented language.',
    'Never claim final underwriting authority. Never advise deception, falsification, hidden charges, discriminatory actions, or unlawful conduct.',
    'When uncertain, state assumptions explicitly.',
    'Distinguish source-backed facts from judgment.',
    'Output strict JSON with keys: executiveSummary, strongestPath, risks, nextActions, customerTalkTrack, lenderTalkTrack, complianceNotes.',
  ].join(' ');

  const user = [
    `Workspace: ${workspace}`,
    `Response mode: ${mode}`,
    `Question: ${userQuestion || 'Provide best guidance for this workspace right now.'}`,
    'Context digest:',
    JSON.stringify(digest),
    'Guideline references:',
    JSON.stringify((context.guidelines || []).slice(0, 5)),
    'Callback options:',
    JSON.stringify((context.callbackOptions || []).slice(0, 6)),
  ].join('\n');

  return { system, user };
}

export function parseCopilotResponse(rawText, fallbackInsights) {
  let parsed;
  try {
    const cleaned = String(rawText || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return {
      executiveSummary: sanitizeAiResponse(String(rawText || 'No AI response available.')),
      strongestPath: 'Use deterministic guidance below while AI output is unavailable.',
      risks: fallbackInsights.findings.map((row) => row.detail),
      nextActions: fallbackInsights.nextSteps,
      customerTalkTrack: [
        'I want to keep this transparent and show the cleanest option first.',
        'Then we can compare protection choices that fit your payment comfort.',
      ],
      lenderTalkTrack: [
        'Here is what we corrected since the previous callback and why.',
        'Please confirm whether these updates align with program tolerance.',
      ],
      complianceNotes: [
        'AI output fallback mode engaged. Validate all lender-facing statements before use.',
      ],
    };
  }

  return {
    executiveSummary: sanitizeAiResponse(parsed.executiveSummary || ''),
    strongestPath: sanitizeAiResponse(parsed.strongestPath || ''),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map((s) => sanitizeAiResponse(String(s))) : [],
    nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.map((s) => sanitizeAiResponse(String(s))) : [],
    customerTalkTrack: Array.isArray(parsed.customerTalkTrack) ? parsed.customerTalkTrack.map((s) => sanitizeAiResponse(String(s))) : [],
    lenderTalkTrack: Array.isArray(parsed.lenderTalkTrack) ? parsed.lenderTalkTrack.map((s) => sanitizeAiResponse(String(s))) : [],
    complianceNotes: Array.isArray(parsed.complianceNotes) ? parsed.complianceNotes.map((s) => sanitizeAiResponse(String(s))) : [],
  };
}

export function buildObjectionCoaching(objectionType, context) {
  const playbook = OBJECTION_PLAYBOOKS[objectionType] || {
    label: 'General objection',
    goal: 'Keep communication clear, calm, and transparent.',
    prompts: ['Would you like to see a simpler side-by-side option first?'],
  };

  const digest = buildContextDigest(context);

  const scripts = [
    'I understand your concern, and I want to keep this straightforward.',
    'Let me show the base option first, then we can decide if any protection is worth adding for your situation.',
    'You are in control of what you accept, and I can print all options for your review.',
  ];

  if (digest.metrics.paymentTarget && digest.metrics.payment) {
    const delta = safeNum(digest.metrics.payment) - safeNum(digest.metrics.paymentTarget);
    if (delta > 0) {
      scripts.push(`We are about $${Math.round(delta)} above your target right now, so I can show where that comes from and what levers we have.`);
    }
  }

  return {
    objectionType,
    label: playbook.label,
    goal: playbook.goal,
    followUpQuestions: playbook.prompts,
    scripts,
    complianceReminder: 'Do not hide payment impact or imply products are required when they are optional.',
  };
}
