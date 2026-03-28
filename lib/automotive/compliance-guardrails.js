/**
 * lib/automotive/compliance-guardrails.js
 *
 * Compliance-aware system guardrails for the automotive finance manager.
 *
 * Purpose:
 * - Preserve audit trails and source-to-derived data lineage
 * - Distinguish source-backed data from AI inference
 * - Prevent overclaiming AI accuracy or authority
 * - Flag internally inconsistent structures
 * - Provide safe, factual output formatting for AI responses
 *
 * This module does NOT: make credit decisions, certify document authenticity,
 * make fraud determinations, or replace lender underwriting.
 */

// ── Source Provenance Tags ─────────────────────────────────────────────────

export const DATA_SOURCES = Object.freeze({
  USER_MANUAL:      'user_manual',       // Explicitly entered by the manager
  DOCUMENT:         'document',          // Extracted from uploaded source file
  AI_INFERRED:      'ai_inferred',       // AI-derived (not document-confirmed)
  LENDER_CALLBACK:  'lender_callback',   // Stated in a lender callback
  INTEGRATION:      'integration',       // Arrived via integration webhook
  SYSTEM_COMPUTED:  'system_computed',   // Derived by a calculation engine
});

/**
 * Disclosure label for each data source type.
 */
export const SOURCE_DISCLOSURES = Object.freeze({
  user_manual:     '(Manually entered — not document-verified)',
  document:        '(From uploaded document)',
  ai_inferred:     '(AI-assisted estimate — requires human review)',
  lender_callback: '(From lender callback — verify with lender before acting)',
  integration:     '(From integration feed)',
  system_computed: '(Calculated from entered inputs)',
});

// ── AI Response Safety ─────────────────────────────────────────────────────

/**
 * Add a standard inference disclosure to an AI-generated text response.
 * Ensures AI output is never presented as authoritative.
 *
 * @param {string} text
 * @returns {string}
 */
export function addInferenceDisclosure(text) {
  const disclosure =
    '\n\n[AI-Assisted Analysis — This output is based on the information provided and should be ' +
    'reviewed by the F&I manager before action. It is not a credit decision, compliance determination, ' +
    'or guarantee of lender approval.]';
  return text + disclosure;
}

/**
 * Add a source citation to a finding or recommendation.
 *
 * @param {string} text
 * @param {string} source     - DATA_SOURCES key
 * @param {string} [detail]   - Optional detail (filename, lender name, etc.)
 * @returns {string}
 */
export function addSourceCitation(text, source, detail = '') {
  const disclosure = SOURCE_DISCLOSURES[source] || '';
  const detailSuffix = detail ? ` — ${detail}` : '';
  return `${text} ${disclosure}${detailSuffix}`;
}

/**
 * Sanitize AI-generated response text.
 * Removes or modifies patterns that overclaim authority or certainty.
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizeAiResponse(text) {
  if (!text || typeof text !== 'string') return text;

  // Replace definitive approval language with advisory language
  const replacements = [
    [/\bwill be approved\b/gi, 'may be approvable'],
    [/\bguaranteed( to)? approve/gi, 'potentially eligible for approval'],
    [/\b(the |a |this )lender will\b/gi, 'the lender may'],
    [/\bcertified (fraud|fake|falsified)\b/gi, 'potentially suspicious (requires review)'],
    [/\bconfirm\b.{0,30}\bfraud\b/gi, 'flag for review'],
    [/\bis fraudulent\b/gi, 'requires human review'],
    [/\bdefinitely (won't|will not) approve/gi, 'may not approve'],
    [/\byou (should|must) hide\b/gi, 'you should disclose'],
  ];

  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

// ── Structure Integrity Validation ─────────────────────────────────────────

/**
 * Validate a deal structure for internal consistency.
 * Catches logical errors before saving or presenting.
 *
 * @param {object} structure - Deal structure fields
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
export function validateStructureIntegrity(structure) {
  const errors = [];
  const warnings = [];

  const s = structure;

  // Selling price must be positive
  if (s.sellingPrice <= 0) {
    errors.push('Selling price must be greater than zero.');
  }

  // Term must be a reasonable auto finance term
  if (s.termMonths && (s.termMonths < 12 || s.termMonths > 96)) {
    errors.push(`Term of ${s.termMonths} months is outside normal auto finance range (12–96 months).`);
  }

  // APR sanity check
  if (s.aprPercent != null && (s.aprPercent < 0 || s.aprPercent > 35)) {
    errors.push(`APR of ${s.aprPercent}% is outside expected range (0–35%). Verify rate.`);
  }

  // Amount financed should not exceed a very large threshold
  if (s.amountFinanced > 500000) {
    warnings.push('Amount financed exceeds $500,000. Confirm this is a commercial deal.');
  }

  // Cash down cannot exceed selling price
  if ((s.cashDown || 0) > (s.sellingPrice || 0)) {
    errors.push('Cash down cannot exceed the selling price.');
  }

  // Backend total should not exceed amount financed
  if ((s.backendTotal || 0) > (s.amountFinanced || 0)) {
    warnings.push('Backend total exceeds amount financed — review structure.');
  }

  // Lease-specific checks
  if (s.dealType === 'lease') {
    if (!s.moneyFactor && !s.aprPercent) {
      warnings.push('Lease deal requires either money factor or APR to estimate payment.');
    }
    if (!s.residualPercent) {
      warnings.push('Lease deal is missing residual percent — cannot compute accurate payment.');
    }
    if (s.termMonths && (s.termMonths < 12 || s.termMonths > 60)) {
      warnings.push(`Lease term of ${s.termMonths} months is unusual (typical: 24–48 months).`);
    }
  }

  // Balloon-specific
  if (s.dealType === 'balloon') {
    if (!s.balloonAmount || s.balloonAmount <= 0) {
      warnings.push('Balloon deal is missing balloon amount.');
    }
    if (s.balloonAmount >= s.amountFinanced) {
      errors.push('Balloon amount cannot equal or exceed the amount financed.');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// ── Action Pattern Detection ───────────────────────────────────────────────

/**
 * Detect action payload patterns that would be deceptive or unsafe.
 * Used as a pre-flight check in Netlify functions before saving to DB.
 *
 * @param {string} action   - The action name
 * @param {object} payload  - Request body
 * @returns {{ isSafe: boolean, violations: string[] }}
 */
export function detectUnsafePattern(action, payload) {
  const violations = [];

  // Prevent storing AI-generated values as if user-confirmed
  if (
    action === 'confirm_field' &&
    payload.source === DATA_SOURCES.AI_INFERRED &&
    !payload.managerReviewNote
  ) {
    violations.push('AI-inferred field values must include a manager review note before confirmation.');
  }

  // Prevent overwriting an immutable acknowledgment record
  if (action === 'capture_acknowledgment' && payload.id) {
    violations.push('Acknowledgment records are immutable and cannot be overwritten.');
  }

  // Prevent fabricated lender approvals
  if (
    action.includes('callback') &&
    payload.isApproved === true &&
    !payload.rawInput
  ) {
    violations.push('Cannot mark a callback as approved without the original raw callback text on record.');
  }

  return { isSafe: violations.length === 0, violations };
}

// ── Audit Trail Requirements ───────────────────────────────────────────────

/**
 * Determine which actions require an audit trail entry in automotive_timeline_events.
 *
 * @param {string} action
 * @returns {boolean}
 */
export function requiresAuditTrail(action) {
  const auditableActions = new Set([
    'create_deal',
    'set_deal_status',
    'capture_acknowledgment',
    'confirm_field',
    'add_review_flag',
    'resolve_review_flag',
    'upsert_structure',
    'submit_to_lender',
    'log_outbound',
    'open_cit_case',
    'resolve_cit_case',
    'request_cancellation',
    'confirm_cancellation',
  ]);
  return auditableActions.has(action);
}

// ── Compliance Note Formatting ─────────────────────────────────────────────

/**
 * Standardize a compliance finding for storage or display.
 *
 * @param {object} finding
 * @param {string} finding.type       - e.g. 'mismatch', 'expiration', 'missing'
 * @param {string} finding.severity   - 'low' | 'medium' | 'high' | 'critical'
 * @param {string} finding.message
 * @param {string} [finding.source]   - DATA_SOURCES key
 * @returns {object}
 */
export function formatComplianceNote(finding) {
  return {
    type: finding.type,
    severity: finding.severity,
    message: finding.message,
    sourceLabel: finding.source ? (SOURCE_DISCLOSURES[finding.source] || finding.source) : null,
    isAiGenerated: finding.source === DATA_SOURCES.AI_INFERRED,
    requiresHumanReview: ['critical', 'high'].includes(finding.severity),
    generatedAt: new Date().toISOString(),
  };
}

// ── Guideline Retrieval Safety ─────────────────────────────────────────────

/**
 * Format a lender guideline retrieval result with clear source attribution.
 * Ensures AI-retrieved guideline info is never presented as authoritative without citation.
 *
 * @param {string}       finding      - The guideline finding text
 * @param {string|null}  sourceName   - Guideline document name
 * @param {boolean}      isAiInferred - Whether this was AI inferred vs. directly cited
 * @returns {string}
 */
export function formatGuidelineFinding(finding, sourceName, isAiInferred = false) {
  let result = finding;

  if (sourceName) {
    result += `\n\nSource: ${sourceName}`;
  }

  if (isAiInferred) {
    result +=
      '\n\n[Note: This finding is based on AI inference from the guideline document. ' +
      'It may not reflect the exact current lender policy. Verify directly with the lender before submission.]';
  } else {
    result +=
      '\n\n[Cited from uploaded guideline document. Confirm document is current before relying on this information.]';
  }

  return result;
}
