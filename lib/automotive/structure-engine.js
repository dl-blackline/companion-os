/**
 * lib/automotive/structure-engine.js
 *
 * Deal structure math engine.
 * Pure calculation functions — no database access.
 * Supports: retail, lease, balloon, business/commercial.
 */

// ── Core Loan Math ─────────────────────────────────────────────────────────

/**
 * Standard loan payment — PMT formula.
 * PMT = P × r(1+r)^n / ((1+r)^n − 1)
 *
 * @param {number} principal    - Amount financed
 * @param {number} aprPercent   - Annual percentage rate (e.g. 7.99)
 * @param {number} termMonths   - Loan term in months
 * @returns {number} Monthly payment
 */
export function calculatePMT(principal, aprPercent, termMonths) {
  if (!principal || principal <= 0 || !termMonths || termMonths <= 0) return 0;
  const r = aprPercent / 100 / 12;
  if (r === 0) return Math.round((principal / termMonths) * 100) / 100;
  const factor = Math.pow(1 + r, termMonths);
  return Math.round(((principal * r * factor) / (factor - 1)) * 100) / 100;
}

/**
 * Balloon loan payment — standard PMT with future value offset.
 * Balloon amount is deferred to the final payment.
 *
 * @param {number} principal     - Amount financed
 * @param {number} aprPercent    - Annual percentage rate
 * @param {number} termMonths    - Payment term (not including balloon)
 * @param {number} balloonAmount - Lump-sum final payment
 * @returns {number} Regular monthly payment
 */
export function calculateBalloonPMT(principal, aprPercent, termMonths, balloonAmount) {
  if (!principal || principal <= 0 || !termMonths || termMonths <= 0) return 0;
  const r = aprPercent / 100 / 12;
  if (r === 0) return Math.round(((principal - balloonAmount) / termMonths) * 100) / 100;
  const factor = Math.pow(1 + r, termMonths);
  // Present value offset: discount balloon back to today
  const discountedBalloon = balloonAmount / factor;
  const adjustedPrincipal = principal - discountedBalloon;
  return Math.round(((adjustedPrincipal * r * factor) / (factor - 1)) * 100) / 100;
}

/**
 * Lease monthly payment (money factor / residual method).
 * Used by all US OEM captive lease programs.
 *
 * @param {object} params
 * @param {number} params.msrp               - MSRP (base for residual)
 * @param {number} params.capCost            - Gross capitalized cost (selling price)
 * @param {number} params.capCostReduction   - Cash down + rebates applied to cap cost
 * @param {number} params.residualPercent    - Residual as % of MSRP (e.g. 52.0)
 * @param {number} params.moneyFactor        - Money factor (APR / 2400)
 * @param {number} params.termMonths         - Lease term in months
 * @param {number} [params.acquisitionFee]   - Bank/captive acquisition fee
 * @returns {{ payment: number, adjustedCapCost: number, residualValue: number, rentCharge: number, depreciation: number }}
 */
export function calculateLeasePayment({
  msrp,
  capCost,
  capCostReduction = 0,
  residualPercent,
  moneyFactor,
  termMonths,
  acquisitionFee = 0,
}) {
  const adjustedCapCost = capCost - capCostReduction + acquisitionFee;
  const residualValue = msrp * (residualPercent / 100);
  const depreciation = (adjustedCapCost - residualValue) / termMonths;
  const rentCharge = (adjustedCapCost + residualValue) * moneyFactor;
  const payment = depreciation + rentCharge;

  return {
    payment: Math.max(0, Math.round(payment * 100) / 100),
    adjustedCapCost: Math.round(adjustedCapCost * 100) / 100,
    residualValue: Math.round(residualValue * 100) / 100,
    rentCharge: Math.round(rentCharge * 100) / 100,
    depreciation: Math.round(depreciation * 100) / 100,
  };
}

/**
 * Convert lease money factor to equivalent APR.
 * APR ≈ moneyFactor × 2400
 *
 * @param {number} moneyFactor
 * @returns {number} Equivalent APR percent
 */
export function moneyFactorToApr(moneyFactor) {
  return Math.round(moneyFactor * 2400 * 1000) / 1000;
}

/**
 * Convert APR to money factor.
 * @param {number} aprPercent
 * @returns {number}
 */
export function aprToMoneyFactor(aprPercent) {
  return Math.round((aprPercent / 2400) * 1000000) / 1000000;
}

// ── Amount Financed ────────────────────────────────────────────────────────

/**
 * Calculate amount financed for a retail/balloon/business deal.
 * Net trade is applied: allowance reduces financed amount, payoff increases it.
 *
 * @param {object} s - Structure fields
 * @returns {number}
 */
export function calculateAmountFinanced(s) {
  const base =
    (s.sellingPrice || 0) +
    (s.ttlFees || 0) +
    (s.backendTotal || 0) +
    (s.lenderFees || 0) +
    (s.tradePayoff || 0) -    // payoff adds to amount financed (negative equity)
    (s.cashDown || 0) -
    (s.rebates || 0) -
    (s.tradeAllowance || 0);  // allowance reduces amount financed
  return Math.max(0, Math.round(base * 100) / 100);
}

/**
 * Total cash due at signing (down payment + upfront fees not rolled in).
 * @param {object} s
 * @returns {number}
 */
export function calculateCashDue(s) {
  return Math.max(0, Math.round(((s.cashDown || 0) + (s.ttlFees || 0)) * 100) / 100);
}

// ── Ratio Metrics ──────────────────────────────────────────────────────────

/**
 * Loan-to-value ratio.
 * @param {number} amountFinanced
 * @param {number} collateralValue - ACV, NADA, KBB, or MMR value
 * @returns {number} LTV percent (e.g. 115.5)
 */
export function calculateLTV(amountFinanced, collateralValue) {
  if (!collateralValue || collateralValue <= 0) return 0;
  return Math.round((amountFinanced / collateralValue) * 10000) / 100;
}

/**
 * Payment-to-income ratio.
 * @param {number} monthlyPayment
 * @param {number} grossMonthlyIncome
 * @returns {number} PTI percent
 */
export function calculatePTI(monthlyPayment, grossMonthlyIncome) {
  if (!grossMonthlyIncome || grossMonthlyIncome <= 0) return 0;
  return Math.round((monthlyPayment / grossMonthlyIncome) * 10000) / 100;
}

/**
 * Debt-to-income ratio.
 * @param {number} monthlyPayment         - Proposed vehicle payment
 * @param {number} monthlyObligations     - Sum of all existing monthly debt payments
 * @param {number} grossMonthlyIncome
 * @returns {number} DTI percent
 */
export function calculateDTI(monthlyPayment, monthlyObligations, grossMonthlyIncome) {
  if (!grossMonthlyIncome || grossMonthlyIncome <= 0) return 0;
  return Math.round(((monthlyPayment + (monthlyObligations || 0)) / grossMonthlyIncome) * 10000) / 100;
}

/**
 * Backend load as a percent of amount financed.
 * Lenders frequently cap this (e.g. 25–30% of AF).
 * @param {number} backendTotal
 * @param {number} amountFinanced
 * @returns {number} Backend load percent
 */
export function calculateBackendLoad(backendTotal, amountFinanced) {
  if (!amountFinanced || amountFinanced <= 0) return 0;
  return Math.round((backendTotal / amountFinanced) * 10000) / 100;
}

// ── Gross ──────────────────────────────────────────────────────────────────

/**
 * Front gross (vehicle profitability before F&I).
 * @param {number} sellingPrice
 * @param {number} vehicleCost  - Dealer invoice or auction cost
 * @returns {number}
 */
export function calculateFrontGross(sellingPrice, vehicleCost) {
  return Math.round(((sellingPrice || 0) - (vehicleCost || 0)) * 100) / 100;
}

/**
 * Back gross from F&I products.
 * @param {{ sell_price: number, cost: number }[]} products
 * @returns {number}
 */
export function calculateBackGross(products = []) {
  return Math.round(
    products.reduce((sum, p) => sum + (p.sell_price || 0) - (p.cost || 0), 0) * 100,
  ) / 100;
}

// ── Reserve ────────────────────────────────────────────────────────────────

/**
 * Estimate dealer reserve from rate markup.
 * Approximates the present value of the spread between
 * the buy rate and the contract rate over the loan term.
 *
 * @param {number} amountFinanced
 * @param {number} buyRatePercent       - Rate the lender charges the dealer
 * @param {number} contractRatePercent  - Rate on the customer's contract
 * @param {number} termMonths
 * @returns {number} Estimated reserve income
 */
export function calculateReserve(amountFinanced, buyRatePercent, contractRatePercent, termMonths) {
  if (contractRatePercent <= buyRatePercent) return 0;
  const customerPayment = calculatePMT(amountFinanced, contractRatePercent, termMonths);
  const buyPayment = calculatePMT(amountFinanced, buyRatePercent, termMonths);
  const monthlyDiff = customerPayment - buyPayment;
  const r = buyRatePercent / 100 / 12;
  if (r === 0) return Math.round(monthlyDiff * termMonths * 100) / 100;
  const factor = Math.pow(1 + r, termMonths);
  return Math.round(((monthlyDiff * (factor - 1)) / (r * factor)) * 100) / 100;
}

// ── Payment Sensitivity ────────────────────────────────────────────────────

/**
 * Show payment impact across rate and term scenarios.
 * Useful for callback comparison and scenario planning.
 *
 * @param {number} amountFinanced
 * @param {number} baseAprPercent
 * @param {number} baseTerm
 * @returns {{ rateScenarios: object[], termScenarios: object[] }}
 */
export function calculatePaymentSensitivity(amountFinanced, baseAprPercent, baseTerm) {
  const rateDeltas = [-2, -1, 0, +1, +2];
  const allTerms = [24, 36, 48, 60, 72, 84];
  const termOptions = allTerms.filter((t) => Math.abs(t - baseTerm) <= 24);

  const rateScenarios = rateDeltas.map((delta) => {
    const apr = Math.max(0, baseAprPercent + delta);
    return {
      aprPercent: Math.round(apr * 100) / 100,
      delta,
      payment: calculatePMT(amountFinanced, apr, baseTerm),
    };
  });

  const termScenarios = termOptions.map((term) => ({
    termMonths: term,
    payment: calculatePMT(amountFinanced, baseAprPercent, term),
  }));

  return { rateScenarios, termScenarios };
}

// ── Full Structure Analysis ────────────────────────────────────────────────

/**
 * Run a complete deal structure analysis.
 * Accepts structure inputs + income + obligations.
 * Returns computed metrics, pressure scores, and advisory flags.
 *
 * @param {object}   structure       - Deal structure inputs
 * @param {object}   [income]        - { grossMonthly, netMonthly, confidence }
 * @param {object[]} [obligations]   - Array of { monthly_payment, is_paying_off }
 * @param {object}   [lenderCriteria] - { maxLtv, maxPti, maxDti, maxBackendPercent, maxTermMonths }
 * @returns {object} Full metrics and advisory flags
 */
export function analyzeStructure(structure, income = {}, obligations = [], lenderCriteria = {}) {
  const s = structure;
  const grossMonthly = income.grossMonthly || 0;

  // Resolve amount financed (use provided value if available, else compute)
  const amountFinanced =
    s.amountFinanced > 0 ? s.amountFinanced : calculateAmountFinanced(s);

  // Resolve payment based on deal type
  let payment = s.paymentEstimate || 0;
  let leaseDetails = null;

  if (!payment || payment <= 0) {
    if (s.dealType === 'lease') {
      leaseDetails = calculateLeasePayment({
        msrp: s.msrp || s.sellingPrice || 0,
        capCost: s.sellingPrice || 0,
        capCostReduction: (s.cashDown || 0) + (s.rebates || 0) + (s.capCostReduction || 0),
        residualPercent: s.residualPercent || 50,
        moneyFactor: s.moneyFactor || 0.0015,
        termMonths: s.termMonths || 36,
        acquisitionFee: s.acquisitionFee || 0,
      });
      payment = leaseDetails.payment;
    } else if (s.dealType === 'balloon') {
      payment = calculateBalloonPMT(
        amountFinanced,
        s.aprPercent || 0,
        s.termMonths || 72,
        s.balloonAmount || 0,
      );
    } else {
      payment = calculatePMT(amountFinanced, s.aprPercent || 0, s.termMonths || 72);
    }
  }

  // Active monthly obligations (exclude accounts being paid off at closing)
  const activeObligations = obligations.filter((o) => !o.is_paying_off);
  const monthlyObligations = activeObligations.reduce(
    (sum, o) => sum + (o.monthly_payment || 0),
    0,
  );

  // Core metrics
  const collateralValue = s.collateralValue || s.acv || 0;
  const ltv = calculateLTV(amountFinanced, collateralValue);
  const pti = calculatePTI(payment, grossMonthly);
  const dti = calculateDTI(payment, monthlyObligations, grossMonthly);
  const backendLoad = calculateBackendLoad(s.backendTotal || 0, amountFinanced);
  const cashDue = calculateCashDue(s);
  const sensitivity = calculatePaymentSensitivity(amountFinanced, s.aprPercent || 0, s.termMonths || 72);

  // Gross
  const frontGross = calculateFrontGross(s.sellingPrice || 0, s.vehicleCost || 0);

  // Lender criteria defaults (conservative industry norms if not provided)
  const {
    maxLtv = 125,
    maxPti = 20,
    maxDti = 50,
    maxBackendPercent = 30,
    maxTermMonths = 84,
  } = lenderCriteria;

  // Pressure scoring 0–100 (higher = more structural pressure)
  const ltvPressure = ltv > 0 ? Math.min(100, (ltv / maxLtv) * 100) : 0;
  const ptiPressure = pti > 0 && grossMonthly > 0 ? Math.min(100, (pti / maxPti) * 100) : 0;
  const dtiPressure = dti > 0 && grossMonthly > 0 ? Math.min(100, (dti / maxDti) * 100) : 0;
  const backendPressure = Math.min(100, (backendLoad / maxBackendPercent) * 100);
  const termPressure = (s.termMonths || 72) > maxTermMonths ? 20 : 0;

  const structurePressureScore = Math.round(
    ltvPressure * 0.40 +
    ptiPressure * 0.25 +
    dtiPressure * 0.20 +
    backendPressure * 0.10 +
    termPressure * 0.05,
  );

  // Approval readiness — inverse of pressure, modulated by income confidence
  const incomeConfidence = income.confidence !== null ? Math.min(1, income.confidence / 100) : 0.6;
  const approvalReadinessScore = Math.round(Math.max(0, 100 - structurePressureScore) * incomeConfidence);

  // Advisory flags (non-decisioning — for manager awareness)
  const flags = [];
  if (ltv > maxLtv) {
    flags.push({ metric: 'LTV', message: `LTV ${ltv.toFixed(1)}% exceeds ${maxLtv}% threshold`, severity: ltv > maxLtv + 10 ? 'high' : 'medium', source: 'structure_engine' });
  }
  if (pti > maxPti && grossMonthly > 0) {
    flags.push({ metric: 'PTI', message: `PTI ${pti.toFixed(1)}% may exceed lender PTI cap of ${maxPti}%`, severity: 'medium', source: 'structure_engine' });
  }
  if (dti > maxDti && grossMonthly > 0) {
    flags.push({ metric: 'DTI', message: `Estimated DTI ${dti.toFixed(1)}%. Verify against lender max.`, severity: 'medium', source: 'structure_engine' });
  }
  if (backendLoad > maxBackendPercent) {
    flags.push({ metric: 'Backend', message: `Backend load ${backendLoad.toFixed(1)}% may exceed lender cap of ${maxBackendPercent}%`, severity: 'low', source: 'structure_engine' });
  }
  if ((s.termMonths || 72) > maxTermMonths) {
    flags.push({ metric: 'Term', message: `Term ${s.termMonths} months exceeds max ${maxTermMonths} for this program`, severity: 'medium', source: 'structure_engine' });
  }
  if (amountFinanced > 0 && collateralValue === 0) {
    flags.push({ metric: 'Collateral', message: 'No collateral value entered — LTV cannot be calculated. Enter ACV, NADA, or KBB value.', severity: 'high', source: 'structure_engine' });
  }

  return {
    dealType: s.dealType || 'retail',
    amountFinanced,
    payment,
    cashDue,
    ltv,
    pti,
    dti,
    backendLoad,
    frontGross,
    monthlyObligations,
    sensitivity,
    leaseDetails,
    structurePressureScore,
    approvalReadinessScore,
    flags,
    lenderCriteriaUsed: { maxLtv, maxPti, maxDti, maxBackendPercent, maxTermMonths },
    calculatedAt: new Date().toISOString(),
  };
}

// ── Scenario Generation ────────────────────────────────────────────────────

/**
 * Generate alternative deal scenarios to hit a target payment,
 * reduce LTV, or improve overall approval readiness.
 *
 * @param {object}   structure
 * @param {object}   income
 * @param {object[]} obligations
 * @param {'payment'|'ltv'|'approval'} objective
 * @param {object}   constraints
 * @returns {{ current: object, scenarios: object[], recommendation: string }}
 */
export function generateScenarios(
  structure,
  income = {},
  obligations = [],
  objective = 'approval',
  constraints = {},
) {
  const current = analyzeStructure(structure, income, obligations, constraints);
  const scenarios = [];

  // Scenario 1: +$1,000 additional down payment
  const moreDown = { ...structure, cashDown: (structure.cashDown || 0) + 1000 };
  moreDown.amountFinanced = calculateAmountFinanced(moreDown);
  scenarios.push({
    label: '+$1,000 Down Payment',
    structure: moreDown,
    metrics: analyzeStructure(moreDown, income, obligations, constraints),
    tradeoffs: 'Reduces amount financed and improves LTV. Customer brings more cash.',
  });

  // Scenario 2: +12-month term (capped at 84)
  if ((structure.termMonths || 72) < 84) {
    const longerTerm = { ...structure, termMonths: Math.min((structure.termMonths || 72) + 12, 84) };
    scenarios.push({
      label: `${longerTerm.termMonths}-Month Term`,
      structure: longerTerm,
      metrics: analyzeStructure(longerTerm, income, obligations, constraints),
      tradeoffs: 'Lowers monthly payment at the cost of higher total interest. Check lender max term.',
    });
  }

  // Scenario 3: Remove all backend (shows clean AF impact)
  if ((structure.backendTotal || 0) > 0) {
    const noBackend = { ...structure, backendTotal: 0 };
    noBackend.amountFinanced = calculateAmountFinanced(noBackend);
    scenarios.push({
      label: 'No F&I Backend',
      structure: noBackend,
      metrics: analyzeStructure(noBackend, income, obligations, constraints),
      tradeoffs: 'Lower LTV and payment. Eliminates back gross contribution.',
    });
  }

  // Scenario 4: Shorter term (equity-building for high-LTV)
  if (objective === 'ltv' && (structure.termMonths || 72) > 48) {
    const shorterTerm = { ...structure, termMonths: 48 };
    scenarios.push({
      label: '48-Month Term',
      structure: shorterTerm,
      metrics: analyzeStructure(shorterTerm, income, obligations, constraints),
      tradeoffs: 'Higher payment, but builds equity faster. May reduce LTV concern over term.',
    });
  }

  // Advisory recommendation (non-decisioning language)
  let recommendation = '';
  if (current.structurePressureScore > 70) {
    recommendation = 'Structure pressure is elevated. Consider increasing cash down or reducing backend before submission. Verify specific lender thresholds via callback.';
  } else if (current.structurePressureScore > 40) {
    recommendation = 'Structure is within moderate range. Review PTI and LTV against specific lender program criteria before submitting.';
  } else {
    recommendation = 'Structure appears within normal parameters for standard programs. Confirm with lender or callback before presenting.';
  }

  recommendation += ' All figures are estimates for planning purposes — not a credit decision.';

  return { current, scenarios, recommendation };
}
