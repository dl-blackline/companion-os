# Companion OS Financial Intelligence Architecture

## 1) Architecture Audit

### Existing strengths
- Existing financial ingestion from Plaid via `netlify/functions/financial-management.js` into:
  - `financial_connections`
  - `financial_accounts`
  - `financial_transactions`
- Existing finance UX entrypoint in `src/components/views/FinanceView.tsx`.
- Existing authenticated Netlify function patterns for user-bound CRUD.
- Existing Supabase storage integration pattern in `src/hooks/use-image-memory.ts`.
- Existing AI analysis infrastructure (`lib/openai-client.js`, `lib/vision-analyzer.js`) for robust extraction pipelines.

### Gaps before this implementation
- No document ingestion pipeline for statement PDFs/images.
- No normalized obligations schema tied to source documents.
- No savings goals, financial calendar, or insight records.
- No source traceability from dashboard records back to uploaded artifacts.
- No audit-ready parse confidence + extraction payload ledger.

## 2) System Design

### Product layers
1. Live bank telemetry layer (existing)
2. Document intake + extraction layer (new)
3. Planning layer:
   - bill planner
   - savings goals
   - financial calendar
4. Insight layer:
   - deterministic pressure and concentration analysis
5. Executive command dashboard layer

### Request/response topology
- Frontend `FinanceView` uses two hooks:
  - `useFinancialHealth` for live-linked banking pulse
  - `useFinancialIntelligence` for planning and document intelligence
- New API surface:
  - `GET /.netlify/functions/financial-intelligence` for full dashboard state
  - `POST /.netlify/functions/financial-intelligence` actions:
    - `ingest_document`
    - `upsert_obligation`
    - `upsert_goal`
    - `upsert_calendar_event`
    - `set_preference`
    - `refresh_insights`

## 3) Data Schema / Entities

Implemented in migration `027_financial_intelligence.sql`.

### Storage bucket
- `financial_documents` (private)
- User-bound folder ownership policy

### Tables
- `financial_documents`
  - canonical source record for uploaded statement docs
  - parse lifecycle status and confidence
- `financial_document_extractions`
  - structured extraction output and provenance payload
- `financial_obligations`
  - operational bill/debt objects used in planner and calendar
- `financial_savings_goals`
  - strategic goal tracking with target and contribution pacing
- `financial_calendar_events`
  - due dates, reminders, paydays, transfers, custom items
- `financial_insights`
  - generated insight records (severity, action hint, confidence)
- `financial_preferences`
  - planner behavior preferences (anchor day, risk posture, reminders)

### Ownership and trust
- RLS on every table keyed by `user_id = auth.uid()`.
- Source traceability via `source_document_id` and `extraction_id` foreign keys.
- Timestamp and trigger-based update auditing on all major records.

## 4) File-by-File Implementation Plan

### Backend
- `supabase/migrations/027_financial_intelligence.sql`
  - new data model, policies, and storage bucket policies
- `netlify/functions/financial-intelligence.js`
  - dashboard loader
  - ingest and parse action handlers
  - deterministic insight generation
  - planning CRUD endpoints

### Frontend
- `src/types/financial-intelligence.ts`
  - typed contract for dashboard and write actions
- `src/hooks/use-financial-intelligence.ts`
  - auth-aware API client and storage upload + ingest flow
- `src/components/views/FinanceView.tsx`
  - executive dashboard with tabs:
    - Dashboard
    - Documents
    - Bill Planner
    - Savings Goals
    - Calendar
    - Insights
- `src/types/index.ts`
  - type export integration

### Dependencies
- `package.json`
  - add `pdf-parse` for PDF-first extraction pipeline

## 5) UX Implementation Notes

Design intent for Financial Intelligence console:
- dark-mode-first, high-contrast executive card hierarchy
- high-signal summary metrics
- traceable document intake panel with parse confidence
- planner-first operations (not consumer gamification)
- non-judgmental insight language and action support framing

## 6) Testing Plan

### Functional
1. Upload each source type (PDF and image) and verify:
   - storage path written
   - `financial_documents` created
   - extraction record generated
   - obligations populated when detected
2. Save/modify obligations, goals, events and verify persistence and dashboard refresh.
3. Validate rule-engine insights regenerate via `refresh_insights`.

### Security / trust
1. Verify RLS: user A cannot read/write user B records.
2. Verify private bucket path ownership policy.
3. Confirm parse failures are surfaced without phantom certainty.

### Regression
1. Existing bank-link flow remains functional.
2. Existing pulse cards still render and update.

## 7) End-to-End System Summary

1. User uploads a financial source document from Finance > Documents.
2. File is stored in private Supabase bucket (`financial_documents`).
3. Backend ingest action reads source, extracts text (PDF-first), uses AI structured extraction, writes extraction ledger, and materializes obligations.
4. Dashboard aggregates obligations, goals, events, insights, and recent docs into one command surface.
5. User plans payments, sets goals, and schedules events.
6. Insight engine flags cash pressure, due-date clusters, utilization risk, and savings pace gaps.
7. Live bank pulse remains integrated, enabling both transactional telemetry and document-grounded planning in one operating layer.

## 8) Boundaries and Compliance Positioning

This implementation provides planning, organization, and visibility support.
It does not provide legal, fiduciary, investment, or tax advice.
