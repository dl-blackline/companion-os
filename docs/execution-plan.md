# Companion OS → 9.5/10 Execution Plan

> Repo-specific, opinionated, implementation-oriented.
> Generated from deep audit of every backend function, shared lib, CI config, test file, and frontend module.

---

## Section 1 — Executive Diagnosis

### Current Score: 7.8 / 10

**What's strong:**
- App-shell extraction is clean (163 LOC orchestrator, lazy sections, command registry)
- Gateway decomposition is solid (thin 69 LOC dispatcher → 8 focused handlers)
- Auth context is real (14-field context, token refresh, scheduleIdleTask)
- Secret scanning in build pipeline (pre-build + post-build)
- Surface taxonomy CSS is well-designed (5-tier system: core/instrument/telemetry/dock/console)
- Frontend services are well-tested (20 service test files)
- Automotive modules in `lib/automotive/` are architecturally coherent (state machine, RBAC, compliance)

**What's broken or missing:**

| # | Issue | Severity | Blast Radius |
|---|-------|----------|-------------|
| 1 | **Zero CI gates** — no lint, typecheck, test, or build verification in CI | Critical | Entire repo |
| 2 | **Entire backend is untyped JS** — 54 functions + 48 lib files + 10 automotive files = ~22,000 LOC with zero type safety | Critical | All server code |
| 3 | **Zero backend tests** — all 888 tests are frontend-only; every serverless function ships untested | Critical | All server code |
| 4 | **ESLint excludes the entire backend** — `netlify/functions`, `lib`, `scripts` in ignores array | High | All server code |
| 5 | **Only 1 of 7 audited functions uses `_security.js`** — `_ai-core.js` validates payloads; the other 6 have zero payload size limits, no `sanitizeDeep`, no `authenticateRequest` | High | Financial/PII endpoints |
| 6 | **`_ai-core.js` chat path has no auth** — `user_id` comes from request body, not from auth token; any caller can impersonate any user | Critical | Chat/AI |
| 7 | **tsconfig: `strict` is OFF** — only `strictNullChecks` is enabled; missing `noImplicitAny`, `strictBindCallApply`, `strictFunctionTypes`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict` | Medium | All TS code |
| 8 | **3 icon libraries ship to bundle** — Phosphor (primary), Lucide, Heroicons each get their own Vite chunk | Medium | Bundle size |
| 9 | **Prisma schema is disconnected** — contains Tarot app models, not Companion OS entities | Low | Schema layer |
| 10 | **`.env.example` is incomplete** — missing `STRIPE_SECRET_KEY`, `STRIPE_FINANCIAL_CONNECTIONS_RETURN_URL`, `APP_URL`, `CHAT_HISTORY_TABLE` | Low | Onboarding |

### Risk Summary

The **backend is the primary liability**. It handles real financial data (bank statements, Stripe Financial Connections, deal structures, commissions, PII) with:
- No type checking
- No lint safety
- No test coverage
- No consistent auth pattern
- No consistent input validation
- No payload size limits (except `_ai-core.js`)
- Console.log statements with sensitive data (balances, transactions)

The **frontend is in good shape** — TypeScript throughout, 888 tests, clean architecture, good service layer.

---

## Section 2 — Top 25 Improvements (Ranked by Impact × Effort)

### Tier 1: Stop the Bleeding (1-2 days each)

| # | Improvement | Impact | Effort | Why First |
|---|------------|--------|--------|-----------|
| 1 | **Create `ci.yml`** with lint + typecheck + test + build gates | 10 | S | Nothing else matters if broken code merges freely |
| 2 | **Fix `_ai-core.js` auth gap** — derive `user_id` from Bearer token, not request body | 10 | XS | Active security vulnerability: user impersonation |
| 3 | **Mandate `_security.js` in all financial functions** — add `validatePayloadSize` + `sanitizeDeep` + `authenticateRequest` to the 6 unprotected functions | 9 | S | Financial/PII data exposure risk |
| 4 | **Remove sensitive console.log statements** from `stripe-financial-connections.js` and other functions | 8 | XS | Secrets/PII in Netlify function logs |
| 5 | **Add `.env.example` completeness check** — add missing `STRIPE_SECRET_KEY`, `STRIPE_FINANCIAL_CONNECTIONS_RETURN_URL`, `APP_URL` | 7 | XS | New dev onboarding fails silently |

### Tier 2: Structural Safety (3-5 days each)

| # | Improvement | Impact | Effort | Why Next |
|---|------------|--------|--------|---------|
| 6 | **Extend ESLint to cover `netlify/functions/` and `lib/`** — add JS-specific config block, enable key rules | 9 | S | 22,000 LOC with zero lint coverage |
| 7 | **Create shared `resolveActor` auth middleware** — replace 7+ per-function auth copypasta with one reusable, tested utility | 9 | M | Auth divergence is the #1 backend consistency issue |
| 8 | **Add contract tests for top 5 backend functions** — test input validation, auth checks, error paths (mock Supabase) | 9 | M | Zero backend test coverage |
| 9 | **Enable `strict: true` in tsconfig** (incremental: add `// @ts-expect-error` where needed, fix over time) | 8 | M | Missing `noImplicitAny` hides real bugs in shared lib |
| 10 | **Create Zod schemas for all financial function inputs** — replace manual checks with declarative validation | 8 | M | Manual validation is inconsistent and incomplete |

### Tier 3: Architecture Quality (1-2 weeks each)

| # | Improvement | Impact | Effort | Why |
|---|------------|--------|--------|-----|
| 11 | **Extract financial computation logic from functions into `lib/`** — scorecard calc, income detection, cash flow analysis | 8 | M | Logic is trapped in serverless handlers, untestable |
| 12 | **Migrate top 10 backend files to TypeScript** — start with `_security.ts`, `_supabase.ts`, `validation.ts`, then gateway handlers | 8 | L | Type safety at the foundation propagates upward |
| 13 | **Consolidate to one icon library** (Phosphor) — find and replace Lucide/Heroicons usage | 6 | M | Eliminates ~100KB+ from bundle |
| 14 | **Replace Prisma schema** with actual Companion OS entity models (or remove Prisma if Supabase is the source of truth) | 6 | M | Disconnected schema is misleading |
| 15 | **Create shared Supabase query patterns** — typed table helpers, consistent error handling, audit logging | 8 | M | Every function hand-writes `.from().select().eq()` chains |

### Tier 4: Production Hardening (2-4 weeks each)

| # | Improvement | Impact | Effort | Why |
|---|------------|--------|--------|-----|
| 16 | **Add rate limiting/abuse protection** to financial endpoints | 7 | M | Public endpoints with no rate limits |
| 17 | **Structured logging** — replace `console.log`/`console.error` with a logging utility that redacts PII | 7 | M | Debugging without logs is blind; PII in logs is a liability |
| 18 | **Soft-delete for cascade operations** — `stripe-financial-connections.js` does hard DELETE on disconnect | 7 | S | Data loss on Stripe account disconnection |
| 19 | **Add Supabase RLS policy verification** to CI (extend existing contract verify) | 7 | S | RLS misconfiguration = data leak |
| 20 | **Create backend health/smoke endpoint** — simple function that verifies Supabase + Stripe connectivity | 5 | XS | No way to know if backend is healthy |

### Tier 5: Product Polish (Ongoing)

| # | Improvement | Impact | Effort | Why |
|---|------------|--------|--------|-----|
| 21 | **Test coverage for all 21 hooks** (only 6/21 have tests) | 6 | M | Untested hooks break silently |
| 22 | **Page-level integration tests** — Home, ControlCenter, Financial, Automotive | 6 | M | No end-to-end path verification |
| 23 | **Visual regression tests** (Chromatic or Percy) for surface taxonomy | 5 | L | CSS changes can break premium feel |
| 24 | **Error boundary per section** — not just root ErrorFallback | 5 | S | One broken section crashes entire app |
| 25 | **OpenTelemetry/tracing for backend functions** — trace request → auth → DB → response | 5 | L | No observability beyond Netlify's basic logs |

---

## Section 3 — 30 / 60 / 90 / 180 Day Roadmap

### Day 0-30: Safety Net

**Goal**: No broken code can merge. Backend has minimum viable safety.

| Week | Deliverable | Files Touched |
|------|------------|---------------|
| 1 | `ci.yml`: lint + typecheck + test + build on every PR | `.github/workflows/ci.yml` |
| 1 | Fix `_ai-core.js` auth: derive `user_id` from token | `netlify/functions/_ai-core.js` |
| 1 | Add `validatePayloadSize` + `sanitizeDeep` to 6 financial functions | 6 functions in `netlify/functions/` |
| 1 | Remove sensitive console.log/warn (Stripe balances, raw JSON) | `netlify/functions/stripe-financial-connections.js` + others |
| 2 | Extend ESLint to `netlify/functions/` and `lib/` (JS rules) | `eslint.config.js` |
| 2 | Fix all new lint errors (est. 100-200 across 22K LOC) | Backend files |
| 2 | Complete `.env.example` | `.env.example` |
| 3 | Create shared `resolveActor` in `lib/_auth.js` — migrate all functions | New file + 7 function updates |
| 3 | Write 15 contract tests for top 3 functions (financial-intelligence, automotive-finance, _ai-core) | New test files in `netlify/functions/__tests__/` |
| 4 | Enable `strict: true` in tsconfig + fix ~50-100 type errors in `src/` | `tsconfig.json` + scattered `src/` fixes |

**Exit Criteria**: CI blocks broken PRs. Auth is consistent. Financial endpoints validate input. Backend linting catches obvious bugs.

### Day 30-60: Type Foundation

**Goal**: Backend begins TypeScript migration. Core shared libs are typed. Validation is declarative.

| Week | Deliverable |
|------|------------|
| 5 | Migrate `lib/_security.js` → `lib/_security.ts` with full types |
| 5 | Migrate `lib/_supabase.js` → `lib/_supabase.ts` (typed client, `requireSupabase` helper) |
| 5 | Migrate `lib/validation.js` → `lib/validation.ts` |
| 6 | Create Zod schemas for `financial-intelligence.js` inputs (5 action schemas) |
| 6 | Create Zod schemas for `automotive-finance.js` inputs (15+ action schemas) |
| 7 | Migrate `lib/_responses.js` → `lib/_responses.ts` |
| 7 | Migrate `lib/_log.js` → `lib/_log.ts` with PII redaction |
| 7 | Extract financial computation from `financial-scorecard.js` into `lib/financial/scorecard-engine.ts` |
| 8 | Extract income/expense detection from `financial-analysis.js` into `lib/financial/analysis-engine.ts` |
| 8 | Write 20+ unit tests for extracted computation modules |

**Exit Criteria**: Shared libs are typed. Top 2 financial functions use Zod. Financial computation logic is testable outside serverless handlers.

### Day 60-90: Consistency + Polish

**Goal**: Consolidate remaining inconsistencies. Hook test coverage. Icon consolidation.

| Week | Deliverable |
|------|------------|
| 9 | Migrate all 8 `gateway/` handlers to TypeScript |
| 9 | Add tests for 15 more untested hooks (currently 6/21 have tests) |
| 10 | Consolidate icons to Phosphor — find/replace Lucide (est. 15-30 imports) and Heroicons (est. 5-10 imports) |
| 10 | Remove `lucide-react` and `@heroicons/react` from dependencies |
| 11 | Replace Prisma schema with real entity models OR remove Prisma entirely |
| 11 | Add per-section error boundaries (wrap each lazy section) |
| 12 | Structured logging module with PII redaction in all backend functions |

**Exit Criteria**: Gateway is typed. 80%+ hook coverage. Single icon library. Clean entity layer.

### Day 90-180: Full Backend Migration + Observability

**Goal**: Full TypeScript backend. Observability. Deploy previews.

| Milestone | Deliverable |
|-----------|------------|
| Month 4 | Migrate all 10 `lib/automotive/` files to TypeScript |
| Month 4 | Migrate top 10 serverless functions to TypeScript |
| Month 5 | Contract tests for every serverless function (target: 50+ backend tests) |
| Month 5 | Rate limiting middleware for public financial endpoints |
| Month 5 | Netlify deploy previews on PRs (with `netlify.toml` preview config) |
| Month 6 | Remaining serverless functions migrated to TypeScript |
| Month 6 | OpenTelemetry instrumentation for backend request tracing |
| Month 6 | Visual regression testing pipeline |

**Exit Criteria**: Full-TypeScript backend. 150+ backend tests. Observability in place. Every PR gets a deploy preview.

---

## Section 4 — Architecture Plan

### 4.1 Backend Layered Architecture

Currently, every serverless function is a monolith: auth + validation + business logic + DB queries + error handling all in one file. Target architecture:

```
netlify/functions/financial-intelligence.js    ← Thin handler: parse, auth, validate, delegate
  └─► lib/_auth.ts                             ← Shared auth middleware
  └─► lib/validation.ts                        ← Zod schemas
  └─► lib/financial/intelligence-engine.ts     ← Business logic (testable)
      └─► lib/_supabase.ts                     ← Typed DB access
      └─► lib/_log.ts                          ← Structured logging
      └─► lib/_responses.ts                    ← Response formatting
```

**Rules:**
1. Serverless functions are thin dispatchers. Max 100 LOC of glue code per action.
2. All business logic lives in `lib/` domain modules, never in function files.
3. Input validation is Zod-first. Manual `typeof` / truthy checks are banned in new code.
4. Auth uses shared `resolveActor()` from `lib/_auth.ts`. No per-function auth copypasta.
5. All DB access goes through typed helpers (not raw `.from().select().eq()` chains).

### 4.2 Domain Module Boundaries

```
lib/
├── _auth.ts              # Auth middleware (new)
├── _log.ts               # Structured logger with PII redaction (migrate from .js)
├── _responses.ts         # HTTP response helpers (migrate from .js)
├── _security.ts          # Payload validation, sanitization (migrate from .js)
├── _supabase.ts          # Typed Supabase client (migrate from .js)
├── validation.ts         # Shared Zod schemas + domain validators (migrate from .js)
├── financial/            # NEW domain module
│   ├── scorecard-engine.ts
│   ├── analysis-engine.ts
│   ├── intelligence-engine.ts
│   └── types.ts
├── automotive/           # Already exists, migrate to .ts
│   ├── callback-engine.ts
│   ├── compliance-guardrails.ts
│   ├── copilot-intelligence.ts
│   ├── document-intelligence.ts
│   ├── income-engine.ts
│   ├── integration-framework.ts
│   ├── management-governance.ts
│   ├── reporting-engine.ts
│   ├── state-machine.ts
│   ├── structure-engine.ts
│   └── types.ts
├── media/                # Existing
├── realtime/             # Existing
└── autonomous/           # Existing
```

### 4.3 Shared Auth Pattern

Replace the 7+ copypasta `resolveActor` implementations with:

```typescript
// lib/_auth.ts
import { requireSupabase } from './_supabase';

export interface Actor {
  id: string;
  email: string;
  role?: string;
}

export async function resolveActor(event: NetlifyEvent): Promise<Actor> {
  const token = extractBearerToken(event.headers);
  if (!token) throw new AuthError('Missing authorization header', 401);

  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new AuthError('Invalid token', 401);

  return {
    id: data.user.id,
    email: data.user.email ?? '',
    role: data.user.app_metadata?.role,
  };
}
```

### 4.4 Validation Pattern

Replace manual validation with Zod schemas:

```typescript
// Inside each function or in lib/financial/schemas.ts
import { z } from 'zod';

const ExtractDocumentSchema = z.object({
  action: z.literal('extract_document'),
  storagePath: z.string().min(1),
  filename: z.string().min(1),
  documentType: z.enum(['bank_statement', 'credit_card', 'pay_stub', 'tax_return']).optional(),
});

const FinancialIntelligenceInput = z.discriminatedUnion('action', [
  ExtractDocumentSchema,
  // ... other action schemas
]);
```

### 4.5 Frontend Architecture (Already Good — Minor Improvements)

```
src/
├── app-shell/            # ✅ Clean — routing, navigation, section registry, telemetry
├── components/           # ✅ Good — Radix-based, domain-specific
├── context/              # ✅ Good — Auth, AI control, settings, theme
├── hooks/                # ⚠️  Only 6/21 tested
├── pages/                # ⚠️  Only 1 test (Login)
├── services/             # ✅ Good — 20 test files
├── lib/                  # ✅ Good — env-guard, supabase-client, utils
├── store/                # Audit needed
├── styles/               # ✅ Surface taxonomy
├── types/                # ✅ 5 test files for type contracts
└── test/                 # ⚠️  Setup is minimal (18 LOC, no shared mocks)
```

---

## Section 5 — CI/CD Plan

### 5.1 Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run test:ci

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: https://placeholder.supabase.co
          VITE_SUPABASE_PUBLISHABLE_KEY: placeholder
          VITE_SUPABASE_ANON_KEY: placeholder
```

### 5.2 ESLint Backend Coverage

Add to `eslint.config.js`:

```javascript
// Remove 'netlify/functions' and 'lib' from ignores
{ ignores: ['dist', 'node_modules', 'scripts', '**/*.d.ts'] },

// Add JS backend config block
{
  files: ['netlify/functions/**/*.js', 'lib/**/*.js'],
  extends: [js.configs.recommended],
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-constant-condition': 'warn',
    'no-duplicate-case': 'error',
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
  },
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: {
      console: 'readonly',
      process: 'readonly',
      Buffer: 'readonly',
      URL: 'readonly',
      Response: 'readonly',
      fetch: 'readonly',
    },
  },
},
```

### 5.3 Branch Protection

After CI is green, enable branch protection on `main`:
- Require `lint`, `typecheck`, `test`, `build` to pass
- Require PR review
- No force-push

### 5.4 Secret Scanning

Already implemented via pre/post-build scripts. Strengthen with:
- GitHub's built-in secret scanning (enable in repo settings)
- Add `npm audit --audit-level=high` to CI

---

## Section 6 — Test Strategy

### 6.1 Current State

| Area | Files | Tests | Coverage |
|------|-------|-------|----------|
| `src/services/` | 20 | ~400 | Good |
| `src/hooks/` | 6 | ~60 | 29% of hooks |
| `src/types/` | 5 | ~50 | Good (contract tests) |
| `src/app-shell/` | 2 | ~30 | Good for shell |
| `src/context/` | 2 | ~20 | Auth + settings only |
| `src/components/` | 2 | ~15 | Minimal |
| `src/pages/` | 1 | ~5 | Login only |
| `src/lib/` | 5 | ~40 | Moderate |
| `netlify/functions/` | 0 | 0 | Zero |
| `lib/` | 0 | 0 | Zero |
| **Total** | **51** | **~888** | Frontend-only |

### 6.2 Test Infrastructure Upgrades

**Upgrade `src/test/setup.ts`:**

```typescript
import '@testing-library/jest-dom/vitest';

// Env stubs
process.env.OPENAI_API_KEY = 'test-dummy-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-dummy-key';
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-dummy-key';

// matchMedia polyfill
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Global fetch mock (prevent accidental network calls)
globalThis.fetch = vi.fn().mockRejectedValue(
  new Error('Unmocked fetch call — add a specific mock for this test')
);
```

**Create `src/test/mocks/supabase.ts`:**

Factory for creating typed Supabase mock clients, reusable across tests.

**Create `src/test/mocks/router.ts`:**

Wrapper around `MemoryRouter` for testing routed components.

### 6.3 Backend Test Strategy

**Create `netlify/functions/__tests__/` directory.**

**Test structure per function:**

```
netlify/functions/__tests__/
├── _ai-core.test.js
├── financial-intelligence.test.js
├── financial-analysis.test.js
├── financial-scorecard.test.js
├── automotive-finance.test.js
├── automotive-management.test.js
├── stripe-financial-connections.test.js
└── helpers/
    ├── mock-event.js        # Factory for Netlify event objects
    ├── mock-supabase.js     # Supabase client mock
    └── mock-stripe.js       # Stripe SDK mock
```

**What to test per function:**

1. **Auth enforcement**: Missing token → 401. Invalid token → 401. Valid token → proceeds.
2. **Input validation**: Missing required fields → 400 with field name. Invalid types → 400. Oversized payloads → 413.
3. **Action routing**: Each supported action dispatches correctly. Unknown action → 400.
4. **Error handling**: DB failure → 500 with safe message (no internal details leaked). Stripe failure → appropriate error.
5. **Permission checks**: (For automotive-management) Wrong role → 403.

**Configure Vitest for backend tests:**

Add a second Vitest project in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    projects: [
      {
        // Frontend tests
        test: {
          name: 'frontend',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        // Backend tests
        test: {
          name: 'backend',
          environment: 'node',
          include: ['netlify/functions/__tests__/**/*.test.{js,ts}', 'lib/**/*.test.{js,ts}'],
        },
      },
    ],
  },
});
```

### 6.4 Priority Test Targets

**Hooks (15 untested):**

| Hook | Test Priority | Risk |
|------|--------------|------|
| `useFinancialData` | High | Financial state |
| `useSubscription` | High | Billing state |
| `useCompanionConfig` | High | AI config |
| `useMediaGeneration` | Medium | Media state |
| `useModelConfig` | Medium | Model selection |
| `useVoice` | Medium | Voice state |
| `useTheme` | Low | Visual only |
| `useDebounce` | Low | Utility |

**Pages (0 tested except Login):**

| Page | Test Priority | Why |
|------|--------------|-----|
| HomeDashboard | High | Primary landing, multiple data sources |
| FinancialDashboard | High | Financial data display |
| AutomotiveDashboard | High | Deal pipeline, metrics |
| ControlCenterView | Medium | Settings complexity |
| ChatPage | Medium | Message flow |

---

## Section 7 — Visual + Layout Hardening

### 7.1 Surface Taxonomy Governance

The 5-tier surface taxonomy (core/instrument/telemetry/dock/console) is well-designed. Harden it:

**Create `src/styles/surfaces.md` — Design System Docs:**

| Surface | Use Case | Allowed Content | Max Nesting |
|---------|----------|----------------|-------------|
| `.surface-core` | Page background | Sections, grids | 1 |
| `.surface-instrument` | Cards, panels | Data, controls | 2 |
| `.surface-telemetry` | Status indicators | Metrics, badges | 1 |
| `.surface-dock` | Toolbar areas | Actions, navigation | 1 |
| `.surface-console` | Command/terminal | Text, inputs | 2 |

**Rules:**
- Never nest more than 2 surfaces deep
- `surface-instrument` is the default card surface — don't use raw `div` with manual bg/border
- Status/metric displays always use `surface-telemetry`
- Command/input areas always use `surface-console`

### 7.2 Page Template Pattern

Create reusable page layout templates:

```tsx
// src/components/layouts/page-template.tsx
interface PageTemplateProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageTemplate({ title, subtitle, actions, children }: PageTemplateProps) {
  return (
    <div className="surface-core p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-white/50 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
```

### 7.3 Icon Consolidation Plan

**Current state:**
- `@phosphor-icons/react` — Primary. Used in 40+ components.
- `lucide-react` — Used in ~20 imports (estimate). Mostly in shadcn components.
- `@heroicons/react` — Used in ~8 imports (estimate). Scattered.

**Migration:**
1. `grep` all Lucide imports → map each to Phosphor equivalent
2. `grep` all Heroicons imports → map each to Phosphor equivalent
3. Replace imports file by file
4. Remove `lucide-react` and `@heroicons/react` from `package.json`
5. Remove their Vite chunk splits from `vite.config.ts`

**Estimated bundle savings:** 80-120KB gzipped.

### 7.4 Motion Rules

| Interaction | Duration | Easing | Property |
|------------|----------|--------|----------|
| Page transition | 200ms | ease-out | opacity, transform |
| Panel expand | 250ms | ease-in-out | height, opacity |
| Card hover | 150ms | ease | border-color, box-shadow |
| Status pulse | 2000ms | linear | opacity (loop) |
| Toast enter | 300ms | spring(1, 80, 10) | transform, opacity |

**Rule: No motion > 400ms.** Premium feels fast, not slow.

---

## Section 8 — Highest-Risk Files (Ranked)

| Rank | File | LOC | Risk | Why |
|------|------|-----|------|-----|
| 1 | `netlify/functions/stripe-financial-connections.js` | 890 | **CRITICAL** | Real bank data via Stripe. No auth middleware. No payload validation. Sensitive console.log. Hard DELETEs. |
| 2 | `netlify/functions/_ai-core.js` | 800 | **CRITICAL** | Chat path accepts `user_id` from body (impersonation). Only function using `_security.js` but auth gap on primary path. |
| 3 | `netlify/functions/financial-intelligence.js` | 890 | **HIGH** | PDF/bank statement ingestion. No payload size limit. No `_security.js`. Raw document text piped to AI. |
| 4 | `netlify/functions/automotive-management.js` | 1010 | **HIGH** | Largest function. Has RBAC but no `_security.js`. Manages commissions, coaching notes, deal metrics. |
| 5 | `netlify/functions/financial-analysis.js` | 900 | **HIGH** | Duplicated `add_manual_income` handler. Income/expense detection embedded (untestable). No `_security.js`. |
| 6 | `netlify/functions/automotive-finance.js` | 730 | **HIGH** | 13 parallel Supabase queries with no individual error handling. Captures IP address (PII). No `_security.js`. |
| 7 | `netlify/functions/financial-scorecard.js` | 720 | **MEDIUM** | Inserts new snapshot on every computation (unbounded row growth). Computation logic embedded. |
| 8 | `lib/life-coordination-engine.js` | 763 | **MEDIUM** | Largest lib file. Compute-heavy. No types. |
| 9 | `lib/orchestrator.js` | 443 | **MEDIUM** | Central routing logic. No types. |
| 10 | `lib/automotive/structure-engine.js` | 436 | **MEDIUM** | Deal math (APR, payment, amount financed). Correctness is critical. No tests, no types. |

### Per-File Remediation

**#1 — `stripe-financial-connections.js`:**
- [ ] Add `authenticateRequest()` from `_security.js` at handler entry
- [ ] Add `validatePayloadSize()` at handler entry
- [ ] Replace all `console.log(JSON.stringify(balance))` with redacted logging
- [ ] Change `handleRemoveAccount` to soft-delete (add `deleted_at` column, filter in queries)
- [ ] Extract `classifyCategory()` to `lib/financial/transaction-classifier.ts`
- [ ] Move `STRIPE_SECRET_KEY` read inside handler (not module scope)

**#2 — `_ai-core.js`:**
- [ ] In chat handler: derive `user_id` from `authenticateRequest()` result, ignore body `user_id`
- [ ] Apply `sanitizeDeep()` to full parsed body (already does `validatePayloadSize`)
- [ ] Fix pseudo-stream: either implement real SSE or document as "chunked response" (not streaming)

**#3 — `financial-intelligence.js`:**
- [ ] Add `validatePayloadSize()` + `sanitizeDeep()` + `authenticateRequest()`
- [ ] Limit raw document text to configurable max before sending to AI (prevent token bill explosion)
- [ ] Extract `extractStructuredData()`, `classifyDocument()` to `lib/financial/intelligence-engine.ts`

**#4 — `automotive-management.js`:**
- [ ] Add `validatePayloadSize()` + `sanitizeDeep()`
- [ ] Wrap `resolveActor` in try/catch
- [ ] Add contract tests for permission enforcement paths

**#5 — `financial-analysis.js`:**
- [ ] Remove duplicated `add_manual_income` handler
- [ ] Add `validatePayloadSize()` + `sanitizeDeep()` + `authenticateRequest()`
- [ ] Extract `detectRecurringIncome()`, `detectRecurringExpenses()`, `computeCashFlow()` to `lib/financial/analysis-engine.ts`

**#6 — `automotive-finance.js`:**
- [ ] Add `validatePayloadSize()` + `sanitizeDeep()`
- [ ] Add `.catch()` or individual error handling to the 13 parallel Supabase queries in `loadDashboard`
- [ ] Document IP capture in `captureAcknowledgment` (privacy policy reference)

**#7 — `financial-scorecard.js`:**
- [ ] Change snapshot insert to upsert (one per user per day) to prevent unbounded growth
- [ ] Extract `computeScorecard()` to `lib/financial/scorecard-engine.ts`

---

## Section 9 — Implementation Order (Safe Sequencing)

This order ensures each step builds on the previous without breaking shipping velocity.

### Phase A: Gates (Days 1-3) — Ship CI before anything else

```
Step 1: Create .github/workflows/ci.yml                          [new file]
Step 2: Fix _ai-core.js auth gap (user_id from token)            [edit]
Step 3: Run CI — expect it to pass on current code                [verify]
Step 4: Enable branch protection on main                          [repo settings]
```

**Checkpoint**: Every future PR is gated by lint + typecheck + test + build.

### Phase B: Security Hardening (Days 4-7)

```
Step 5: Add _security.js usage to 6 financial functions           [6 edits]
Step 6: Remove sensitive console.log statements                   [4-5 edits]
Step 7: Complete .env.example                                     [edit]
Step 8: Fix financial-analysis.js duplicated handler              [edit]
Step 9: Move STRIPE_SECRET_KEY read inside handler                [edit]
```

**Checkpoint**: All financial endpoints validate input, authenticate requests, and don't leak PII in logs.

### Phase C: Lint Coverage (Days 8-12)

```
Step 10: Update eslint.config.js — remove backend from ignores   [edit]
Step 11: Add JS backend lint config block                         [edit]
Step 12: Run lint — fix all errors (batch by file)                [many edits]
Step 13: CI now gates backend lint                                [automatic]
```

**Checkpoint**: 22,000 LOC of backend code is linted.

### Phase D: Auth Consolidation (Days 13-16)

```
Step 14: Create lib/_auth.js — shared resolveActor                [new file]
Step 15: Migrate _ai-core.js to use lib/_auth.js                  [edit]
Step 16: Migrate financial-intelligence.js                        [edit]
Step 17: Migrate remaining 5 audited functions                    [5 edits]
Step 18: Migrate remaining functions (grep for getAuthToken)      [~10+ edits]
```

**Checkpoint**: Single auth pattern across all functions.

### Phase E: Backend Tests (Days 17-24)

```
Step 19: Configure Vitest backend project (node environment)      [edit vitest.config.ts]
Step 20: Create test helpers (mock-event, mock-supabase)          [new files]
Step 21: Write _ai-core tests (auth, validation, routing)         [new file, ~10 tests]
Step 22: Write financial-intelligence tests                       [new file, ~8 tests]
Step 23: Write automotive-finance tests                           [new file, ~10 tests]
Step 24: Write stripe-financial-connections tests                 [new file, ~8 tests]
Step 25: Write automotive-management tests                        [new file, ~8 tests]
```

**Checkpoint**: 40+ backend tests. Top 5 functions have contract tests.

### Phase F: TypeScript Strict + Core Migration (Days 25-35)

```
Step 26: Enable strict: true in tsconfig.json                     [edit]
Step 27: Fix resulting type errors in src/ (~50-100)              [many edits]
Step 28: Migrate lib/_security.js → .ts                           [rename + add types]
Step 29: Migrate lib/_supabase.js → .ts                           [rename + add types]
Step 30: Migrate lib/_responses.js → .ts                          [rename + add types]
Step 31: Migrate lib/validation.js → .ts                          [rename + add types]
Step 32: Migrate lib/_log.js → .ts + add PII redaction            [rename + enhance]
Step 33: Create lib/_auth.ts (upgrade from .js in Step 14)        [migrate]
```

**Checkpoint**: Shared libs are fully typed. TypeScript strict mode enforced.

### Phase G: Zod Schemas + Logic Extraction (Days 36-50)

```
Step 34: Create Zod schemas for financial-intelligence inputs     [new file]
Step 35: Create Zod schemas for automotive-finance inputs         [new file]
Step 36: Wire Zod into those 2 functions                          [2 edits]
Step 37: Extract financial computation → lib/financial/           [new files]
Step 38: Write tests for extracted computation modules            [new files, ~20 tests]
Step 39: Update functions to delegate to lib/financial/           [3 edits]
```

**Checkpoint**: Top financial functions have declarative validation. Business logic is testable.

### Phase H: Icon Consolidation + Cleanup (Days 51-60)

```
Step 40: Grep all lucide-react imports, create migration map      [research]
Step 41: Replace Lucide imports with Phosphor equivalents          [~20 edits]
Step 42: Grep all @heroicons/react imports                        [research]
Step 43: Replace Heroicons imports with Phosphor equivalents       [~8 edits]
Step 44: Remove lucide-react and @heroicons/react from deps       [edit package.json]
Step 45: Remove icon chunk splits from vite.config.ts             [edit]
Step 46: Replace or remove Prisma schema                          [edit/delete]
```

**Checkpoint**: Single icon library. ~100KB saved. Clean dependency tree.

### Phase I: Hook + Page Tests (Days 61-75)

```
Step 47: Create shared test utilities (router mock, supabase mock) [new files]
Step 48: Write tests for 15 untested hooks                        [15 new test files]
Step 49: Write smoke tests for HomeDashboard                      [new file]
Step 50: Write smoke tests for FinancialDashboard                 [new file]
Step 51: Write smoke tests for AutomotiveDashboard                [new file]
Step 52: Add per-section error boundaries                         [edit section-registry.tsx]
```

**Checkpoint**: 80%+ hook coverage. Key pages have smoke tests. Error isolation per section.

### Phase J: Full Backend TypeScript (Days 76-120)

```
Step 53: Migrate 8 gateway/ handlers to TypeScript                [8 renames + types]
Step 54: Migrate 10 lib/automotive/ files to TypeScript            [10 renames + types]
Step 55: Migrate top 10 serverless functions to TypeScript         [10 renames + types]
Step 56: Contract tests for every migrated function               [test files]
Step 57: Migrate remaining serverless functions                   [~44 renames + types]
Step 58: Remove allowJs from tsconfig                             [edit]
```

**Checkpoint**: Full-TypeScript codebase. `allowJs: false`. All backend code typed and tested.

---

## Appendix A: Environment & Schema Assumptions

### Environment Variables Required

| Variable | Used By | Sensitivity |
|----------|---------|-------------|
| `SUPABASE_URL` | Backend | Medium |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | **Critical** — never expose to frontend |
| `VITE_SUPABASE_URL` | Frontend | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Public |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Public |
| `OPENAI_API_KEY` | Backend | High |
| `GEMINI_API_KEY` | Backend | High |
| `STRIPE_SECRET_KEY` | Backend | **Critical** |
| `STRIPE_FINANCIAL_CONNECTIONS_RETURN_URL` | Backend | Low |
| `BRAVE_SEARCH_API_KEY` | Backend | Medium |
| `GOOGLE_MAPS_API_KEY` | Backend | Medium |

### Supabase Tables Referenced
(Across audited functions — 30+ tables. Key ones:)

| Table | Function(s) | Contains PII |
|-------|------------|-------------|
| `financial_accounts` | scorecard, analysis, connections | Yes (institution, last4) |
| `normalized_transactions` | connections | Yes (amount, merchant) |
| `financial_documents` | intelligence | Yes (statements) |
| `automotive_deals` | finance, management | Yes (customer data) |
| `automotive_commission_records` | management | Yes (amounts) |
| `messages` | _ai-core | Yes (user messages) |
| `billing_customers` | connections | Yes (email) |

### Prisma Status

The Prisma schema contains models for a completely different product (TarotCard, ReadingSession, SpiritProfile, ZodiacSign). Options:
1. **Replace** with actual Companion OS entity models (if you want Prisma as schema documentation)
2. **Remove** Prisma entirely (if Supabase migrations are the source of truth)

Recommendation: **Option 2** — remove Prisma. Supabase migrations under `supabase/migrations/` are the actual source of truth. Having a disconnected Prisma schema is actively misleading.

---

## Appendix B: QA / Verification Checklist

### After Phase A (CI Gates)
- [ ] Push a PR with a type error — verify CI blocks it
- [ ] Push a PR with a lint error — verify CI blocks it
- [ ] Push a PR with a failing test — verify CI blocks it
- [ ] Push a PR with a build error — verify CI blocks it
- [ ] Verify branch protection is enforced on `main`

### After Phase B (Security)
- [ ] Send a request to `_ai-core` with a spoofed `user_id` — verify it uses token instead
- [ ] Send a > 256KB payload to each financial function — verify 413 response
- [ ] Send a request with XSS in string fields — verify `sanitizeDeep` strips it
- [ ] Search Netlify function logs for raw financial data — verify it's gone
- [ ] Verify `.env.example` has all variables needed for a cold start

### After Phase C (Lint)
- [ ] Run `npm run lint` — verify zero errors across ALL files (including backend)
- [ ] Verify CI enforces lint on backend file changes

### After Phase D (Auth)
- [ ] Send an unauthenticated request to each function — verify consistent 401
- [ ] Send an expired token — verify consistent 401
- [ ] Verify no function still has its own `getAuthToken`/`resolveActor` (grep)

### After Phase E (Backend Tests)
- [ ] Run `npm run test` — verify both frontend and backend projects run
- [ ] Verify 40+ backend tests pass
- [ ] Verify CI runs backend tests on netlify/functions/* changes

### After Phase F (Strict TS)
- [ ] Run `npm run typecheck` with strict: true — verify zero errors
- [ ] Verify `lib/_security.ts`, `lib/_supabase.ts`, `lib/validation.ts` export typed interfaces

### After Phase G (Zod + Extraction)
- [ ] Send malformed JSON to financial-intelligence — verify Zod error message
- [ ] Import `computeScorecard` from `lib/financial/` — verify it works standalone (no HTTP context needed)

### After Phase H (Icons)
- [ ] `grep -r "lucide-react" src/` — verify zero results
- [ ] `grep -r "@heroicons/react" src/` — verify zero results
- [ ] Compare bundle size before/after — verify reduction

### After Phase I (Hook + Page Tests)
- [ ] Run `npm run test` — verify 1000+ total tests
- [ ] Verify HomeDashboard renders without data
- [ ] Verify error boundaries catch and display section-level errors

### After Phase J (Full TS)
- [ ] Verify `allowJs: false` in tsconfig.json
- [ ] `find netlify/functions lib -name "*.js"` — verify zero results (all migrated)
- [ ] Run full build — verify clean

---

## Final Summary

### What becomes materially better:

1. **CI safety** — broken code cannot merge to main
2. **Backend security** — all endpoints validate input, authenticate via shared middleware, redact PII
3. **Auth consistency** — one pattern, one function, no copypasta
4. **Type safety** — full `strict: true`, shared libs typed, Zod validation at boundaries
5. **Test coverage** — from 888 frontend-only tests to 1000+ tests including 50+ backend contract tests
6. **Lint coverage** — from frontend-only to full-codebase
7. **Bundle size** — ~100KB reduction from icon consolidation
8. **Architecture** — business logic extracted from serverless handlers into testable domain modules

### What becomes premium/credible:

- Financial endpoints that properly validate, authenticate, and protect PII
- An automotive deal system with consistent RBAC, state machines, and audit trails
- A codebase where every change is gated by lint + types + tests + build
- A surface taxonomy with documented rules and governance
- Backend that can be confidently extended by any engineer

### What product claims become supportable:

- "Enterprise-grade security" → auth middleware, input validation, PII redaction, payload limits
- "Financial intelligence" → typed, tested computation engines with audit trails
- "Automotive F&I platform" → RBAC, state machines, compliance guardrails, all tested
- "Premium operating environment" → consistent design system, fast bundle, clean architecture

### What still belongs in future phases:

- OpenTelemetry/distributed tracing
- Rate limiting/DDoS protection
- Visual regression testing
- Real-time SSE streaming from AI providers (currently pseudo-stream)
- Supabase RLS policy automation
- Deploy previews per PR
- E2E tests (Playwright)
- Multi-tenant data isolation verification
- Webhook ingestion hardening
- Mobile-responsive audit of all pages
