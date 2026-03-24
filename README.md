# Companion OS

Production-ready AI companion platform built with React + Vite, Netlify Functions, and Supabase.

## Architecture
- Frontend: Vite + React + TypeScript in src/
- Backend: Netlify Functions in netlify/functions/
- AI orchestration: Unified gateway in netlify/functions/ai-orchestrator.js
- Persistence: Supabase Postgres + Storage + Auth
- Shared model catalog: lib/model-registry.js exposed via /.netlify/functions/models

## Local Development
1. Install dependencies:
   - npm install
2. Start local app:
   - npm run dev
3. Run tests:
   - npm run test
4. Build production bundle:
   - npm run build

## Environment Contract
Frontend (public, VITE_):
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY (preferred)
- VITE_SUPABASE_ANON_KEY (legacy fallback)

Backend/server-only:
- SUPABASE_URL
- SUPABASE_ANON_KEY (server access)
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY (when using OpenAI-backed models/features)
- NOFILTER_GPT_API_KEY (if enabling NoFilter provider)

Important:
- Never put service-role or sb_secret_* keys into VITE_* variables.
- Browser code accepts only publishable/anon public keys.

## Database and Schema Requirements
Required Supabase tables and policies include:
- user_preferences
- profiles
- messages (or CHAT_HISTORY_TABLE override)
- user_identity_profiles (migration 016)

Critical migration:
- Apply supabase/migrations/016_user_identity_profiles.sql before enabling identity generation in production.

## Auth and Session Behavior
- App uses Supabase auth session restore on boot.
- Password reset emails redirect to /reset-password.
- Recovery flow is handled in ProtectedRoute and updates password through Supabase auth.updateUser.
- Chat requests require bearer auth and bind server-side user_id to authenticated user.

## Chat Contract (Canonical)
Frontend -> /.netlify/functions/ai-orchestrator with:
- type: "chat"
- input:
  - message (string)
  - conversation_id (string)
  - user_id (string, overwritten server-side from auth)
  - model (string, optional)
  - conversation_history (optional recent turns)
  - media_url/media_type (optional)

Backend behavior:
- Accepts both data and input envelopes.
- Normalizes camelCase/snake_case chat fields.
- Returns consistent payload with response and optional media_url/media_type.

## Model/Provider Contract
- Single source of truth: lib/model-registry.js
- Frontend model selectors pull from /.netlify/functions/models
- Local cache is in src/utils/model-cache.js
- Avoid hardcoding model options in views

## Deployment Notes (Netlify)
- Build command: npm run build
- Functions dir: netlify/functions
- Keep SECRETS_SCAN_OMIT_KEYS aligned with public VITE_* keys and SUPABASE_ANON_KEY if that key is intentionally embedded as public anon value.
- Ensure Supabase redirect URL allow-list includes your production /reset-password URL.

## Operational Checklist (Pre-Deploy)
1. Verify environment variables are set with correct key types.
2. Run npm run test and npm run build.
3. Confirm migration 016 is applied in target Supabase project.
4. Smoke test:
   - signup/login/logout
   - forgot password + reset-password flow
   - chat send/receive with persisted history
   - settings + user preferences persist/reload
   - user identity generation/select/save/reload

## Security and Logging
- Function handlers return explicit validation/auth errors.
- Payload size and sanitization checks run in AI gateway.
- Avoid logging secrets or raw credentials.

## License
MIT. See LICENSE.
