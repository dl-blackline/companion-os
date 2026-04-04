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
  if (!token || !supabase) return null;
  try {
    const { data } = await supabase.auth.getUser(token);
    return data?.user || null;
  } catch {
    return null;
  }
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

async function readStorageText(storagePath) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error('Failed to read financial document from storage.');
  }

  let buffer;
  if (typeof data.arrayBuffer === 'function') {
    const ab = await data.arrayBuffer();
    buffer = Buffer.from(ab);
  } else {
    buffer = Buffer.from(data);
  }

  return buffer;
}

async function extractDocumentText({ storagePath, mimeType }) {
  const bytes = await readStorageText(storagePath);

  if ((mimeType || '').includes('pdf')) {
    const parsed = await pdfParse(bytes);
    return parsed?.text || '';
  }

  if ((mimeType || '').startsWith('image/')) {
    const signed = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 10);

    if (!signed.data?.signedUrl) {
      throw new Error('Unable to create secure URL for image analysis.');
    }

    const analysis = await analyzeImage({
      image_url: signed.data.signedUrl,
      prompt: 'Extract all financial text and visible statement details. Focus on balances, due dates, minimum due, limits, fees, creditor names, account info, and schedule clues.',
      model: 'gpt-4.1',
    });
    return analysis || '';
  }

  // Fallback: best-effort UTF-8 text extraction for plain/structured files
  return bytes.toString('utf8');
}

async function extractStructuredFinancialData({ sourceType, filename, rawText }) {
  const prompt = {
    system: `You are a financial document extraction engine.
Extract facts from statement-like documents.
Return only valid JSON with this exact shape:
{
  "institutionName": "string|null",
  "accountType": "string|null",
  "maskedAccountIdentifier": "string|null",
  "statementPeriodStart": "YYYY-MM-DD|null",
  "statementPeriodEnd": "YYYY-MM-DD|null",
  "statementClosingDate": "YYYY-MM-DD|null",
  "dueDate": "YYYY-MM-DD|null",
  "currentBalance": 0,
  "statementBalance": 0,
  "minimumPaymentDue": 0,
  "creditLimit": 0,
  "availableCredit": 0,
  "aprPercent": 0,
  "pastDueAmount": 0,
  "feesAmount": 0,
  "recurringPaymentDetected": false,
  "recurringHint": "string|null",
  "confidenceScore": 0.0,
  "obligations": [
    {
      "label": "string",
      "category": "bill|loan|credit_card|rent|insurance|subscription|utility|tax|other",
      "dueDate": "YYYY-MM-DD|null",
      "amountDue": 0,
      "minimumDue": 0,
      "pastDueAmount": 0,
      "isRecurring": false,
      "notes": "string|null",
      "confidenceScore": 0.0
    }
  ],
  "transactionSummary": {
    "inflow": 0,
    "outflow": 0,
    "largestExpenses": []
  },
  "notes": "string|null"
}
Rules:
- Use null when unknown.
- Use numeric values when present, else 0.
- Keep confidenceScore between 0 and 1.
- Do not invent institution names or dates.
- Include obligations only if supported by text evidence.` ,
    user: `Source type: ${sourceType}\nFilename: ${filename}\n\nDocument text:\n${rawText.slice(0, 24000)}`,
  };

  const raw = await generateChatCompletion(prompt, 'gpt-4.1-mini', 0.1);
  const parsed = JSON.parse(cleanJson(raw));

  return {
    institutionName: parsed.institutionName || null,
    accountType: parsed.accountType || null,
    maskedAccountIdentifier: parsed.maskedAccountIdentifier || null,
    statementPeriodStart: parseDate(parsed.statementPeriodStart),
    statementPeriodEnd: parseDate(parsed.statementPeriodEnd),
    statementClosingDate: parseDate(parsed.statementClosingDate),
    dueDate: parseDate(parsed.dueDate),
    currentBalance: toNumber(parsed.currentBalance),
    statementBalance: toNumber(parsed.statementBalance),
    minimumPaymentDue: toNumber(parsed.minimumPaymentDue),
    creditLimit: toNumber(parsed.creditLimit),
    availableCredit: toNumber(parsed.availableCredit),
    aprPercent: toNumber(parsed.aprPercent),
    pastDueAmount: toNumber(parsed.pastDueAmount),
    feesAmount: toNumber(parsed.feesAmount),
    recurringPaymentDetected: Boolean(parsed.recurringPaymentDetected),
    recurringHint: parsed.recurringHint || null,
    confidenceScore: Math.max(0, Math.min(1, toNumber(parsed.confidenceScore))),
    obligations: Array.isArray(parsed.obligations) ? parsed.obligations : [],
    transactionSummary: parsed.transactionSummary && typeof parsed.transactionSummary === 'object'
      ? parsed.transactionSummary
      : {},
    notes: parsed.notes || null,
  };
}

async function ingestDocument({ user, body }) {
  let sourceType = body?.sourceType;
  const storagePath = body?.storagePath;
  const filename = body?.filename;
  const mimeType = body?.mimeType || null;
  const fileSizeBytes = body?.fileSizeBytes || null;

  if (!storagePath || !filename) {
    return fail('Missing required fields: storagePath, filename', 'ERR_VALIDATION', 400);
  }

  // AI-assisted document type detection
  if (!sourceType || sourceType === 'auto_detect') {
    try {
      const rawText = await extractDocumentText({ storagePath, mimeType });
      const classifyPrompt = {
        system: `You are a financial document classifier. Given the raw text of a financial document, determine its type.
Return ONLY one of these exact strings (no other text):
bank_statement, credit_card_statement, loan_statement, pay_stub, tax_return, insurance_policy, investment_statement, bill, receipt, other`,
        user: `Filename: ${filename}\n\nDocument text:\n${rawText.slice(0, 6000)}`,
      };
      const detected = (await generateChatCompletion(classifyPrompt, 'gpt-4.1-mini', 0.05)).trim().toLowerCase();
      const validTypes = ['bank_statement', 'credit_card_statement', 'loan_statement', 'pay_stub', 'tax_return', 'insurance_policy', 'investment_statement', 'bill', 'receipt', 'other'];
      sourceType = validTypes.includes(detected) ? detected : 'other';
    } catch {
      sourceType = 'other';
    }
  }

  const { data: document, error: docError } = await supabase
    .from('financial_documents')
    .insert({
      user_id: user.id,
      storage_bucket: STORAGE_BUCKET,
      storage_path: storagePath,
      source_type: sourceType,
      filename,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      document_status: 'processing',
    })
    .select('*')
    .single();

  if (docError || !document) {
    return fail('Failed to create document record.', 'ERR_DB', 500);
  }

  try {
    const rawText = await extractDocumentText({ storagePath, mimeType });
    const extracted = await extractStructuredFinancialData({ sourceType, filename, rawText });

    const { data: extraction, error: extractionError } = await supabase
      .from('financial_document_extractions')
      .insert({
        user_id: user.id,
        document_id: document.id,
        institution_name: extracted.institutionName,
        account_type: extracted.accountType,
        masked_account_identifier: extracted.maskedAccountIdentifier,
        due_date: extracted.dueDate,
        current_balance: extracted.currentBalance,
        statement_balance: extracted.statementBalance,
        minimum_payment_due: extracted.minimumPaymentDue,
        credit_limit: extracted.creditLimit,
        available_credit: extracted.availableCredit,
        apr_percent: extracted.aprPercent,
        past_due_amount: extracted.pastDueAmount,
        fees_amount: extracted.feesAmount,
        recurring_payment_detected: extracted.recurringPaymentDetected,
        recurring_hint: extracted.recurringHint,
        extracted_obligations: extracted.obligations,
        transaction_summary: extracted.transactionSummary,
        extraction_payload: extracted,
        extraction_notes: extracted.notes,
        confidence_score: extracted.confidenceScore,
        model_used: 'gpt-4.1-mini',
      })
      .select('*')
      .single();

    if (extractionError || !extraction) {
      throw new Error('Unable to persist extraction results.');
    }

    const obligationRows = (extracted.obligations || [])
      .filter((o) => o && typeof o === 'object')
      .map((o) => ({
        user_id: user.id,
        source_document_id: document.id,
        extraction_id: extraction.id,
        institution_name: extracted.institutionName,
        account_type: extracted.accountType,
        account_label: o.label || filename,
        masked_account_identifier: extracted.maskedAccountIdentifier,
        category: o.category || 'bill',
        due_date: parseDate(o.dueDate),
        amount_due: toNumber(o.amountDue),
        minimum_due: toNumber(o.minimumDue),
        past_due_amount: toNumber(o.pastDueAmount),
        current_balance: extracted.currentBalance,
        credit_limit: extracted.creditLimit,
        available_credit: extracted.availableCredit,
        apr_percent: extracted.aprPercent,
        status: parseDate(o.dueDate) && new Date(parseDate(o.dueDate)) < new Date() ? 'overdue' : 'planned',
        is_recurring: Boolean(o.isRecurring),
        notes: o.notes || null,
        confidence_score: Math.max(0, Math.min(1, toNumber(o.confidenceScore))),
        source_data: o,
      }));

    if (obligationRows.length > 0) {
      await supabase.from('financial_obligations').insert(obligationRows);
    }

    await supabase
      .from('financial_documents')
      .update({
        document_status: 'parsed',
        parse_confidence: extracted.confidenceScore,
        parse_summary: extracted.notes,
        statement_start_date: extracted.statementPeriodStart,
        statement_end_date: extracted.statementPeriodEnd,
        statement_closing_date: extracted.statementClosingDate,
        parsed_at: new Date().toISOString(),
      })
      .eq('id', document.id)
      .eq('user_id', user.id);

    return ok({
      documentId: document.id,
      extractionId: extraction.id,
      obligationsCreated: obligationRows.length,
      confidence: extracted.confidenceScore,
      extraction,
    });
  } catch (error) {
    await supabase
      .from('financial_documents')
      .update({
        document_status: 'failed',
        parse_summary: error instanceof Error ? error.message : 'Failed to process document.',
      })
      .eq('id', document.id)
      .eq('user_id', user.id);

    return fail(error instanceof Error ? error.message : 'Document processing failed', 'ERR_PARSE', 500);
  }
}

function buildGeneratedInsights({ obligations, goals, nextPaydayDate }) {
  const now = new Date();
  const in7 = new Date(now);
  in7.setDate(now.getDate() + 7);
  const in14 = new Date(now);
  in14.setDate(now.getDate() + 14);

  const overdue = obligations.filter((o) => o.status !== 'paid' && o.due_date && new Date(o.due_date) < now);
  const dueSoon = obligations.filter((o) => o.status !== 'paid' && o.due_date && new Date(o.due_date) >= now && new Date(o.due_date) <= in7);
  const due14 = obligations.filter((o) => o.status !== 'paid' && o.due_date && new Date(o.due_date) <= in14);

  const insights = [];

  if (overdue.length > 0) {
    insights.push({
      insight_type: 'cash_pressure',
      severity: overdue.length >= 3 ? 'critical' : 'high',
      title: `${overdue.length} obligation${overdue.length > 1 ? 's' : ''} overdue`,
      summary: 'There are overdue obligations requiring immediate triage. Prioritize minimum dues to reduce compounding pressure.',
      action_hint: 'Create a catch-up plan and set actual payment dates for the highest-risk items first.',
      confidence_score: 0.95,
      related_record_ids: overdue.map((o) => o.id),
      generated_by: 'rule_engine',
    });
  }

  if (dueSoon.length >= 3) {
    insights.push({
      insight_type: 'due_date_cluster',
      severity: 'high',
      title: 'High due-date concentration this week',
      summary: `There are ${dueSoon.length} obligations due within the next 7 days, indicating a potential cash crunch window.`,
      action_hint: 'Sequence planned payment dates against expected income timing to reduce short-term pressure.',
      confidence_score: 0.88,
      related_record_ids: dueSoon.map((o) => o.id),
      generated_by: 'rule_engine',
    });
  }

  const highUtilization = obligations.filter((o) => toNumber(o.credit_limit) > 0 && toNumber(o.current_balance) / toNumber(o.credit_limit) >= 0.75);
  if (highUtilization.length > 0) {
    insights.push({
      insight_type: 'utilization_risk',
      severity: highUtilization.length > 1 ? 'high' : 'medium',
      title: 'Utilization risk detected',
      summary: `${highUtilization.length} revolving account${highUtilization.length > 1 ? 's are' : ' is'} near or above 75% utilization.`,
      action_hint: 'Allocate excess cash toward high-utilization balances when possible to improve flexibility.',
      confidence_score: 0.9,
      related_record_ids: highUtilization.map((o) => o.id),
      generated_by: 'rule_engine',
    });
  }

  for (const goal of goals) {
    if (goal.status !== 'active') continue;
    const remaining = Math.max(0, toNumber(goal.target_amount) - toNumber(goal.current_amount));
    const monthly = toNumber(goal.monthly_contribution_target);
    if (remaining > 0 && goal.target_date && monthly > 0) {
      const monthsNeeded = remaining / monthly;
      const monthsLeft = Math.max(0, (new Date(goal.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (monthsNeeded > monthsLeft * 1.2) {
        insights.push({
          insight_type: 'savings_gap',
          severity: 'medium',
          title: `Savings pace gap: ${goal.name}`,
          summary: `At the current contribution pace, this goal is likely to miss its target timeline.`,
          action_hint: 'Consider increasing monthly contribution target or adjusting the date to maintain planning realism.',
          confidence_score: 0.8,
          related_record_ids: [goal.id],
          generated_by: 'rule_engine',
        });
      }
    }
  }

  if (nextPaydayDate) {
    const beforePaydayLoad = due14
      .filter((o) => o.due_date && new Date(o.due_date) <= new Date(nextPaydayDate))
      .reduce((sum, o) => sum + toNumber(o.planned_payment || o.minimum_due || o.amount_due), 0);

    if (beforePaydayLoad > 0) {
      insights.push({
        insight_type: 'cash_pressure',
        severity: beforePaydayLoad > 3000 ? 'high' : 'medium',
        title: 'Pre-payday payment load',
        summary: `Planned obligations before next payday total approximately ${beforePaydayLoad.toFixed(0)}.`,
        action_hint: 'Use the calendar to sequence obligations and defer non-critical outflows where possible.',
        confidence_score: 0.75,
        related_record_ids: due14.map((o) => o.id),
        generated_by: 'rule_engine',
      });
    }
  }

  return insights;
}

async function refreshInsights(userId) {
  const [{ data: obligations }, { data: goals }, { data: prefs }] = await Promise.all([
    supabase
      .from('financial_obligations')
      .select('id, due_date, status, planned_payment, minimum_due, amount_due, credit_limit, current_balance')
      .eq('user_id', userId),
    supabase
      .from('financial_savings_goals')
      .select('id, name, target_amount, current_amount, monthly_contribution_target, target_date, status')
      .eq('user_id', userId),
    supabase
      .from('financial_preferences')
      .select('monthly_income_anchor_day')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const anchorDay = toNumber(prefs?.monthly_income_anchor_day);
  let nextPaydayDate = null;
  if (anchorDay > 0) {
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth(), Math.min(28, anchorDay));
    if (month < now) month.setMonth(month.getMonth() + 1);
    nextPaydayDate = month.toISOString().slice(0, 10);
  }

  const generated = buildGeneratedInsights({
    obligations: obligations || [],
    goals: goals || [],
    nextPaydayDate,
  });

  await supabase
    .from('financial_insights')
    .delete()
    .eq('user_id', userId)
    .eq('generated_by', 'rule_engine');

  if (generated.length > 0) {
    await supabase
      .from('financial_insights')
      .insert(generated.map((insight) => ({ user_id: userId, ...insight })));
  }

  return generated.length;
}

async function loadDashboard(userId) {
  await refreshInsights(userId);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const in14 = new Date(today);
  in14.setDate(today.getDate() + 14);

  const [docsRes, obligationsRes, goalsRes, eventsRes, insightsRes, accountsRes] = await Promise.all([
    supabase
      .from('financial_documents')
      .select('id, source_type, filename, document_status, parse_confidence, uploaded_at, parsed_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(12),
    supabase
      .from('financial_obligations')
      .select('id, institution_name, account_label, category, due_date, amount_due, minimum_due, planned_payment, actual_payment_date, status, is_recurring, current_balance, credit_limit, past_due_amount, notes')
      .eq('user_id', userId)
      .order('due_date', { ascending: true }),
    supabase
      .from('financial_savings_goals')
      .select('id, name, target_amount, target_date, priority, current_amount, monthly_contribution_target, recommended_contribution_rate, funding_rule, status, notes, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('financial_calendar_events')
      .select('id, obligation_id, title, event_type, scheduled_date, amount, status, reminder_offset_days, notes')
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true })
      .limit(40),
    supabase
      .from('financial_insights')
      .select('id, insight_type, severity, title, summary, action_hint, confidence_score, generated_by, generated_at, dismissed_at')
      .eq('user_id', userId)
      .is('dismissed_at', null)
      .order('generated_at', { ascending: false })
      .limit(20),
    supabase
      .from('financial_accounts')
      .select('id, current_balance, credit_limit, type, subtype')
      .eq('user_id', userId),
  ]);

  const obligations = obligationsRes.data || [];
  const todayIso = today.toISOString().slice(0, 10);
  const dueSoon = obligations.filter((o) => o.status !== 'paid' && o.due_date && o.due_date >= todayIso && o.due_date <= in14.toISOString().slice(0, 10));
  const overdue = obligations.filter((o) => o.status !== 'paid' && o.due_date && o.due_date < todayIso);
  const monthObligations = obligations.filter((o) => o.due_date && o.due_date >= monthStart && o.due_date <= monthEnd && o.status !== 'paid');

  const totalUpcomingObligations = monthObligations.reduce((sum, item) => sum + toNumber(item.amount_due || item.minimum_due || item.planned_payment), 0);
  const minimumPaymentsThisMonth = monthObligations.reduce((sum, item) => sum + toNumber(item.minimum_due), 0);

  const revolvingAccounts = (accountsRes.data || []).filter((a) => ['credit', 'credit card', 'credit_card'].includes(String(a.type || '').toLowerCase()) || String(a.subtype || '').toLowerCase().includes('credit'));
  const totalRevolvingBalances = revolvingAccounts.reduce((sum, a) => sum + toNumber(a.current_balance), 0);
  const totalCreditLimits = revolvingAccounts.reduce((sum, a) => sum + toNumber(a.credit_limit), 0);
  const utilization = totalCreditLimits > 0 ? (totalRevolvingBalances / totalCreditLimits) * 100 : 0;

  const pressure7d = obligations
    .filter((o) => o.status !== 'paid' && o.due_date && new Date(o.due_date) <= new Date(today.getTime() + 7 * 86400000))
    .reduce((sum, o) => sum + toNumber(o.planned_payment || o.minimum_due || o.amount_due), 0);

  const pressure30d = obligations
    .filter((o) => o.status !== 'paid' && o.due_date && new Date(o.due_date) <= new Date(today.getTime() + 30 * 86400000))
    .reduce((sum, o) => sum + toNumber(o.planned_payment || o.minimum_due || o.amount_due), 0);

  return {
    snapshot: {
      totalUpcomingObligations: Number(totalUpcomingObligations.toFixed(2)),
      minimumPaymentsThisMonth: Number(minimumPaymentsThisMonth.toFixed(2)),
      totalRevolvingBalances: Number(totalRevolvingBalances.toFixed(2)),
      utilizationPercent: Number(utilization.toFixed(1)),
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      pressure7d: Number(pressure7d.toFixed(2)),
      pressure30d: Number(pressure30d.toFixed(2)),
    },
    documents: docsRes.data || [],
    obligations,
    goals: goalsRes.data || [],
    calendarEvents: eventsRes.data || [],
    insights: insightsRes.data || [],
  };
}

async function upsertObligation(userId, body) {
  const payload = {
    user_id: userId,
    id: body.id || undefined,
    institution_name: body.institutionName || null,
    account_type: body.accountType || null,
    account_label: body.accountLabel || null,
    category: body.category || 'bill',
    due_date: parseDate(body.dueDate),
    estimated_payment_date: parseDate(body.estimatedPaymentDate),
    actual_payment_date: parseDate(body.actualPaymentDate),
    amount_due: toNumber(body.amountDue),
    minimum_due: toNumber(body.minimumDue),
    planned_payment: toNumber(body.plannedPayment),
    past_due_amount: toNumber(body.pastDueAmount),
    current_balance: toNumber(body.currentBalance),
    credit_limit: toNumber(body.creditLimit),
    available_credit: toNumber(body.availableCredit),
    apr_percent: toNumber(body.aprPercent),
    status: body.status || 'planned',
    is_recurring: Boolean(body.isRecurring),
    recurrence_rule: body.recurrenceRule || null,
    next_due_date: parseDate(body.nextDueDate),
    notes: body.notes || null,
  };

  const { error } = await supabase
    .from('financial_obligations')
    .upsert(payload, { onConflict: 'id' });

  if (error) return fail('Failed to save obligation.', 'ERR_DB', 500);
  return ok(await loadDashboard(userId));
}

async function upsertGoal(userId, body) {
  const payload = {
    user_id: userId,
    id: body.id || undefined,
    name: body.name,
    target_amount: toNumber(body.targetAmount),
    target_date: parseDate(body.targetDate),
    priority: body.priority || 'medium',
    current_amount: toNumber(body.currentAmount),
    monthly_contribution_target: toNumber(body.monthlyContributionTarget),
    recommended_contribution_rate: toNumber(body.recommendedContributionRate),
    funding_rule: body.fundingRule || null,
    status: body.status || 'active',
    notes: body.notes || null,
  };

  if (!payload.name || payload.target_amount <= 0) {
    return fail('Goal name and target amount are required.', 'ERR_VALIDATION', 400);
  }

  const { error } = await supabase
    .from('financial_savings_goals')
    .upsert(payload, { onConflict: 'id' });

  if (error) return fail('Failed to save savings goal.', 'ERR_DB', 500);
  return ok(await loadDashboard(userId));
}

async function upsertCalendarEvent(userId, body) {
  const payload = {
    user_id: userId,
    id: body.id || undefined,
    obligation_id: body.obligationId || null,
    title: body.title,
    event_type: body.eventType || 'custom',
    scheduled_date: parseDate(body.scheduledDate),
    amount: toNumber(body.amount),
    status: body.status || 'scheduled',
    reminder_offset_days: body.reminderOffsetDays ?? null,
    notes: body.notes || null,
  };

  if (!payload.title || !payload.scheduled_date) {
    return fail('Calendar event title and scheduledDate are required.', 'ERR_VALIDATION', 400);
  }

  const { error } = await supabase
    .from('financial_calendar_events')
    .upsert(payload, { onConflict: 'id' });

  if (error) return fail('Failed to save calendar event.', 'ERR_DB', 500);
  return ok(await loadDashboard(userId));
}

async function setPreference(userId, body) {
  const payload = {
    user_id: userId,
    timezone: body.timezone || null,
    monthly_income_anchor_day: body.monthlyIncomeAnchorDay ?? null,
    risk_tolerance: body.riskTolerance || null,
    reminder_default_days: body.reminderDefaultDays ?? null,
    privacy_notice_ack_at: body.privacyNoticeAck ? new Date().toISOString() : undefined,
  };

  const { error } = await supabase
    .from('financial_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) return fail('Failed to save financial preferences.', 'ERR_DB', 500);
  return ok(await loadDashboard(userId));
}

// ── AI Financial Intake ────────────────────────────────────────────────────
async function handleAIFinancialIntake(userId, body) {
  const message = (body.message || '').trim();
  if (!message) return fail('Message is required.', 'ERR_VALIDATION', 400);

  // Load current dashboard for context
  const dashboard = await loadDashboard(userId);
  const existingObligations = (dashboard.obligations || [])
    .map(o => `${o.account_label || o.institution_name}: $${o.amount_due} due ${o.due_date}`)
    .join('\n');

  const prompt = {
    system: `You are a premium financial AI assistant. The user is telling you about their financial situation — bills, money owed, upcoming expenses, income, debts, or asking for financial planning help.

Your job:
1. Extract any obligations, bills, or expenses mentioned and return them as structured items to save.
2. Provide a brief, helpful natural language response acknowledging what you understood and any advice.
3. If the user mentions savings goals, extract those too.

Current obligations on file:
${existingObligations || 'None yet.'}

Return ONLY valid JSON with this schema:
{
  "response": "Your natural language response to the user",
  "obligations": [
    {
      "accountLabel": "string",
      "category": "bill|debt|subscription|insurance|rent_mortgage|utility|medical|loan|other",
      "dueDate": "YYYY-MM-DD or null",
      "amountDue": 0,
      "minimumDue": 0,
      "isRecurring": false,
      "notes": "string or null"
    }
  ],
  "goals": [
    {
      "name": "string",
      "targetAmount": 0,
      "currentAmount": 0,
      "priority": "low|medium|high|critical",
      "notes": "string or null"
    }
  ],
  "calendarEvents": [
    {
      "title": "string",
      "eventType": "bill_due|payday|savings_transfer|debt_payment|reminder|custom",
      "scheduledDate": "YYYY-MM-DD",
      "amount": 0
    }
  ]
}

Rules:
- Only include obligations/goals/events that the user explicitly mentions.
- If no extractable items, return empty arrays.
- Be conversational and helpful in the response.
- Use realistic amounts from what the user says.
- If dates are vague ("next week", "end of month"), estimate a reasonable date. Today is ${new Date().toISOString().slice(0, 10)}.
- category should match the type of obligation.`,
    user: message,
  };

  try {
    const raw = await generateChatCompletion(prompt, 'gpt-4.1-mini', 0.2);
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const savedItems = { obligations: 0, goals: 0, events: 0 };

    // Save extracted obligations
    if (Array.isArray(parsed.obligations)) {
      for (const obl of parsed.obligations) {
        if (!obl.accountLabel) continue;
        const { error: oblErr } = await supabase.from('financial_obligations').insert({
          user_id: userId,
          account_label: obl.accountLabel,
          category: obl.category || 'bill',
          due_date: parseDate(obl.dueDate),
          amount_due: toNumber(obl.amountDue),
          minimum_due: toNumber(obl.minimumDue),
          is_recurring: Boolean(obl.isRecurring),
          notes: obl.notes || null,
          status: 'planned',
        });
        if (!oblErr) savedItems.obligations++;
      }
    }

    // Save extracted goals
    if (Array.isArray(parsed.goals)) {
      for (const goal of parsed.goals) {
        if (!goal.name || toNumber(goal.targetAmount) <= 0) continue;
        const { error: goalErr } = await supabase.from('financial_savings_goals').insert({
          user_id: userId,
          name: goal.name,
          target_amount: toNumber(goal.targetAmount),
          current_amount: toNumber(goal.currentAmount),
          priority: goal.priority || 'medium',
          notes: goal.notes || null,
          status: 'active',
        });
        if (!goalErr) savedItems.goals++;
      }
    }

    // Save extracted calendar events
    if (Array.isArray(parsed.calendarEvents)) {
      for (const evt of parsed.calendarEvents) {
        if (!evt.title || !evt.scheduledDate) continue;
        const { error: evtErr } = await supabase.from('financial_calendar_events').insert({
          user_id: userId,
          title: evt.title,
          event_type: evt.eventType || 'reminder',
          scheduled_date: parseDate(evt.scheduledDate),
          amount: toNumber(evt.amount),
          status: 'scheduled',
        });
        if (!evtErr) savedItems.events++;
      }
    }

    return ok({
      response: parsed.response || 'Got it. I\'ve processed your financial information.',
      savedItems,
      dashboard: await loadDashboard(userId),
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'AI financial intake failed.', 'ERR_AI_INTAKE', 500);
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  try {
    if (event.httpMethod === 'GET') {
      return ok(await loadDashboard(user.id));
    }

    if (event.httpMethod !== 'POST') {
      return fail('Method not allowed', 'ERR_METHOD', 405);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return fail('Invalid JSON body', 'ERR_VALIDATION', 400);
    }

    const action = body.action;
    if (action === 'ingest_document') {
      return await ingestDocument({ user, body });
    }

    if (action === 'upsert_obligation') {
      return await upsertObligation(user.id, body);
    }

    if (action === 'delete_obligation') {
      const oblId = body.id;
      if (!oblId) return fail('Obligation ID is required.', 'ERR_VALIDATION', 400);
      const { error: delErr } = await supabase
        .from('financial_obligations')
        .delete()
        .eq('id', oblId)
        .eq('user_id', user.id);
      if (delErr) return fail('Failed to delete obligation.', 'ERR_DB', 500);
      return ok(await loadDashboard(user.id));
    }

    if (action === 'upsert_goal') {
      return await upsertGoal(user.id, body);
    }

    if (action === 'delete_goal') {
      const goalId = body.id;
      if (!goalId) return fail('Goal ID is required.', 'ERR_VALIDATION', 400);
      const { error: delErr } = await supabase
        .from('financial_savings_goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', user.id);
      if (delErr) return fail('Failed to delete goal.', 'ERR_DB', 500);
      return ok(await loadDashboard(user.id));
    }

    if (action === 'delete_calendar_event') {
      const eventId = body.id;
      if (!eventId) return fail('Event ID is required.', 'ERR_VALIDATION', 400);
      const { error: delErr } = await supabase
        .from('financial_calendar_events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', user.id);
      if (delErr) return fail('Failed to delete event.', 'ERR_DB', 500);
      return ok(await loadDashboard(user.id));
    }

    if (action === 'upsert_calendar_event') {
      return await upsertCalendarEvent(user.id, body);
    }

    if (action === 'set_preference') {
      return await setPreference(user.id, body);
    }

    if (action === 'refresh_insights') {
      await refreshInsights(user.id);
      return ok(await loadDashboard(user.id));
    }

    if (action === 'ai_financial_intake') {
      return await handleAIFinancialIntake(user.id, body);
    }

    return fail('Unknown action', 'ERR_VALIDATION', 400);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Financial intelligence request failed.', 'ERR_FINANCE_INTEL', 500);
  }
}
