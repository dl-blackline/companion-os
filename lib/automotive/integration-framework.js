/**
 * lib/automotive/integration-framework.js
 *
 * Inbound/outbound integration abstraction for the automotive finance manager.
 *
 * Supports:
 * - Inbound: webhook lead ingestion, payload normalization, duplicate detection
 * - Outbound: deal payload generation, field mapping, preflight validation, send logging
 *
 * Destinations: Dealertrack, RouteOne, CRM, DMS, custom webhooks
 * Sources: Same system types + lead providers
 *
 * No network calls are made here — all HTTP to external systems happens
 * in the Netlify function layer. This module exports pure transformers.
 */

// ── Source Type Registry ───────────────────────────────────────────────────

export const INTEGRATION_SOURCE_TYPES = Object.freeze({
  DEALERTRACK:    'dealertrack',
  ROUTEONE:       'routeone',
  CRM_WEBHOOK:    'crm_webhook',
  DMS_WEBHOOK:    'dms_webhook',
  LEAD_PROVIDER:  'lead_provider',
  CUSTOM_WEBHOOK: 'custom_webhook',
});

export const INTEGRATION_DESTINATION_TYPES = Object.freeze({
  DEALERTRACK:    'dealertrack',
  ROUTEONE:       'routeone',
  CRM:            'crm',
  DMS:            'dms',
  CUSTOM_WEBHOOK: 'custom_webhook',
});

// ── Standard Internal Field Map ────────────────────────────────────────────

/**
 * Canonical internal field names for a deal.
 * All inbound payloads are normalized to these names.
 */
export const INTERNAL_FIELD_MAP = Object.freeze({
  // Applicant
  APPLICANT_FIRST_NAME:    'applicant_first_name',
  APPLICANT_LAST_NAME:     'applicant_last_name',
  APPLICANT_DATE_OF_BIRTH: 'applicant_date_of_birth',
  APPLICANT_ADDRESS:       'applicant_address',
  APPLICANT_CITY:          'applicant_city',
  APPLICANT_STATE:         'applicant_state',
  APPLICANT_ZIP:           'applicant_zip',
  APPLICANT_PHONE:         'applicant_phone',
  APPLICANT_EMAIL:         'applicant_email',
  // Vehicle
  VEHICLE_VIN:             'vehicle_vin',
  VEHICLE_YEAR:            'vehicle_year',
  VEHICLE_MAKE:            'vehicle_make',
  VEHICLE_MODEL:           'vehicle_model',
  VEHICLE_MILEAGE:         'vehicle_mileage',
  VEHICLE_STOCK_NUMBER:    'vehicle_stock_number',
  VEHICLE_MSRP:            'vehicle_msrp',
  // Deal
  DEAL_TYPE:               'deal_type',
  SELLING_PRICE:           'selling_price',
  CASH_DOWN:               'cash_down',
  AMOUNT_FINANCED:         'amount_financed',
  TERM_MONTHS:             'term_months',
  APR_PERCENT:             'apr_percent',
  LEAD_SOURCE:             'lead_source',
  DEAL_STATUS:             'deal_status',
});

// ── Default Field Maps By Source Type ─────────────────────────────────────

/**
 * Default field mappings for known source types.
 * Keys are source field names, values are internal field names.
 * Users can override these in their integration source config.
 */
export const DEFAULT_SOURCE_FIELD_MAPS = Object.freeze({
  dealertrack: {
    'applicant.firstName':  INTERNAL_FIELD_MAP.APPLICANT_FIRST_NAME,
    'applicant.lastName':   INTERNAL_FIELD_MAP.APPLICANT_LAST_NAME,
    'applicant.dob':        INTERNAL_FIELD_MAP.APPLICANT_DATE_OF_BIRTH,
    'vehicle.vin':          INTERNAL_FIELD_MAP.VEHICLE_VIN,
    'vehicle.year':         INTERNAL_FIELD_MAP.VEHICLE_YEAR,
    'vehicle.make':         INTERNAL_FIELD_MAP.VEHICLE_MAKE,
    'vehicle.model':        INTERNAL_FIELD_MAP.VEHICLE_MODEL,
    'vehicle.mileage':      INTERNAL_FIELD_MAP.VEHICLE_MILEAGE,
    'deal.sellingPrice':    INTERNAL_FIELD_MAP.SELLING_PRICE,
    'deal.amountRequested': INTERNAL_FIELD_MAP.AMOUNT_FINANCED,
    'deal.term':            INTERNAL_FIELD_MAP.TERM_MONTHS,
  },

  routeone: {
    'Customer.FirstName':       INTERNAL_FIELD_MAP.APPLICANT_FIRST_NAME,
    'Customer.LastName':        INTERNAL_FIELD_MAP.APPLICANT_LAST_NAME,
    'Customer.DOB':             INTERNAL_FIELD_MAP.APPLICANT_DATE_OF_BIRTH,
    'Vehicle.VIN':              INTERNAL_FIELD_MAP.VEHICLE_VIN,
    'Vehicle.ModelYear':        INTERNAL_FIELD_MAP.VEHICLE_YEAR,
    'Vehicle.Make':             INTERNAL_FIELD_MAP.VEHICLE_MAKE,
    'Vehicle.Model':            INTERNAL_FIELD_MAP.VEHICLE_MODEL,
    'FinanceApplication.Price': INTERNAL_FIELD_MAP.SELLING_PRICE,
    'FinanceApplication.Term':  INTERNAL_FIELD_MAP.TERM_MONTHS,
  },

  crm_webhook: {
    'first_name':    INTERNAL_FIELD_MAP.APPLICANT_FIRST_NAME,
    'last_name':     INTERNAL_FIELD_MAP.APPLICANT_LAST_NAME,
    'dob':           INTERNAL_FIELD_MAP.APPLICANT_DATE_OF_BIRTH,
    'email':         INTERNAL_FIELD_MAP.APPLICANT_EMAIL,
    'phone':         INTERNAL_FIELD_MAP.APPLICANT_PHONE,
    'vin':           INTERNAL_FIELD_MAP.VEHICLE_VIN,
    'vehicle_year':  INTERNAL_FIELD_MAP.VEHICLE_YEAR,
    'vehicle_make':  INTERNAL_FIELD_MAP.VEHICLE_MAKE,
    'vehicle_model': INTERNAL_FIELD_MAP.VEHICLE_MODEL,
    'source':        INTERNAL_FIELD_MAP.LEAD_SOURCE,
  },
});

// ── Default Destination Field Maps ────────────────────────────────────────

/**
 * Default outbound field mappings.
 * Keys are internal field names, values are destination field paths.
 */
export const DEFAULT_DESTINATION_FIELD_MAPS = Object.freeze({
  dealertrack: {
    [INTERNAL_FIELD_MAP.APPLICANT_FIRST_NAME]: 'applicant.firstName',
    [INTERNAL_FIELD_MAP.APPLICANT_LAST_NAME]:  'applicant.lastName',
    [INTERNAL_FIELD_MAP.VEHICLE_VIN]:          'vehicle.vin',
    [INTERNAL_FIELD_MAP.VEHICLE_YEAR]:         'vehicle.year',
    [INTERNAL_FIELD_MAP.VEHICLE_MAKE]:         'vehicle.make',
    [INTERNAL_FIELD_MAP.VEHICLE_MODEL]:        'vehicle.model',
    [INTERNAL_FIELD_MAP.SELLING_PRICE]:        'deal.sellingPrice',
    [INTERNAL_FIELD_MAP.AMOUNT_FINANCED]:      'deal.amountRequested',
    [INTERNAL_FIELD_MAP.TERM_MONTHS]:          'deal.term',
    [INTERNAL_FIELD_MAP.APR_PERCENT]:          'deal.rate',
  },

  routeone: {
    [INTERNAL_FIELD_MAP.APPLICANT_FIRST_NAME]: 'Customer.FirstName',
    [INTERNAL_FIELD_MAP.APPLICANT_LAST_NAME]:  'Customer.LastName',
    [INTERNAL_FIELD_MAP.VEHICLE_VIN]:          'Vehicle.VIN',
    [INTERNAL_FIELD_MAP.VEHICLE_YEAR]:         'Vehicle.ModelYear',
    [INTERNAL_FIELD_MAP.VEHICLE_MAKE]:         'Vehicle.Make',
    [INTERNAL_FIELD_MAP.VEHICLE_MODEL]:        'Vehicle.Model',
    [INTERNAL_FIELD_MAP.SELLING_PRICE]:        'FinanceApplication.Price',
    [INTERNAL_FIELD_MAP.AMOUNT_FINANCED]:      'FinanceApplication.AmountRequested',
    [INTERNAL_FIELD_MAP.TERM_MONTHS]:          'FinanceApplication.Term',
    [INTERNAL_FIELD_MAP.APR_PERCENT]:          'FinanceApplication.Rate',
  },
});

// ── Field Value Extraction (nested path support) ───────────────────────────

/**
 * Get a value from a nested object using a dot-notation path.
 * Returns null if path is not found.
 *
 * @param {object} obj
 * @param {string} path  - e.g. 'applicant.firstName'
 * @returns {*}
 */
export function getNestedValue(obj, path) {
  if (!path || !obj) return null;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = current[part];
  }
  return current ?? null;
}

/**
 * Set a value in a nested object using a dot-notation path.
 * Creates intermediate objects as needed.
 *
 * @param {object} obj
 * @param {string} path
 * @param {*}      value
 * @returns {object} Modified obj (same reference)
 */
export function setNestedValue(obj, path, value) {
  if (!path) return obj;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
  return obj;
}

// ── Inbound Normalization ──────────────────────────────────────────────────

/**
 * Normalize an inbound payload from a source system to internal field names.
 * Returns a flat normalized object and preserves the original payload.
 *
 * @param {object} rawPayload    - Raw webhook/API payload
 * @param {string} sourceType    - INTEGRATION_SOURCE_TYPES key
 * @param {object} [customMap]   - User-configured field map (overrides default)
 * @returns {{ normalized: object, rawPayload: object, unmappedFields: string[] }}
 */
export function normalizeInboundPayload(rawPayload, sourceType, customMap = null) {
  const fieldMap = customMap || DEFAULT_SOURCE_FIELD_MAPS[sourceType] || {};
  const normalized = {};
  const mappedSourceKeys = new Set();

  for (const [sourcePath, internalKey] of Object.entries(fieldMap)) {
    const value = getNestedValue(rawPayload, sourcePath);
    if (value != null) {
      normalized[internalKey] = value;
      mappedSourceKeys.add(sourcePath.split('.')[0]);
    }
  }

  // Identify top-level keys in raw payload not covered by field map
  const topLevelSourceKeys = Object.keys(rawPayload);
  const unmappedFields = topLevelSourceKeys.filter(
    (k) => !Array.from(mappedSourceKeys).some((mk) => mk === k),
  );

  return { normalized, rawPayload, unmappedFields };
}

// ── Duplicate Detection ────────────────────────────────────────────────────

/**
 * Check if an inbound lead looks like a duplicate of an existing deal.
 * Comparison is field-based — exact or near-exact match on configured keys.
 *
 * @param {object}   normalizedPayload    - Normalized inbound lead
 * @param {object[]} existingDeals        - Existing deal records from DB
 * @param {string[]} checkFields          - Internal field names to compare
 * @returns {{ isDuplicate: boolean, matchingDealId: string|null, matchScore: number }}
 */
export function detectDuplicate(normalizedPayload, existingDeals = [], checkFields = ['vehicle_vin', 'applicant_last_name']) {
  for (const deal of existingDeals) {
    let matchCount = 0;
    let relevantFields = 0;

    for (const field of checkFields) {
      const incomingVal = normalizedPayload[field];
      const existingVal = deal[field];

      if (incomingVal == null && existingVal == null) continue;
      relevantFields++;

      if (
        incomingVal != null &&
        existingVal != null &&
        String(incomingVal).toLowerCase().trim() === String(existingVal).toLowerCase().trim()
      ) {
        matchCount++;
      }
    }

    const matchScore = relevantFields > 0 ? Math.round((matchCount / relevantFields) * 100) : 0;
    if (matchScore >= 80) {
      return { isDuplicate: true, matchingDealId: deal.id, matchScore };
    }
  }

  return { isDuplicate: false, matchingDealId: null, matchScore: 0 };
}

// ── Outbound Payload Generation ────────────────────────────────────────────

/**
 * Generate an outbound payload for a destination system from an internal deal record.
 * Applies field mapping and any transform rules.
 *
 * @param {object} deal             - Internal deal record (merged with applicant + vehicle + structure)
 * @param {string} destinationType  - INTEGRATION_DESTINATION_TYPES key
 * @param {object} [customMap]      - User-configured field map (overrides default)
 * @returns {{ payload: object, mappedFields: number, unmappedInternalKeys: string[] }}
 */
export function generateOutboundPayload(deal, destinationType, customMap = null) {
  const fieldMap = customMap || DEFAULT_DESTINATION_FIELD_MAPS[destinationType] || {};
  const payload = {};
  let mappedFields = 0;

  for (const [internalKey, destPath] of Object.entries(fieldMap)) {
    const value = deal[internalKey];
    if (value != null) {
      setNestedValue(payload, destPath, value);
      mappedFields++;
    }
  }

  // Track which internal keys were not mapped
  const allInternalKeys = Object.values(INTERNAL_FIELD_MAP);
  const coveredKeys = new Set(Object.keys(fieldMap));
  const unmappedInternalKeys = allInternalKeys.filter((k) => !coveredKeys.has(k) && deal[k] != null);

  return { payload, mappedFields, unmappedInternalKeys };
}

// ── Preflight Validation ───────────────────────────────────────────────────

/**
 * Validate an outbound payload before sending.
 * Returns errors that must be resolved and warnings for awareness.
 *
 * @param {object} payload          - Generated outbound payload
 * @param {string} destinationType
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
export function validateOutboundPayload(payload, destinationType) {
  const errors = [];
  const warnings = [];

  // Dealertrack and RouteOne require at minimum: applicant name + vehicle VIN
  if (['dealertrack', 'routeone'].includes(destinationType)) {
    const hasApplicantName =
      getNestedValue(payload, 'applicant.firstName') ||
      getNestedValue(payload, 'Customer.FirstName');
    const hasVin =
      getNestedValue(payload, 'vehicle.vin') ||
      getNestedValue(payload, 'Vehicle.VIN');

    if (!hasApplicantName) errors.push('Destination requires applicant first name.');
    if (!hasVin) errors.push('Destination requires vehicle VIN.');

    const price =
      getNestedValue(payload, 'deal.sellingPrice') ||
      getNestedValue(payload, 'FinanceApplication.Price');
    if (!price) warnings.push('Selling price not included in outbound payload.');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// ── Retry Configuration ────────────────────────────────────────────────────

/**
 * Get retry configuration for a destination type.
 * @param {string} destinationType
 * @returns {{ maxRetries: number, backoffSeconds: number, retryOnCodes: number[] }}
 */
export function getRetryConfig(destinationType) {
  const defaults = { maxRetries: 3, backoffSeconds: 30, retryOnCodes: [429, 500, 502, 503, 504] };

  const overrides = {
    dealertrack: { maxRetries: 5, backoffSeconds: 60, retryOnCodes: [429, 500, 502, 503, 504] },
    routeone:    { maxRetries: 5, backoffSeconds: 60, retryOnCodes: [429, 500, 502, 503, 504] },
  };

  return { ...defaults, ...(overrides[destinationType] || {}) };
}

// ── Integration Event Log Builder ──────────────────────────────────────────

/**
 * Build a structured audit log entry for an integration event.
 * Stored in automotive_integration_events.
 *
 * @param {object} params
 * @returns {object}
 */
export function buildIntegrationEventLog({
  userId,
  dealId = null,
  direction,
  sourceOrDestination,
  status,
  rawPayload,
  mappedPayload,
  errorMessage = null,
  retryCount = 0,
}) {
  return {
    user_id: userId,
    deal_id: dealId,
    direction,
    source_system: sourceOrDestination,
    status,
    payload_raw: rawPayload || {},
    payload_mapped: mappedPayload || {},
    error_message: errorMessage,
    retry_count: retryCount,
  };
}
