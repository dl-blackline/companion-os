/**
 * lib/automotive/document-intelligence.js
 *
 * Document classification, extraction routing, review logic, and scorecard.
 * Pure logic — no database access, no AI calls.
 *
 * The Netlify function layer handles AI calls and DB persistence.
 * This engine defines: schemas, prompts, mismatch rules, expiration logic,
 * completeness scoring, and review flag generation.
 */

// ── Document Type Registry ─────────────────────────────────────────────────

/**
 * All supported document types and their metadata.
 */
export const DOCUMENT_TYPES = Object.freeze({
  credit_bureau:       { label: 'Credit Bureau', category: 'credit',    expiresInDays: null },
  drivers_license:     { label: "Driver's License", category: 'identity', expiresInDays: null }, // expiry checked from field
  proof_of_residence:  { label: 'Proof of Residence', category: 'identity', expiresInDays: 90 },
  proof_of_income:     { label: 'Proof of Income', category: 'income',  expiresInDays: 60 },
  pay_stub:            { label: 'Pay Stub', category: 'income',         expiresInDays: 60 },
  bank_statement:      { label: 'Bank Statement', category: 'income',   expiresInDays: 90 },
  tax_return:          { label: 'Tax Return', category: 'income',       expiresInDays: 730 },
  insurance:           { label: 'Insurance Declaration', category: 'vehicle', expiresInDays: null }, // expiry from field
  reference:           { label: 'Character Reference', category: 'supplemental', expiresInDays: 90 },
  stipulation:         { label: 'Lender Stipulation', category: 'lender', expiresInDays: 30 },
  lender_requirement:  { label: 'Lender Requirement', category: 'lender', expiresInDays: 30 },
  callback_document:   { label: 'Callback Document', category: 'lender', expiresInDays: 14 },
  signed_menu:         { label: 'Signed F&I Menu', category: 'compliance', expiresInDays: null },
  cancellation_form:   { label: 'Cancellation Form', category: 'post_sale', expiresInDays: null },
  other:               { label: 'Other', category: 'general',           expiresInDays: null },
});

/**
 * Required documents per deal type (minimum completeness set).
 */
export const REQUIRED_DOCS_BY_DEAL_TYPE = Object.freeze({
  retail:     ['credit_bureau', 'drivers_license', 'proof_of_income', 'proof_of_residence'],
  lease:      ['credit_bureau', 'drivers_license', 'proof_of_income', 'proof_of_residence', 'insurance'],
  balloon:    ['credit_bureau', 'drivers_license', 'proof_of_income', 'proof_of_residence'],
  business:   ['credit_bureau', 'drivers_license', 'proof_of_income'],
  commercial: ['credit_bureau', 'drivers_license', 'proof_of_income'],
});

// ── Field Extraction Schemas ───────────────────────────────────────────────

/**
 * Expected extracted fields per document type.
 * Each field has: name, type, required, description.
 */
export const EXTRACTION_SCHEMAS = Object.freeze({
  drivers_license: [
    { name: 'full_name', type: 'string', required: true, description: 'Full legal name as printed' },
    { name: 'date_of_birth', type: 'date', required: true, description: 'Date of birth (YYYY-MM-DD)' },
    { name: 'license_number', type: 'string', required: true, description: 'License number' },
    { name: 'expiration_date', type: 'date', required: true, description: 'License expiration date' },
    { name: 'address', type: 'string', required: true, description: 'Full address on license' },
    { name: 'state_issued', type: 'string', required: true, description: '2-letter state code' },
  ],

  proof_of_residence: [
    { name: 'applicant_name', type: 'string', required: true, description: 'Name on document' },
    { name: 'address', type: 'string', required: true, description: 'Service/mailing address' },
    { name: 'document_date', type: 'date', required: true, description: 'Statement or utility date' },
    { name: 'issuing_entity', type: 'string', required: false, description: 'Bank or utility company name' },
  ],

  pay_stub: [
    { name: 'employee_name', type: 'string', required: true, description: 'Employee full name' },
    { name: 'employer_name', type: 'string', required: true, description: 'Employer / company name' },
    { name: 'pay_frequency', type: 'string', required: true, description: 'weekly | biweekly | semi_monthly | monthly' },
    { name: 'period_start_date', type: 'date', required: true, description: 'Pay period start' },
    { name: 'period_end_date', type: 'date', required: true, description: 'Pay period end' },
    { name: 'current_period_gross', type: 'number', required: true, description: "This period's gross earnings" },
    { name: 'ytd_gross_earnings', type: 'number', required: true, description: 'Year-to-date gross earnings' },
    { name: 'current_period_net', type: 'number', required: false, description: "This period's net pay" },
  ],

  bank_statement: [
    { name: 'account_holder_name', type: 'string', required: true, description: 'Account holder as printed' },
    { name: 'bank_name', type: 'string', required: true, description: 'Financial institution name' },
    { name: 'statement_period_start', type: 'date', required: true, description: 'Statement start date' },
    { name: 'statement_period_end', type: 'date', required: true, description: 'Statement end date' },
    { name: 'total_deposits', type: 'number', required: true, description: 'Total credits for the period' },
    { name: 'ending_balance', type: 'number', required: false, description: 'Ending account balance' },
    { name: 'large_one_time_deposits', type: 'number', required: false, description: 'Non-recurring large credits (tax refund, sale proceeds, etc.)' },
  ],

  insurance: [
    { name: 'insured_name', type: 'string', required: true, description: 'Named insured(s)' },
    { name: 'policy_number', type: 'string', required: true, description: 'Insurance policy number' },
    { name: 'effective_date', type: 'date', required: true, description: 'Policy effective date' },
    { name: 'expiration_date', type: 'date', required: true, description: 'Policy expiration date' },
    { name: 'coverage_type', type: 'string', required: false, description: 'Comprehensive / Collision / Liability' },
    { name: 'vehicle_vin', type: 'string', required: false, description: 'VIN of insured vehicle' },
    { name: 'insurer_name', type: 'string', required: false, description: 'Insurance company name' },
  ],

  credit_bureau: [
    { name: 'applicant_name', type: 'string', required: true, description: 'Applicant name on bureau' },
    { name: 'pull_date', type: 'date', required: true, description: 'Date bureau was pulled' },
    { name: 'fico_score', type: 'number', required: false, description: 'FICO or credit score' },
    { name: 'total_monthly_obligations', type: 'number', required: false, description: 'Sum of all reported monthly payments' },
    { name: 'derogatory_count', type: 'number', required: false, description: 'Number of derogatory marks' },
  ],

  tax_return: [
    { name: 'taxpayer_name', type: 'string', required: true, description: 'Taxpayer name' },
    { name: 'tax_year', type: 'number', required: true, description: 'Tax year filed' },
    { name: 'agi', type: 'number', required: true, description: 'Adjusted gross income' },
    { name: 'total_income', type: 'number', required: false, description: 'Total income before deductions' },
    { name: 'filing_status', type: 'string', required: false, description: 'Single / MFJ / MFS / HOH' },
  ],
});

// ── AI Extraction Prompt Builder ───────────────────────────────────────────

/**
 * Build an AI extraction prompt for a given document type and extracted text.
 * Used by the Netlify function to send to the AI client.
 *
 * @param {string} documentType   - Key from EXTRACTION_SCHEMAS
 * @param {string} documentText   - Extracted raw text from the document
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildExtractionPrompt(documentType, documentText) {
  const schema = EXTRACTION_SCHEMAS[documentType];
  const docMeta = DOCUMENT_TYPES[documentType];

  const systemPrompt =
    'You are a document field extractor for an automotive finance system. ' +
    'Extract ONLY the field values explicitly visible in the document text. ' +
    'Do not infer, guess, or fill in values not present in the text. ' +
    'If a field is not visible, return null for that field. ' +
    'Return valid JSON only — no markdown, no commentary.';

  const fieldList = schema
    ? schema.map((f) => `  "${f.name}" (${f.type}${f.required ? ', required' : ''}): ${f.description}`).join('\n')
    : '  (no schema defined for this document type — extract key fields you observe)';

  const userPrompt =
    `Document type: ${docMeta?.label || documentType}\n\n` +
    `Extract the following fields from the document:\n${fieldList}\n\n` +
    `DOCUMENT TEXT:\n${documentText.slice(0, 8000)}\n\n` +
    `Return a single flat JSON object with the field names as keys. ` +
    `Use null for any field not found. ` +
    `Dates should be in YYYY-MM-DD format. ` +
    `Numbers should be numeric (no currency symbols or commas).`;

  return { systemPrompt, userPrompt };
}

// ── Expiration Detection ───────────────────────────────────────────────────

/**
 * Determine if a document or specific field is expired or nearing expiration.
 *
 * @param {string}       documentType
 * @param {object}       extractedFields  - Field map (name → value)
 * @param {Date|string}  [nowDate]        - Reference date for comparison (defaults to now)
 * @returns {{ isExpired: boolean, isNearingExpiration: boolean, daysUntilExpiry: number|null, expirationField: string|null, flags: object[] }}
 */
export function detectExpiration(documentType, extractedFields = {}, nowDate = null) {
  const now = nowDate ? new Date(nowDate) : new Date();
  const flags = [];

  // Check document-level freshness (based on upload type default)
  const meta = DOCUMENT_TYPES[documentType];
  let isExpired = false;
  let isNearingExpiration = false;
  let daysUntilExpiry = null;
  let expirationField = null;

  // Field-specific expiration (license expiry, insurance expiry)
  const expiryFieldMap = {
    drivers_license: 'expiration_date',
    insurance: 'expiration_date',
  };

  const expiryKey = expiryFieldMap[documentType];
  if (expiryKey && extractedFields[expiryKey]) {
    const expiryDate = new Date(extractedFields[expiryKey]);
    if (!Number.isNaN(expiryDate.getTime())) {
      daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
      expirationField = expiryKey;
      if (daysUntilExpiry < 0) {
        isExpired = true;
        flags.push({ type: 'expiration', severity: 'critical', message: `${DOCUMENT_TYPES[documentType]?.label || documentType} expired ${Math.abs(daysUntilExpiry)} days ago.` });
      } else if (daysUntilExpiry < 30) {
        isNearingExpiration = true;
        flags.push({ type: 'expiration', severity: 'medium', message: `${DOCUMENT_TYPES[documentType]?.label || documentType} expires in ${daysUntilExpiry} days.` });
      }
    }
  }

  // Document-level staleness (POR, POI, pay stub, etc.)
  if (meta?.expiresInDays) {
    const documentDateKey = extractedFields.document_date || extractedFields.period_end_date || extractedFields.statement_period_end;
    if (documentDateKey) {
      const docDate = new Date(documentDateKey);
      if (!Number.isNaN(docDate.getTime())) {
        const daysSince = Math.floor((now - docDate) / (1000 * 60 * 60 * 24));
        if (daysSince > meta.expiresInDays) {
          isExpired = true;
          flags.push({ type: 'staleness', severity: 'high', message: `Document is ${daysSince} days old — lenders typically require within ${meta.expiresInDays} days.` });
        }
      }
    }
  }

  return { isExpired, isNearingExpiration, daysUntilExpiry, expirationField, flags };
}

// ── Mismatch Detection ─────────────────────────────────────────────────────

/**
 * Detect field mismatches between extracted document values and applicant record.
 * Returns flags for significant discrepancies. Does not determine fraud —
 * these are analytical observations for the F&I manager to review.
 *
 * @param {string} documentType
 * @param {object} extractedFields   - Fields extracted from document
 * @param {object} applicantRecord   - DB applicant record
 * @returns {{ mismatches: object[], flags: object[] }}
 */
export function detectMismatch(documentType, extractedFields = {}, applicantRecord = {}) {
  const mismatches = [];
  const flags = [];

  // Name matching (fuzzy — only flag if significantly different)
  const nameFields = ['full_name', 'employee_name', 'account_holder_name', 'applicant_name', 'insured_name', 'taxpayer_name'];
  const docName = nameFields.map((f) => extractedFields[f]).find(Boolean);
  const appName = applicantRecord.first_name && applicantRecord.last_name
    ? `${applicantRecord.first_name} ${applicantRecord.last_name}`.toLowerCase()
    : null;

  if (docName && appName) {
    const docNameNorm = docName.toLowerCase().replace(/[^a-z\s]/g, '');
    const appNameNorm = appName.replace(/[^a-z\s]/g, '');
    // Simple substring check — not character-perfect (handles middle name present/absent)
    const lastNameInDoc = applicantRecord.last_name?.toLowerCase() || '';
    if (lastNameInDoc && !docNameNorm.includes(lastNameInDoc)) {
      mismatches.push({ field: 'name', docValue: docName, recordValue: `${applicantRecord.first_name} ${applicantRecord.last_name}` });
      flags.push({ type: 'mismatch', severity: 'high', message: `Name on document "${docName}" does not match applicant name "${applicantRecord.first_name} ${applicantRecord.last_name}". Verify identity.` });
    }
  }

  // Address matching (POR)
  if (documentType === 'proof_of_residence' && extractedFields.address && applicantRecord.address_line_1) {
    const docAddr = extractedFields.address.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const appAddr = applicantRecord.address_line_1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (!docAddr.includes(appAddr.split(' ')[0])) { // Check first word of address (street number)
      mismatches.push({ field: 'address', docValue: extractedFields.address, recordValue: applicantRecord.address_line_1 });
      flags.push({ type: 'mismatch', severity: 'medium', message: `Address on POR "${extractedFields.address}" does not match application address "${applicantRecord.address_line_1}". Confirm correct address.` });
    }
  }

  // DOB matching (license)
  if (documentType === 'drivers_license' && extractedFields.date_of_birth && applicantRecord.date_of_birth) {
    const docDob = extractedFields.date_of_birth?.slice(0, 10);
    const appDob = applicantRecord.date_of_birth?.slice(0, 10);
    if (docDob && appDob && docDob !== appDob) {
      mismatches.push({ field: 'date_of_birth', docValue: docDob, recordValue: appDob });
      flags.push({ type: 'mismatch', severity: 'critical', message: `Date of birth on license (${docDob}) does not match application (${appDob}). Resolve before submission.` });
    }
  }

  return { mismatches, flags };
}

// ── Required Field Completeness ────────────────────────────────────────────

/**
 * Check which required fields are missing from an extraction result.
 *
 * @param {string}   documentType
 * @param {object}   extractedFields
 * @returns {{ missingRequired: string[], missingOptional: string[], completenessPercent: number, flags: object[] }}
 */
export function checkExtractionCompleteness(documentType, extractedFields = {}) {
  const schema = EXTRACTION_SCHEMAS[documentType] || [];
  const flags = [];

  const missingRequired = schema
    .filter((f) => f.required && (extractedFields[f.name] == null || extractedFields[f.name] === ''))
    .map((f) => f.name);

  const missingOptional = schema
    .filter((f) => !f.required && (extractedFields[f.name] == null || extractedFields[f.name] === ''))
    .map((f) => f.name);

  const total = schema.length;
  const filled = total - missingRequired.length - missingOptional.length;
  const completenessPercent = total > 0 ? Math.round((filled / total) * 100) : 100;

  if (missingRequired.length > 0) {
    flags.push({
      type: 'missing',
      severity: 'high',
      message: `Required fields not extracted: ${missingRequired.join(', ')}. Manual review or re-upload required.`,
    });
  }

  return { missingRequired, missingOptional, completenessPercent, flags };
}

// ── Document Completeness Scorecard ───────────────────────────────────────

/**
 * Build a deal-level document review scorecard.
 * Aggregates across all documents for the deal.
 *
 * @param {object[]} documents        - DB document rows
 * @param {string}   dealType         - 'retail' | 'lease' | 'balloon' | 'business' | 'commercial'
 * @param {object[]} openFlags        - Open review flags for the deal
 * @param {object[]} [incomeCalcs]    - Income calculations for confidence
 * @returns {object} Scorecard with overall score, coverage, gaps, and flags
 */
export function buildDocumentScorecard(documents = [], dealType = 'retail', openFlags = [], incomeCalcs = []) {
  const required = REQUIRED_DOCS_BY_DEAL_TYPE[dealType] || REQUIRED_DOCS_BY_DEAL_TYPE.retail;

  // Coverage check
  const presentTypes = new Set(documents.map((d) => d.document_type));
  const coveredRequired = required.filter((r) => presentTypes.has(r));
  const missingRequired = required.filter((r) => !presentTypes.has(r));
  const coveragePercent = Math.round((coveredRequired.length / required.length) * 100);

  // Freshness: docs not in needs_attention or rejected
  const cleanDocs = documents.filter((d) => !['rejected', 'needs_attention'].includes(d.review_status));
  const freshnessPercent = documents.length > 0
    ? Math.round((cleanDocs.length / documents.length) * 100)
    : 0;

  // Confidence from income calculations
  const incomeConfidence = incomeCalcs.length > 0
    ? Math.max(...incomeCalcs.map((c) => c.confidence_score || 0))
    : 0;

  // Open flag severity weighting
  const flagSeverityMap = { critical: 40, high: 20, medium: 10, low: 5 };
  const flagPressure = Math.min(100, openFlags.reduce((sum, f) => sum + (flagSeverityMap[f.severity] || 0), 0));

  // Overall score (0–100, higher = more review-ready)
  const overallScore = Math.round(
    coveragePercent * 0.40 +
    freshnessPercent * 0.25 +
    incomeConfidence * 0.20 +
    Math.max(0, 100 - flagPressure) * 0.15,
  );

  const readiness =
    overallScore >= 80 ? 'review_ready' :
    overallScore >= 60 ? 'partially_ready' :
    overallScore >= 40 ? 'incomplete' :
    'not_started';

  return {
    dealType,
    overallScore,
    readiness,
    coverage: {
      percent: coveragePercent,
      requiredCount: required.length,
      coveredCount: coveredRequired.length,
      missingRequired,
    },
    freshness: {
      percent: freshnessPercent,
      totalDocs: documents.length,
      cleanDocs: cleanDocs.length,
    },
    incomeConfidence,
    flagPressure,
    openFlagCount: openFlags.length,
    criticalFlagCount: openFlags.filter((f) => f.severity === 'critical').length,
    scoredAt: new Date().toISOString(),
  };
}

// ── Auto-Flag Generation ───────────────────────────────────────────────────

/**
 * Generate review flags for a document based on extraction + applicant match.
 * Called after extraction completes in the Netlify function.
 *
 * @param {string}   documentType
 * @param {object}   extractedFields
 * @param {object}   applicantRecord
 * @param {number}   confidenceScore    - 0–100 extraction confidence
 * @returns {object[]} Array of flag objects ready for INSERT into automotive_review_flags
 */
export function generateDocumentFlags(documentType, extractedFields, applicantRecord, confidenceScore = 0) {
  const allFlags = [];

  // Expiration flags
  const { flags: expirationFlags } = detectExpiration(documentType, extractedFields);
  allFlags.push(...expirationFlags);

  // Mismatch flags
  const { flags: mismatchFlags } = detectMismatch(documentType, extractedFields, applicantRecord);
  allFlags.push(...mismatchFlags);

  // Completeness flags
  const { flags: completenessFlags } = checkExtractionCompleteness(documentType, extractedFields);
  allFlags.push(...completenessFlags);

  // Low confidence flag
  if (confidenceScore > 0 && confidenceScore < 50) {
    allFlags.push({
      type: 'quality',
      severity: 'medium',
      message: `Document extraction confidence is low (${confidenceScore}%). Results may be inaccurate — manual review recommended.`,
    });
  }

  // Normalize to review_flag shape
  return allFlags.map((f) => ({
    category: f.type,
    severity: f.severity,
    status: 'open',
    message: f.message,
    recommended_action: null,
  }));
}
