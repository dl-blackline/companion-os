// ─── Async Result Wrappers ────────────────────────────────────────────────────
// Discriminated unions for type-safe async state management across all services.

/** Idle state — no operation has been initiated. */
export interface AsyncIdle {
  readonly status: 'idle';
}

/** Loading state — operation is in progress. */
export interface AsyncLoading {
  readonly status: 'loading';
  /** Optional progress indicator (0–1). */
  readonly progress?: number;
}

/** Success state — operation completed with data. */
export interface AsyncSuccess<T> {
  readonly status: 'success';
  readonly data: T;
  readonly completedAt: number;
}

/** Error state — operation failed. */
export interface AsyncError {
  readonly status: 'error';
  readonly error: AppError;
  readonly failedAt: number;
}

/** Processing state — long-running job submitted and being processed. */
export interface AsyncProcessing {
  readonly status: 'processing';
  readonly jobId: string;
  /** Optional progress indicator (0–1). */
  readonly progress?: number;
  readonly startedAt: number;
}

/** Retrying state — a failed operation is being retried. */
export interface AsyncRetrying {
  readonly status: 'retrying';
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly lastError: AppError;
}

/** Discriminated union covering all async lifecycle states. */
export type AsyncResult<T> =
  | AsyncIdle
  | AsyncLoading
  | AsyncSuccess<T>
  | AsyncError
  | AsyncProcessing
  | AsyncRetrying;

// ─── Error Types ──────────────────────────────────────────────────────────────

/** Structured error categories for consistent error handling. */
export type ErrorCategory =
  | 'validation'
  | 'network'
  | 'auth'
  | 'not_found'
  | 'rate_limit'
  | 'server'
  | 'timeout'
  | 'file_too_large'
  | 'unsupported_format'
  | 'processing_failed'
  | 'unknown';

/** Typed application error. */
export interface AppError {
  readonly category: ErrorCategory;
  readonly message: string;
  readonly code?: string;
  /** Machine-readable details for debugging. */
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function idle(): AsyncIdle {
  return { status: 'idle' };
}

export function loading(progress?: number): AsyncLoading {
  return { status: 'loading', progress };
}

export function success<T>(data: T): AsyncSuccess<T> {
  return { status: 'success', data, completedAt: Date.now() };
}

export function error(err: AppError): AsyncError {
  return { status: 'error', error: err, failedAt: Date.now() };
}

export function processing(jobId: string, progress?: number): AsyncProcessing {
  return { status: 'processing', jobId, progress, startedAt: Date.now() };
}

export function retrying(attempt: number, maxAttempts: number, lastError: AppError): AsyncRetrying {
  return { status: 'retrying', attempt, maxAttempts, lastError };
}

export function appError(
  category: ErrorCategory,
  message: string,
  opts?: { code?: string; details?: Record<string, unknown>; retryable?: boolean },
): AppError {
  return {
    category,
    message,
    code: opts?.code,
    details: opts?.details,
    retryable: opts?.retryable ?? false,
  };
}

/** Type-guard helpers */
export function isSuccess<T>(r: AsyncResult<T>): r is AsyncSuccess<T> {
  return r.status === 'success';
}
export function isError<T>(r: AsyncResult<T>): r is AsyncError {
  return r.status === 'error';
}
export function isLoading<T>(r: AsyncResult<T>): r is AsyncLoading {
  return r.status === 'loading';
}
export function isIdle<T>(r: AsyncResult<T>): r is AsyncIdle {
  return r.status === 'idle';
}
