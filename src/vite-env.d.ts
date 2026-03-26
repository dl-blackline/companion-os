/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

// ─── Web Speech API (not yet in lib.dom.d.ts) ────────────────────────────────
interface SpeechRecognition extends EventTarget {
  grammars: SpeechGrammarList;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: Event & { error: string; message: string }) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
}
declare var SpeechRecognition: {
  new(): SpeechRecognition;
  prototype: SpeechRecognition;
};
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined
  readonly VITE_SUPABASE_ANON_KEY: string | undefined
  readonly VITE_AI_PRIMARY_MODEL: string | undefined
  readonly VITE_AI_FALLBACK_MODEL: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}