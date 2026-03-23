/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_ANON_KEY: string | undefined
  readonly VITE_AI_PRIMARY_MODEL: string | undefined
  readonly VITE_AI_FALLBACK_MODEL: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}