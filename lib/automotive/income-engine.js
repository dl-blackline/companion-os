/**
 * lib/automotive/income-engine.js
 *
 * Income calculation and normalization engine.
 * Pure calculation — no database access.
 * Supports: pay stubs, bank statements, employer letters, manual entry,
 *           multiple frequencies, multi-source combination, variance analysis.
 */

// ── Frequency Normalization ────────────────────────────────────────────────

/**
 * Monthly multipliers for each pay frequency.
 * null = cannot auto-normalize; requires manual input.
 */
export const INCOME_FREQUENCIES = Object.freeze({
  weekly:       52 / 12,   // 4.3333...
  biweekly:     26 / 12,   // 2.1666...
  semi_monthly: 2,
  monthly:      1,
  quarterly:    1 / 3,
  annual:       1 / 12,
  irregular:    null,
});

/**
 * Normalize a pay period amount to estimated gross monthly income.
 *
 * @param {number} amount      - Amount per pay period
 * @param {string} frequency   - Key from INCOME_FREQUENCIES
 * @returns {{ grossMonthly: number, multiplier: number|null, isEstimate: boolean, warning?: string }}
 */
export function normalizeToMonthly(amount, frequency) {
  const multiplier = INCOME_FREQUENCIES[frequency];

  if (multiplier === null) {
    return {
      grossMonthly: 0,
      multiplier: null,
      isEstimate: true,
      warning: 'Irregular income cannot be automatically normalized. Manually enter the estimated monthly gross.',
    };
  }

  return {
    grossMonthly: Math.round(amount * multiplier * 100) / 100,
    multiplier,
    isEstimate: frequency !== 'monthly',
  };
}

/**
 * Annualize a monthly gross income figure.
 * @param {number} grossMonthly
 * @returns {number}
 */
export function annualizeIncome(grossMonthly) {
  return Math.round((grossMonthly || 0) * 12 * 100) / 100;
}

// ── Pay Stub Analysis ──────────────────────────────────────────────────────

/**
 * Derive gross monthly income from pay stub extracted data.
 * Prefers YTD averaging when enough history is available.
 *
 * @param {object} stub
 * @param {number}          stub.ytdGrossEarnings      - Year-to-date gross
 * @param {number}          [stub.currentPeriodGross]  - Current period gross
 * @param {string}          stub.payFrequency          - INCOME_FREQUENCIES key
 * @param {string|Date}     stub.periodEndDate         - End date of the pay period
 * @returns {{ grossMonthly: number, method: string, confidence: number, notes: string[], annualized: number }}
 */
export function calculateFromPayStub(stub) {
  const notes = [];
  let grossMonthly = 0;
  let confidence = 0;
  let method = 'unavailable';

  const periodEnd = stub.periodEndDate ? new Date(stub.periodEndDate) : new Date();

  // YTD average — preferred when at least 3 months of data exist
  if (stub.ytdGrossEarnings > 0) {
    const currentMonth = periodEnd.getMonth() + 1; // 1-indexed
    if (currentMonth >= 3) {
      grossMonthly = stub.ytdGrossEarnings / currentMonth;
      method = 'ytd_average';
      confidence = currentMonth >= 6 ? 85 : 70;
      notes.push(`YTD gross of $${stub.ytdGrossEarnings.toLocaleString()} averaged over ${currentMonth} months.`);
    }
  }

  // Fallback: normalize current-period pay
  if (grossMonthly === 0 && stub.currentPeriodGross > 0 && stub.payFrequency) {
    const result = normalizeToMonthly(stub.currentPeriodGross, stub.payFrequency);
    if (result.grossMonthly > 0) {
      grossMonthly = result.grossMonthly;
      method = 'period_normalized';
      confidence = 60;
      notes.push(`Single pay period of $${stub.currentPeriodGross.toLocaleString()} normalized from ${stub.payFrequency} frequency.`);
      if (result.warning) notes.push(result.warning);
    }
  }

  // Freshness check
  const now = new Date();
  const daysSincePeriodEnd = Math.floor((now - periodEnd) / (1000 * 60 * 60 * 24));
  if (daysSincePeriodEnd > 90) {
    confidence = Math.max(0, confidence - 20);
    notes.push(`Pay stub is ${daysSincePeriodEnd} days old. Lenders typically require stubs within 30–60 days.`);
  }

  return {
    grossMonthly: Math.round(grossMonthly * 100) / 100,
    method,
    confidence,
    notes,
    annualized: annualizeIncome(grossMonthly),
  };
}

// ── Bank Statement Analysis ────────────────────────────────────────────────

/**
 * Estimate usable income from bank statement deposit history.
 * Removes outlier months and large one-time deposits before averaging.
 *
 * @param {object[]} months  - Monthly deposit summaries
 * @param {string}   months[].month                - 'YYYY-MM' label
 * @param {number}   months[].totalDeposits        - All credits that month
 * @param {number}   months[].largeOneTimeDeposits - Non-recurring credits to exclude
 * @returns {{ grossMonthly: number, method: string, confidence: number, notes: string[], annualized: number }}
 */
export function calculateFromBankStatements(months = []) {
  const notes = [];

  if (!months.length) {
    return {
      grossMonthly: 0,
      method: 'bank_statement',
      confidence: 0,
      notes: ['No bank statement data provided.'],
      annualized: 0,
    };
  }

  // Net out large one-time items
  const regularDeposits = months.map((m) =>
    Math.max(0, (m.totalDeposits || 0) - (m.largeOneTimeDeposits || 0)),
  );

  // Remove highest and lowest month if 4+ months available (outlier trimming)
  let working = [...regularDeposits].sort((a, b) => a - b);
  if (working.length >= 4) {
    working = working.slice(1, -1);
    notes.push('Highest and lowest months removed to reduce outlier impact.');
  }

  const avg = working.reduce((s, v) => s + v, 0) / working.length;

  // Confidence scales with months of history (capped at 80%)
  const confidence = Math.min(80, 30 + months.length * 8);

  notes.push(`Average of ${working.length} month(s) of deposit history used.`);
  notes.push(
    'Bank deposit averaging is an estimate. It may not reflect gross income before taxes or deductions. ' +
    'Lenders may apply additional discounts to bank-statement income.',
  );

  return {
    grossMonthly: Math.round(avg * 100) / 100,
    method: 'bank_statement',
    confidence,
    notes,
    annualized: annualizeIncome(avg),
  };
}

// ── Multi-Source Income Combination ───────────────────────────────────────

/**
 * Combine income from multiple sources (primary employment + side income + rental, etc.).
 * Returns a weighted-confidence combined estimate.
 *
 * @param {{ source: string, grossMonthly: number, confidence: number, isVerified?: boolean }[]} sources
 * @returns {{ combinedGrossMonthly: number, weightedConfidence: number, sources: object[], notes: string[], annualized: number }}
 */
export function combineIncomeSources(sources = []) {
  const notes = [];

  if (!sources.length) {
    return {
      combinedGrossMonthly: 0,
      weightedConfidence: 0,
      sources: [],
      notes: ['No income sources provided.'],
      annualized: 0,
    };
  }

  let totalGross = 0;
  let weightedSum = 0;

  for (const src of sources) {
    const gross = src.grossMonthly || 0;
    const confidence = src.confidence || 50;
    totalGross += gross;
    weightedSum += confidence * gross;
  }

  const weightedConfidence = totalGross > 0 ? Math.round(weightedSum / totalGross) : 0;

  if (sources.length > 1) {
    notes.push(
      `Combined ${sources.length} income sources. Lenders may or may not accept all sources depending on program criteria and verification requirements.`,
    );
  }

  const hasUnverified = sources.some((s) => !s.isVerified);
  if (hasUnverified) {
    notes.push('One or more income sources are not document-verified. Confidence is reduced accordingly.');
  }

  return {
    combinedGrossMonthly: Math.round(totalGross * 100) / 100,
    weightedConfidence,
    sources,
    notes,
    annualized: annualizeIncome(totalGross),
  };
}

// ── Variance Analysis ──────────────────────────────────────────────────────

/**
 * Compare declared (application) income vs. document-supported income.
 * Returns a severity rating and plain-English explanation.
 * Does NOT make a compliance determination — this is informational.
 *
 * @param {number} declaredMonthly    - Stated on credit application
 * @param {number} supportedMonthly   - Derived from documents
 * @returns {{ variance: number, variancePercent: number, severity: string, explanation: string }}
 */
export function analyzeIncomeVariance(declaredMonthly, supportedMonthly) {
  if (!declaredMonthly && !supportedMonthly) {
    return { variance: 0, variancePercent: 0, severity: 'unknown', explanation: 'No income data available to compare.' };
  }

  if (!supportedMonthly) {
    return { variance: 0, variancePercent: 0, severity: 'unverified', explanation: 'No document-supported income yet. Cannot compare to stated income.' };
  }

  if (!declaredMonthly) {
    return { variance: 0, variancePercent: 0, severity: 'no_declaration', explanation: 'No declared income on file. Document-supported amount is the only reference.' };
  }

  const variance = declaredMonthly - supportedMonthly;
  const variancePercent = (Math.abs(variance) / declaredMonthly) * 100;

  let severity;
  let explanation;

  if (variancePercent <= 5) {
    severity = 'minimal';
    explanation = `Stated income ($${declaredMonthly.toFixed(0)}/mo) closely matches document-supported income ($${supportedMonthly.toFixed(0)}/mo — within 5%).`;
  } else if (variancePercent <= 15) {
    severity = 'moderate';
    explanation = `Stated income is ${variancePercent.toFixed(1)}% above document-supported income. Declared: $${declaredMonthly.toFixed(0)}/mo. Supported: $${supportedMonthly.toFixed(0)}/mo. Investigate the difference — timing, deductions, or additional source.`;
  } else if (variancePercent <= 30) {
    severity = 'significant';
    explanation = `Significant variance (${variancePercent.toFixed(1)}%) between stated and document income. Declared: $${declaredMonthly.toFixed(0)}/mo. Supported: $${supportedMonthly.toFixed(0)}/mo. Additional documentation recommended before relying on stated income for structure.`;
  } else {
    severity = 'critical';
    explanation = `Critical income variance of ${variancePercent.toFixed(1)}%. Documents do not reasonably support the stated income. Do not use stated figure without resolution and additional verification.`;
  }

  return {
    variance: Math.round(variance * 100) / 100,
    variancePercent: Math.round(variancePercent * 100) / 100,
    severity,
    explanation,
  };
}

// ── Income Profile ─────────────────────────────────────────────────────────

/**
 * Build a complete income profile for a deal.
 * Consolidates declared, document-supported, and approved working income.
 *
 * @param {{ monthlyGross: number, monthlyNet: number }} declared         - From applicant record
 * @param {object[]}                                    calculations     - DB income_calculation rows
 * @param {object|null}                                 [activeCalc]     - The approved working calc
 * @returns {object} Full income profile
 */
export function buildIncomeProfile(declared = {}, calculations = [], activeCalc = null) {
  const calc = activeCalc || (calculations.length ? calculations[calculations.length - 1] : null);
  const supportedGross = calc?.gross_monthly_income ?? null;
  const declaredGross = declared.monthlyGross ?? 0;

  const variance = declaredGross && supportedGross !== null
    ? analyzeIncomeVariance(declaredGross, supportedGross)
    : null;

  return {
    declared: {
      monthlyGross: declaredGross,
      monthlyNet: declared.monthlyNet ?? 0,
    },
    documentSupported: {
      monthlyGross: supportedGross ?? 0,
      confidence: calc?.confidence_score ?? 0,
      method: calc?.method ?? 'not_available',
      sourceDocumentIds: calc?.source_document_ids ?? [],
      isManualOverride: calc?.is_manual_override ?? false,
      overrideNote: calc?.override_note ?? null,
    },
    approvedWorkingIncome: {
      monthlyGross: supportedGross ?? declaredGross,
      basis: calc?.is_manual_override ? 'manual_override' : (calc ? 'document' : 'declared_only'),
    },
    variance,
    calculationHistory: calculations.length,
    annualized: annualizeIncome(supportedGross ?? declaredGross),
  };
}

// ── Obligation Aggregation ─────────────────────────────────────────────────

/**
 * Aggregate monthly obligations for DTI calculation.
 * Handles pay-offs correctly (excluded from active monthly burden).
 *
 * @param {object[]} obligations - DB obligation rows
 * @returns {{ totalMonthly: number, activeMonthly: number, payingOffMonthly: number, byType: object }}
 */
export function aggregateObligations(obligations = []) {
  let totalMonthly = 0;
  let activeMonthly = 0;
  let payingOffMonthly = 0;
  const byType = {};

  for (const ob of obligations) {
    const payment = ob.monthly_payment || 0;
    totalMonthly += payment;

    if (!byType[ob.obligation_type]) byType[ob.obligation_type] = 0;
    byType[ob.obligation_type] += payment;

    if (ob.is_paying_off) {
      payingOffMonthly += payment;
    } else {
      activeMonthly += payment;
    }
  }

  return {
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    activeMonthly: Math.round(activeMonthly * 100) / 100,
    payingOffMonthly: Math.round(payingOffMonthly * 100) / 100,
    byType,
    count: obligations.length,
  };
}
