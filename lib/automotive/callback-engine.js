/**
 * lib/automotive/callback-engine.js
 *
 * Lender callback interpretation engine.
 * Parses raw callback data into structured options, generates plain-English
 * explanations, and produces side-by-side comparisons.
 *
 * AI extraction is OPTIONAL — the engine works in structured mode (pre-parsed
 * options) or raw-text mode (requires AI call from the Netlify function layer).
 *
 * This file does NOT call the AI directly — it exports prompt builders
 * and structured parsers that the Netlify function uses.
 */

import { calculatePMT, calculateAmountFinanced, calculateLTV } from './structure-engine.js';

// ── AI Prompt Builder ──────────────────────────────────────────────────────

/**
 * Build the AI extraction prompt for a raw callback.
 * Returns a system + user message pair ready for generateChatCompletion().
 *
 * @param {string} rawCallbackText      - Exactly as received (phone notes, email, fax scan)
 * @param {object} [dealContext]        - Optional current deal context for reference
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildCallbackExtractionPrompt(rawCallbackText, dealContext = {}) {
  const contextSection = dealContext.amountFinanced
    ? `\n\nDEAL CONTEXT (for reference only — do not fabricate options not in the callback):\n` +
      `Amount Financed: $${dealContext.amountFinanced}\n` +
      `Term Requested: ${dealContext.termMonths} months\n` +
      `APR Requested: ${dealContext.aprPercent}%\n` +
      `Collateral Value: $${dealContext.collateralValue}`
    : '';

  const systemPrompt =
    'You are an automotive finance callback parser. ' +
    'Your job is to extract structured information from lender callback notes. ' +
    'Extract ONLY what is explicitly stated. Do not infer, fabricate, or assume any terms not in the input. ' +
    'If a field is not mentioned, set it to null. ' +
    'Return valid JSON only — no markdown, no commentary.';

  const userPrompt =
    `Parse the following lender callback and extract all approval options.\n` +
    `Each option should represent a distinct approval scenario with different terms, advances, rates, or conditions.\n\n` +
    `CALLBACK TEXT:\n${rawCallbackText}${contextSection}\n\n` +
    `Return JSON in this exact structure:\n` +
    `{\n` +
    `  "lender_name": "string or null",\n` +
    `  "callback_rep": "string or null",\n` +
    `  "lender_notes": "string — any general notes from the callback not in a specific option",\n` +
    `  "options": [\n` +
    `    {\n` +
    `      "option_number": 1,\n` +
    `      "label": "brief label like 'Option A' or 'Tier 1'",\n` +
    `      "term_months": null,\n` +
    `      "rate_percent": null,\n` +
    `      "advance_percent": null,\n` +
    `      "max_amount_financed": null,\n` +
    `      "required_cash_down": null,\n` +
    `      "max_backend_amount": null,\n` +
    `      "max_backend_percent": null,\n` +
    `      "pti_cap_percent": null,\n` +
    `      "dti_cap_percent": null,\n` +
    `      "stips_required": [],\n` +
    `      "customer_restrictions": {},\n` +
    `      "lender_option_notes": "any notes specific to this option"\n` +
    `    }\n` +
    `  ]\n` +
    `}`;

  return { systemPrompt, userPrompt };
}

// ── Structured Option Normalization ───────────────────────────────────────

/**
 * Normalize a raw option object (from AI or manual entry) into a clean structure.
 * Coerces types and fills defaults.
 *
 * @param {object} rawOption
 * @param {number} optionIndex  - Fallback option number
 * @returns {object}
 */
export function normalizeCallbackOption(rawOption, optionIndex = 1) {
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    option_number: Number(rawOption.option_number) || optionIndex,
    label: rawOption.label || `Option ${optionIndex}`,
    term_months: toNum(rawOption.term_months),
    rate_percent: toNum(rawOption.rate_percent),
    advance_percent: toNum(rawOption.advance_percent),
    max_amount_financed: toNum(rawOption.max_amount_financed),
    required_cash_down: toNum(rawOption.required_cash_down),
    max_backend_amount: toNum(rawOption.max_backend_amount),
    max_backend_percent: toNum(rawOption.max_backend_percent),
    pti_cap_percent: toNum(rawOption.pti_cap_percent),
    dti_cap_percent: toNum(rawOption.dti_cap_percent),
    stips_required: Array.isArray(rawOption.stips_required) ? rawOption.stips_required : [],
    customer_restrictions:
      rawOption.customer_restrictions && typeof rawOption.customer_restrictions === 'object'
        ? rawOption.customer_restrictions
        : {},
    lender_option_notes: rawOption.lender_option_notes || null,
  };
}

/**
 * Parse AI extraction output into an array of normalized callback options.
 * Returns an empty array if the AI output is invalid or unusable.
 *
 * @param {string} aiResponseText  - Raw string from AI completion
 * @returns {{ lenderName: string|null, callbackRep: string|null, lenderNotes: string|null, options: object[], parseError: string|null }}
 */
export function parseAiCallbackResponse(aiResponseText) {
  try {
    let cleaned = aiResponseText.trim();
    // Strip markdown code fences if present
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed.options)) {
      return {
        lenderName: null,
        callbackRep: null,
        lenderNotes: parsed.lender_notes || null,
        options: [],
        parseError: 'AI response did not include an options array.',
      };
    }

    const options = parsed.options.map((opt, i) => normalizeCallbackOption(opt, i + 1));

    return {
      lenderName: parsed.lender_name || null,
      callbackRep: parsed.callback_rep || null,
      lenderNotes: parsed.lender_notes || null,
      options,
      parseError: null,
    };
  } catch (err) {
    return {
      lenderName: null,
      callbackRep: null,
      lenderNotes: null,
      options: [],
      parseError: `Failed to parse AI callback response: ${err.message}`,
    };
  }
}

// ── Option Enrichment ──────────────────────────────────────────────────────

/**
 * Enrich a callback option with computed payment and LTV estimates.
 * Uses current deal context (amount financed, collateral value).
 *
 * @param {object} option
 * @param {object} dealContext  - { amountFinanced, collateralValue }
 * @returns {object} Option with estimated_payment and estimated_ltv added
 */
export function enrichCallbackOption(option, dealContext = {}) {
  const af = option.max_amount_financed || dealContext.amountFinanced || 0;
  const collateral = dealContext.collateralValue || 0;

  const estimatedPayment =
    option.term_months && option.rate_percent && af
      ? calculatePMT(af, option.rate_percent, option.term_months)
      : null;

  const estimatedLtv = af && collateral ? calculateLTV(af, collateral) : null;

  return {
    ...option,
    estimated_payment: estimatedPayment,
    estimated_ltv: estimatedLtv,
  };
}

// ── Plain-English Explanation ──────────────────────────────────────────────

/**
 * Generate a plain-English explanation of a single callback option.
 * Always includes the lender-stated values — never fabricates restrictions.
 *
 * @param {object} option        - Normalized callback option (enriched)
 * @param {object} dealContext   - { currentAmountFinanced, currentPayment, currentTerm }
 * @returns {string}
 */
export function explainCallbackOption(option, dealContext = {}) {
  const lines = [];

  lines.push(`${option.label}:`);

  if (option.term_months) lines.push(`- Term: ${option.term_months} months`);
  if (option.rate_percent !== null) lines.push(`- Rate: ${option.rate_percent}% APR`);
  if (option.advance_percent !== null) lines.push(`- Max advance: ${option.advance_percent}% of collateral value`);
  if (option.max_amount_financed !== null) lines.push(`- Max amount financed: $${option.max_amount_financed.toLocaleString()}`);
  if (option.required_cash_down !== null) lines.push(`- Required cash down: $${option.required_cash_down.toLocaleString()}`);
  if (option.max_backend_amount !== null) lines.push(`- Max backend: $${option.max_backend_amount.toLocaleString()}`);
  if (option.max_backend_percent !== null) lines.push(`- Max backend: ${option.max_backend_percent}% of amount financed`);
  if (option.pti_cap_percent !== null) lines.push(`- PTI cap: ${option.pti_cap_percent}%`);
  if (option.dti_cap_percent !== null) lines.push(`- DTI cap: ${option.dti_cap_percent}%`);

  if (option.stips_required?.length) {
    lines.push(`- Stipulations required: ${option.stips_required.join(', ')}`);
  }

  if (option.estimated_payment !== null) {
    lines.push(`- Estimated payment at these terms: $${option.estimated_payment.toFixed(2)}/mo`);
  }

  if (option.estimated_ltv !== null) {
    lines.push(`- Estimated LTV: ${option.estimated_ltv.toFixed(1)}%`);
  }

  // Impact vs. current deal
  if (dealContext.currentAmountFinanced && option.max_amount_financed) {
    const diff = option.max_amount_financed - dealContext.currentAmountFinanced;
    if (diff < 0) {
      lines.push(`- IMPACT: Amount financed needs to be reduced by $${Math.abs(diff).toLocaleString()} from current structure.`);
    } else if (diff > 0) {
      lines.push(`- IMPACT: Lender allows up to $${diff.toLocaleString()} more than current structure.`);
    }
  }

  if (option.required_cash_down && dealContext.currentCashDown !== null) {
    const addlDown = option.required_cash_down - dealContext.currentCashDown;
    if (addlDown > 0) {
      lines.push(`- IMPACT: Customer needs $${addlDown.toLocaleString()} additional cash down.`);
    }
  }

  if (option.lender_option_notes) {
    lines.push(`- Lender note: ${option.lender_option_notes}`);
  }

  return lines.join('\n');
}

// ── Option Comparison ──────────────────────────────────────────────────────

/**
 * Build a side-by-side comparison matrix of all callback options.
 *
 * @param {object[]} options   - Enriched, normalized callback options
 * @returns {object} Comparison table keyed by metric
 */
export function compareCallbackOptions(options = []) {
  if (!options.length) return { options: [], metrics: [] };

  const metrics = [
    { key: 'term_months', label: 'Term', format: (v) => v ? `${v} mo` : '—' },
    { key: 'rate_percent', label: 'APR', format: (v) => v !== null ? `${v}%` : '—' },
    { key: 'advance_percent', label: 'Max Advance', format: (v) => v !== null ? `${v}%` : '—' },
    { key: 'max_amount_financed', label: 'Max AF', format: (v) => v !== null ? `$${v.toLocaleString()}` : '—' },
    { key: 'required_cash_down', label: 'Req. Down', format: (v) => v !== null ? `$${v.toLocaleString()}` : '—' },
    { key: 'max_backend_amount', label: 'Max Backend', format: (v) => v !== null ? `$${v.toLocaleString()}` : '—' },
    { key: 'pti_cap_percent', label: 'PTI Cap', format: (v) => v !== null ? `${v}%` : '—' },
    { key: 'dti_cap_percent', label: 'DTI Cap', format: (v) => v !== null ? `${v}%` : '—' },
    { key: 'estimated_payment', label: 'Est. Payment', format: (v) => v !== null ? `$${v.toFixed(2)}/mo` : '—' },
    { key: 'estimated_ltv', label: 'Est. LTV', format: (v) => v !== null ? `${v.toFixed(1)}%` : '—' },
  ];

  // Identify the lowest-payment and best-LTV options for flagging
  const paymentOptions = options.filter((o) => o.estimated_payment !== null);
  const lowestPayment = paymentOptions.length
    ? Math.min(...paymentOptions.map((o) => o.estimated_payment))
    : null;

  return {
    options: options.map((opt) => ({
      ...opt,
      isLowestPayment: opt.estimated_payment === lowestPayment && lowestPayment !== null,
      explanation: explainCallbackOption(opt),
    })),
    metrics,
    summary: {
      optionCount: options.length,
      hasMultipleOptions: options.length > 1,
      lowestPayment,
    },
  };
}

// ── Recommendation Engine ──────────────────────────────────────────────────

/**
 * Rank callback options by the specified objective.
 * Does NOT make final decisions — produces an ordered list with rationale.
 *
 * @param {object[]} options   - Enriched callback options
 * @param {'payment'|'gross'|'approval'} objective
 * @param {object}   constraints  - { maxPayment, minGross, targetLtv }
 * @returns {{ ranked: object[], rationale: string }}
 */
export function rankCallbackOptions(options = [], objective = 'approval', constraints = {}) {
  if (!options.length) return { ranked: [], rationale: 'No options to rank.' };

  const scored = options.map((opt) => {
    let score = 0;

    if (objective === 'payment') {
      // Lower payment = better score
      if (opt.estimated_payment !== null) {
        score = 1000 - (opt.estimated_payment || 1000);
      }
    } else if (objective === 'gross') {
      // Higher backend allowed = better back gross potential
      score = (opt.max_backend_amount || 0) + (opt.max_backend_percent || 0) * 100;
    } else {
      // approval: lower estimated LTV + longer term = more approvable structure
      const ltvScore = opt.estimated_ltv !== null ? Math.max(0, 150 - opt.estimated_ltv) : 50;
      const termScore = opt.term_months || 0;
      score = ltvScore + termScore * 0.5;
    }

    // Penalize if stips are required (more friction)
    score -= (opt.stips_required?.length || 0) * 5;

    return { ...opt, _rankScore: score };
  });

  const ranked = scored
    .sort((a, b) => b._rankScore - a._rankScore)
    .map(({ _rankScore, ...opt }) => opt);

  const objectiveLabels = {
    payment: 'lowest customer payment',
    gross: 'maximum backend gross potential',
    approval: 'highest approval probability',
  };

  const rationale =
    `Options ranked by ${objectiveLabels[objective] || objective}. ` +
    `Option "${ranked[0]?.label}" scores highest under this objective. ` +
    `Review all options against the deal structure and customer situation before choosing. ` +
    `This ranking is an organizational aid — not a credit decision.`;

  return { ranked, rationale };
}
