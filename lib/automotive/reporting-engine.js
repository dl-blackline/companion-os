/**
 * lib/automotive/reporting-engine.js
 *
 * KPI and reporting aggregation engine.
 * Pure computation — no database access. All DB queries happen in the
 * Netlify function layer; this engine receives raw query results and
 * aggregates them into reporting structures.
 */

// ── Core KPI Calculations ──────────────────────────────────────────────────

/**
 * Per Vehicle Retail (PVR) — average back gross per funded unit.
 * Industry standard F&I performance metric.
 *
 * @param {number} totalBackGross    - Sum of all back gross across the period
 * @param {number} fundedUnits       - Number of funded deals
 * @returns {number}
 */
export function calculatePVR(totalBackGross, fundedUnits) {
  if (!fundedUnits || fundedUnits <= 0) return 0;
  return Math.round((totalBackGross / fundedUnits) * 100) / 100;
}

/**
 * Vehicle Product Index (VPI) — products sold per funded unit.
 * A VPI of 2.0 means an average of 2 F&I products per deal.
 *
 * @param {number} totalProductsSold
 * @param {number} fundedUnits
 * @returns {number}
 */
export function calculateVPI(totalProductsSold, fundedUnits) {
  if (!fundedUnits || fundedUnits <= 0) return 0;
  return Math.round((totalProductsSold / fundedUnits) * 100) / 100;
}

/**
 * Penetration rate for a product category.
 * What percent of funded deals included that product?
 *
 * @param {number} dealsWithProduct  - Funded deals that had this product
 * @param {number} totalFundedDeals
 * @returns {number} Percent (0–100)
 */
export function calculatePenetrationRate(dealsWithProduct, totalFundedDeals) {
  if (!totalFundedDeals || totalFundedDeals <= 0) return 0;
  return Math.round((dealsWithProduct / totalFundedDeals) * 10000) / 100;
}

/**
 * Cancellation rate for a product category.
 *
 * @param {number} cancelledUnits
 * @param {number} soldUnits
 * @returns {number} Percent (0–100)
 */
export function calculateCancellationRate(cancelledUnits, soldUnits) {
  if (!soldUnits || soldUnits <= 0) return 0;
  return Math.round((cancelledUnits / soldUnits) * 10000) / 100;
}

// ── Deal Pipeline Aggregation ──────────────────────────────────────────────

/**
 * Summarize deals by status for the pipeline view.
 *
 * @param {object[]} deals    - Deal records from DB
 * @returns {{ byStatus: object, total: number, activePipeline: number, terminalCount: number }}
 */
export function summarizePipeline(deals = []) {
  const byStatus = {};
  const activeStatuses = new Set([
    'lead_received', 'intake', 'docs_pending', 'docs_under_review', 'document_review',
    'structure_in_progress', 'structure_analysis', 'callback_received', 'callback_interpreted',
    'menu_ready', 'presented', 'submitted', 'booked', 'cit_hold', 'issue_open',
  ]);

  let activePipeline = 0;
  let terminalCount = 0;

  for (const deal of deals) {
    const status = deal.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    if (activeStatuses.has(status)) {
      activePipeline++;
    } else {
      terminalCount++;
    }
  }

  return {
    byStatus,
    total: deals.length,
    activePipeline,
    terminalCount,
  };
}

// ── Gross Aggregation ──────────────────────────────────────────────────────

/**
 * Aggregate front and back gross across a set of deals.
 * Requires deal metrics and deal structure data to be provided.
 *
 * @param {object[]} dealMetrics   - Rows from automotive_deal_metrics
 * @returns {{ totalFrontGross: number, totalBackGross: number, totalGross: number, avgFrontGross: number, avgBackGross: number, avgTotalGross: number }}
 */
export function aggregateGross(dealMetrics = []) {
  let totalFrontGross = 0;
  let totalBackGross = 0;

  for (const dm of dealMetrics) {
    totalFrontGross += dm.front_gross || 0;
    totalBackGross += dm.back_gross || 0;
  }

  const totalGross = totalFrontGross + totalBackGross;
  const count = dealMetrics.length;

  return {
    totalFrontGross: Math.round(totalFrontGross * 100) / 100,
    totalBackGross: Math.round(totalBackGross * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
    avgFrontGross: count > 0 ? Math.round((totalFrontGross / count) * 100) / 100 : 0,
    avgBackGross: count > 0 ? Math.round((totalBackGross / count) * 100) / 100 : 0,
    avgTotalGross: count > 0 ? Math.round((totalGross / count) * 100) / 100 : 0,
  };
}

// ── F&I Product Penetration ────────────────────────────────────────────────

/**
 * Calculate per-product and per-category penetration rates.
 *
 * @param {object[]} presentations   - Menu presentation rows
 * @param {number}   fundedUnits
 * @returns {{ byProduct: object, byCategory: object, totalProductsSold: number, vpi: number }}
 */
export function calculateProductPenetration(presentations = [], fundedUnits = 0) {
  const byProduct = {};
  const byCategory = {};
  let totalProductsSold = 0;

  for (const pres of presentations) {
    const menu = pres.menu_payload || {};
    const products = menu.selectedProducts || menu.products || [];

    for (const product of products) {
      const name = product.name || 'unknown';
      const category = product.category || 'general';

      byProduct[name] = (byProduct[name] || 0) + 1;
      byCategory[category] = (byCategory[category] || 0) + 1;
      totalProductsSold++;
    }
  }

  // Convert counts to penetration rates
  const productPenetration = {};
  for (const [name, count] of Object.entries(byProduct)) {
    productPenetration[name] = {
      count,
      penetrationRate: calculatePenetrationRate(count, fundedUnits),
    };
  }

  const categoryPenetration = {};
  for (const [cat, count] of Object.entries(byCategory)) {
    categoryPenetration[cat] = {
      count,
      penetrationRate: calculatePenetrationRate(count, fundedUnits),
    };
  }

  return {
    byProduct: productPenetration,
    byCategory: categoryPenetration,
    totalProductsSold,
    vpi: calculateVPI(totalProductsSold, fundedUnits),
  };
}

// ── CIT Aging ─────────────────────────────────────────────────────────────

/**
 * Summarize CIT case aging.
 *
 * @param {object[]} citCases    - Rows from automotive_cit_cases
 * @returns {{ open: number, resolved: number, avgDaysOpen: number, oldest: object|null, byStatus: object }}
 */
export function summarizeCitAging(citCases = []) {
  const openCases = citCases.filter((c) => !['archived', 'resolved'].includes(c.status));
  const resolvedCases = citCases.filter((c) => c.status === 'resolved');

  const byStatus = {};
  let totalDaysOpen = 0;
  let oldest = null;

  for (const c of openCases) {
    const status = c.status || 'open';
    byStatus[status] = (byStatus[status] || 0) + 1;

    const daysOpen = c.days_open || 0;
    totalDaysOpen += daysOpen;

    if (!oldest || daysOpen > (oldest.days_open || 0)) {
      oldest = c;
    }
  }

  return {
    open: openCases.length,
    resolved: resolvedCases.length,
    total: citCases.length,
    avgDaysOpen: openCases.length > 0 ? Math.round(totalDaysOpen / openCases.length) : 0,
    oldest: oldest
      ? { deal_id: oldest.deal_id, days_open: oldest.days_open || 0, status: oldest.status }
      : null,
    byStatus,
  };
}

// ── Cancellation Summary ───────────────────────────────────────────────────

/**
 * Summarize cancellation cases by product category.
 *
 * @param {object[]} cancellations   - Rows from automotive_cancellation_cases
 * @param {Map}      productMap      - Map of product_id → { name, category }
 * @returns {{ total: number, byStatus: object, byCategory: object, totalRefunds: number, totalChargebacks: number }}
 */
export function summarizeCancellations(cancellations = [], productMap = new Map()) {
  const byStatus = {};
  const byCategory = {};
  let totalRefunds = 0;
  let totalChargebacks = 0;

  for (const c of cancellations) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;

    const product = c.product_id ? productMap.get(c.product_id) : null;
    const category = product?.category || 'other';
    byCategory[category] = (byCategory[category] || 0) + 1;

    totalRefunds += c.refund_amount || 0;
    totalChargebacks += c.chargeback_amount || 0;
  }

  return {
    total: cancellations.length,
    byStatus,
    byCategory,
    totalRefunds: Math.round(totalRefunds * 100) / 100,
    totalChargebacks: Math.round(totalChargebacks * 100) / 100,
  };
}

// ── Commission Summary ─────────────────────────────────────────────────────

/**
 * Aggregate commission records for the reporting period.
 *
 * @param {object[]} commissions   - Rows from automotive_commission_records
 * @returns {{ totalEarned: number, totalPending: number, totalChargedBack: number, byType: object }}
 */
export function aggregateCommissions(commissions = []) {
  let totalEarned = 0;
  let totalPending = 0;
  let totalChargedBack = 0;
  const byType = {};

  for (const c of commissions) {
    const amount = c.amount || 0;
    const type = c.commission_type || 'other';

    byType[type] = (byType[type] || 0) + amount;

    if (c.status === 'paid') totalEarned += amount;
    else if (c.status === 'pending') totalPending += amount;
    else if (c.status === 'charged_back') totalChargedBack += amount;
  }

  return {
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalPending: Math.round(totalPending * 100) / 100,
    totalChargedBack: Math.round(totalChargedBack * 100) / 100,
    netCommissions: Math.round((totalEarned - totalChargedBack) * 100) / 100,
    byType: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, Math.round(v * 100) / 100]),
    ),
    count: commissions.length,
  };
}

// ── Full KPI Snapshot ──────────────────────────────────────────────────────

/**
 * Build a complete KPI snapshot from raw query results.
 * Called by the reporting Netlify function to produce a full report.
 *
 * @param {object} data
 * @param {object[]}  data.deals
 * @param {object[]}  data.dealMetrics
 * @param {object[]}  data.presentations
 * @param {object[]}  data.cancellations
 * @param {object[]}  data.citCases
 * @param {object[]}  data.commissions
 * @param {string}    data.periodStart    - ISO date string
 * @param {string}    data.periodEnd      - ISO date string
 * @param {Map}       [data.productMap]
 * @returns {object} Full KPI snapshot
 */
export function buildKpiSnapshot(data) {
  const {
    deals = [],
    dealMetrics = [],
    presentations = [],
    cancellations = [],
    citCases = [],
    commissions = [],
    periodStart,
    periodEnd,
    productMap = new Map(),
  } = data;

  const fundedDeals = deals.filter((d) => d.status === 'funded');
  const cancelledDeals = deals.filter((d) => d.status === 'cancelled');
  const bookedDeals = deals.filter((d) => ['funded', 'booked', 'cit_hold'].includes(d.status));

  const grossAgg = aggregateGross(dealMetrics);
  const pipeline = summarizePipeline(deals);
  const penetration = calculateProductPenetration(presentations, fundedDeals.length);
  const citSummary = summarizeCitAging(citCases);
  const cancellationSummary = summarizeCancellations(cancellations, productMap);
  const commissionSummary = aggregateCommissions(commissions);

  const pvr = calculatePVR(grossAgg.totalBackGross, fundedDeals.length);

  // Average LTV and PTI from funded deals
  const fundedMetrics = dealMetrics.filter((m) =>
    fundedDeals.some((d) => d.id === m.deal_id),
  );
  const avgLtv = fundedMetrics.length > 0
    ? Math.round(fundedMetrics.reduce((s, m) => s + (m.ltv_percent || 0), 0) / fundedMetrics.length * 100) / 100
    : 0;
  const avgPti = fundedMetrics.length > 0
    ? Math.round(fundedMetrics.reduce((s, m) => s + (m.pti_percent || 0), 0) / fundedMetrics.length * 100) / 100
    : 0;

  return {
    period: { start: periodStart, end: periodEnd },
    volume: {
      totalDeals: deals.length,
      fundedDeals: fundedDeals.length,
      bookedDeals: bookedDeals.length,
      cancelledDeals: cancelledDeals.length,
    },
    gross: grossAgg,
    pvr,
    vpi: penetration.vpi,
    penetration: penetration.byCategory,
    portfolio: {
      avgLtvPercent: avgLtv,
      avgPtiPercent: avgPti,
    },
    pipeline: pipeline.byStatus,
    cancellations: cancellationSummary,
    cit: citSummary,
    commissions: commissionSummary,
    computedAt: new Date().toISOString(),
  };
}
