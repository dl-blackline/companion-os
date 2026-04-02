/**
 * Bill Decoder — Premium bill decoding, review, and ecosystem integration.
 *
 * POST actions:
 *   decode_document  — Run enhanced extraction on a financial_documents record → decoded_bill
 *   confirm_bill     — Confirm a decoded bill and optionally create/link obligation
 *   reject_bill      — Reject a decoded bill
 *   update_bill_field— User edits a specific field (confirmed override)
 *   merge_to_obligation — Link decoded bill to an existing obligation
 *
 * GET — Returns all decoded bills for the user with review status.
 */

import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { analyzeImage } from '../../lib/vision-analyzer.js';
import { generateChatCompletion } from '../../lib/openai-client.js';

const STORAGE_BUCKET = 'financial_documents';

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function cleanJson(rawText) {
  return rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function clampConfidence(v) {
  return Math.max(0, Math.min(1, toNumber(v)));
}

// ── Document text extraction (shared with financial-intelligence) ───────────

async function readStorageBytes(storagePath) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) throw new Error('Failed to read document from storage.');
  if (typeof data.arrayBuffer === 'function') {
    return Buffer.from(await data.arrayBuffer());
  }
  return Buffer.from(data);
}

async function extractDocumentText({ storagePath, mimeType }) {
  const bytes = await readStorageBytes(storagePath);

  if ((mimeType || '').includes('pdf')) {
    const parsed = await pdfParse(bytes);
    return parsed?.text || '';
  }

  if ((mimeType || '').startsWith('image/')) {
    const signed = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 600);
    if (!signed.data?.signedUrl) throw new Error('Unable to create secure URL for image.');
    const analysis = await analyzeImage({
      image_url: signed.data.signedUrl,
      prompt: 'Extract every piece of financial text visible: provider name, account numbers, billing period, issue date, due date, total due, minimum due, current balance, statement balance, past due amount, late fees, credit limit, autopay indicators, and any recurring obligation hints.',
      model: 'gpt-4.1',
    });
    return analysis || '';
  }

  return bytes.toString('utf8');
}

// ── Enhanced bill extraction prompt ─────────────────────────────────────────

async function decodeDocumentToBill({ sourceType, filename, rawText }) {
  const prompt = {
    system: `You are a premium financial document decoder.
Extract every available field from the document. Return ONLY valid JSON with this schema:
{
  "billType": "credit_card|utility|insurance|loan|phone_internet|rent_mortgage|medical|subscription|other",
  "providerName": "string|null",
  "accountName": "string|null",
  "maskedAccountNumber": "string|null",
  "billingPeriodStart": "YYYY-MM-DD|null",
  "billingPeriodEnd": "YYYY-MM-DD|null",
  "issueDate": "YYYY-MM-DD|null",
  "dueDate": "YYYY-MM-DD|null",
  "totalDue": 0,
  "minimumDue": 0,
  "currentBalance": 0,
  "statementBalance": 0,
  "pastDueAmount": 0,
  "lateFee": 0,
  "creditLimit": 0,
  "autopayDetected": false,
  "isRecurringCandidate": false,
  "extractionConfidence": 0.0,
  "fieldConfidence": {
    "providerName": 0.0,
    "totalDue": 0.0,
    "dueDate": 0.0,
    "minimumDue": 0.0,
    "currentBalance": 0.0,
    "statementBalance": 0.0,
    "creditLimit": 0.0,
    "autopayDetected": 0.0
  },
  "notes": "string|null"
}
Rules:
- Use null for unknown text fields, 0 for unknown numeric fields.
- fieldConfidence should reflect how certain each value is (0.0–1.0).
- Classify billType based on document content, not just the user-provided source type.
- isRecurringCandidate should be true if the document contains hints of recurring charges.
- Do not invent data. Only extract what is evidenced in the text.
- extractionConfidence is overall confidence across all fields.`,
    user: `Source type hint: ${sourceType}\nFilename: ${filename}\n\nDocument text:\n${rawText.slice(0, 24000)}`,
  };

  const raw = await generateChatCompletion(prompt, 'gpt-4.1-mini', 0.1);
  const parsed = JSON.parse(cleanJson(raw));

  const VALID_TYPES = ['credit_card', 'utility', 'insurance', 'loan', 'phone_internet', 'rent_mortgage', 'medical', 'subscription', 'other'];
  const billType = VALID_TYPES.includes(parsed.billType) ? parsed.billType : 'other';

  const fieldConfidence = {};
  if (parsed.fieldConfidence && typeof parsed.fieldConfidence === 'object') {
    for (const [k, v] of Object.entries(parsed.fieldConfidence)) {
      fieldConfidence[k] = clampConfidence(v);
    }
  }

  return {
    billType,
    providerName: parsed.providerName || null,
    accountName: parsed.accountName || null,
    maskedAccountNumber: parsed.maskedAccountNumber || null,
    billingPeriodStart: parseDate(parsed.billingPeriodStart),
    billingPeriodEnd: parseDate(parsed.billingPeriodEnd),
    issueDate: parseDate(parsed.issueDate),
    dueDate: parseDate(parsed.dueDate),
    totalDue: toNumber(parsed.totalDue),
    minimumDue: toNumber(parsed.minimumDue),
    currentBalance: toNumber(parsed.currentBalance),
    statementBalance: toNumber(parsed.statementBalance),
    pastDueAmount: toNumber(parsed.pastDueAmount),
    lateFee: toNumber(parsed.lateFee),
    creditLimit: toNumber(parsed.creditLimit),
    autopayDetected: Boolean(parsed.autopayDetected),
    isRecurringCandidate: Boolean(parsed.isRecurringCandidate),
    extractionConfidence: clampConfidence(parsed.extractionConfidence),
    fieldConfidence,
    notes: parsed.notes || null,
  };
}

// ── Actions ────────────────────────────────────────────────────────────────

async function handleDecodeDocument({ user, body }) {
  const documentId = body?.documentId;
  if (!documentId) return fail('documentId is required.', 'ERR_VALIDATION', 400);

  // Fetch the source document
  const { data: doc, error: docErr } = await supabase
    .from('financial_documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docErr || !doc) return fail('Document not found.', 'ERR_NOT_FOUND', 404);

  try {
    const rawText = await extractDocumentText({
      storagePath: doc.storage_path,
      mimeType: doc.mime_type,
    });

    const decoded = await decodeDocumentToBill({
      sourceType: doc.source_type,
      filename: doc.filename,
      rawText,
    });

    const { data: bill, error: billErr } = await supabase
      .from('decoded_bills')
      .insert({
        user_id: user.id,
        document_id: doc.id,
        extraction_id: null,
        bill_type: decoded.billType,
        provider_name: decoded.providerName,
        account_name: decoded.accountName,
        masked_account_number: decoded.maskedAccountNumber,
        billing_period_start: decoded.billingPeriodStart,
        billing_period_end: decoded.billingPeriodEnd,
        issue_date: decoded.issueDate,
        due_date: decoded.dueDate,
        total_due: decoded.totalDue,
        minimum_due: decoded.minimumDue,
        current_balance: decoded.currentBalance,
        statement_balance: decoded.statementBalance,
        past_due_amount: decoded.pastDueAmount,
        late_fee: decoded.lateFee,
        credit_limit: decoded.creditLimit,
        autopay_detected: decoded.autopayDetected,
        is_recurring_candidate: decoded.isRecurringCandidate,
        extraction_confidence: decoded.extractionConfidence,
        field_confidence: decoded.fieldConfidence,
        review_status: 'pending_review',
        decoded_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (billErr || !bill) throw new Error('Failed to save decoded bill.');

    return ok({ bill, notes: decoded.notes });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Bill decoding failed.', 'ERR_DECODE', 500);
  }
}

async function handleConfirmBill({ user, body }) {
  const billId = body?.billId;
  if (!billId) return fail('billId is required.', 'ERR_VALIDATION', 400);

  const { data: bill, error: billErr } = await supabase
    .from('decoded_bills')
    .select('*')
    .eq('id', billId)
    .eq('user_id', user.id)
    .single();

  if (billErr || !bill) return fail('Bill not found.', 'ERR_NOT_FOUND', 404);

  // Update bill status
  await supabase
    .from('decoded_bills')
    .update({ review_status: 'confirmed', reviewed_at: new Date().toISOString() })
    .eq('id', billId)
    .eq('user_id', user.id);

  // Create obligation from confirmed bill
  const createObligation = body?.createObligation !== false; // default true
  let obligationId = bill.linked_obligation_id;

  if (createObligation && !obligationId) {
    const confirmed = bill.confirmed_fields || {};
    const { data: obligation } = await supabase
      .from('financial_obligations')
      .insert({
        user_id: user.id,
        source_document_id: bill.document_id,
        institution_name: confirmed.provider_name || bill.provider_name,
        account_label: confirmed.account_name || bill.account_name || bill.provider_name || 'Decoded Bill',
        masked_account_identifier: bill.masked_account_number,
        category: mapBillTypeToCategory(bill.bill_type),
        due_date: confirmed.due_date || bill.due_date,
        amount_due: toNumber(confirmed.total_due ?? bill.total_due),
        minimum_due: toNumber(confirmed.minimum_due ?? bill.minimum_due),
        past_due_amount: toNumber(bill.past_due_amount),
        current_balance: toNumber(bill.current_balance),
        credit_limit: toNumber(bill.credit_limit),
        status: bill.due_date && new Date(bill.due_date) < new Date() ? 'overdue' : 'planned',
        is_recurring: bill.is_recurring_candidate,
        confidence_score: bill.extraction_confidence,
        source_data: { decoded_bill_id: bill.id, source: 'bill_decoder' },
      })
      .select('id')
      .single();

    if (obligation) {
      obligationId = obligation.id;
      await supabase
        .from('decoded_bills')
        .update({ linked_obligation_id: obligation.id })
        .eq('id', billId)
        .eq('user_id', user.id);
    }
  }

  return ok({ billId, review_status: 'confirmed', obligationId });
}

async function handleRejectBill({ user, body }) {
  const billId = body?.billId;
  if (!billId) return fail('billId is required.', 'ERR_VALIDATION', 400);

  await supabase
    .from('decoded_bills')
    .update({ review_status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', billId)
    .eq('user_id', user.id);

  return ok({ billId, review_status: 'rejected' });
}

async function handleUpdateBillField({ user, body }) {
  const billId = body?.billId;
  const fieldName = body?.fieldName;
  const fieldValue = body?.fieldValue;

  if (!billId || !fieldName) {
    return fail('billId and fieldName are required.', 'ERR_VALIDATION', 400);
  }

  const ALLOWED_FIELDS = [
    'provider_name', 'account_name', 'due_date', 'total_due',
    'minimum_due', 'current_balance', 'statement_balance', 'past_due_amount',
    'late_fee', 'credit_limit', 'bill_type',
  ];
  if (!ALLOWED_FIELDS.includes(fieldName)) {
    return fail('Field not editable.', 'ERR_VALIDATION', 400);
  }

  const { data: bill, error: billErr } = await supabase
    .from('decoded_bills')
    .select('confirmed_fields')
    .eq('id', billId)
    .eq('user_id', user.id)
    .single();

  if (billErr || !bill) return fail('Bill not found.', 'ERR_NOT_FOUND', 404);

  const confirmed = { ...(bill.confirmed_fields || {}), [fieldName]: fieldValue };

  await supabase
    .from('decoded_bills')
    .update({ confirmed_fields: confirmed })
    .eq('id', billId)
    .eq('user_id', user.id);

  return ok({ billId, fieldName, fieldValue, confirmed_fields: confirmed });
}

async function handleMergeToObligation({ user, body }) {
  const billId = body?.billId;
  const obligationId = body?.obligationId;
  if (!billId || !obligationId) {
    return fail('billId and obligationId are required.', 'ERR_VALIDATION', 400);
  }

  // Verify obligation exists and belongs to user
  const { data: obligation } = await supabase
    .from('financial_obligations')
    .select('id')
    .eq('id', obligationId)
    .eq('user_id', user.id)
    .single();

  if (!obligation) return fail('Obligation not found.', 'ERR_NOT_FOUND', 404);

  await supabase
    .from('decoded_bills')
    .update({
      linked_obligation_id: obligationId,
      review_status: 'merged',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', billId)
    .eq('user_id', user.id);

  return ok({ billId, review_status: 'merged', obligationId });
}

function mapBillTypeToCategory(billType) {
  const map = {
    credit_card: 'credit_card',
    utility: 'utility',
    insurance: 'insurance',
    loan: 'loan',
    phone_internet: 'utility',
    rent_mortgage: 'rent',
    medical: 'bill',
    subscription: 'subscription',
    other: 'bill',
  };
  return map[billType] || 'bill';
}

// ── GET handler ────────────────────────────────────────────────────────────

async function loadDecodedBills(userId) {
  const { data: bills } = await supabase
    .from('decoded_bills')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const pending = (bills || []).filter((b) => b.review_status === 'pending_review');
  const confirmed = (bills || []).filter((b) => b.review_status === 'confirmed');
  const rejected = (bills || []).filter((b) => b.review_status === 'rejected');
  const merged = (bills || []).filter((b) => b.review_status === 'merged');

  return {
    bills: bills || [],
    pendingReviewCount: pending.length,
    confirmedCount: confirmed.length,
    rejectedCount: rejected.length,
    mergedCount: merged.length,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  if (event.httpMethod === 'GET') {
    const result = await loadDecodedBills(user.id);
    return ok(result);
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return fail('Invalid JSON.', 'ERR_PARSE', 400);
    }

    const action = body.action;
    switch (action) {
      case 'decode_document':
        return handleDecodeDocument({ user, body });
      case 'confirm_bill':
        return handleConfirmBill({ user, body });
      case 'reject_bill':
        return handleRejectBill({ user, body });
      case 'update_bill_field':
        return handleUpdateBillField({ user, body });
      case 'merge_to_obligation':
        return handleMergeToObligation({ user, body });
      default:
        return fail(`Unknown action: ${action}`, 'ERR_UNKNOWN_ACTION', 400);
    }
  }

  return fail('Method not allowed.', 'ERR_METHOD', 405);
}
