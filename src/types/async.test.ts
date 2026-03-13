import { describe, it, expect } from 'vitest';
import {
  idle,
  loading,
  success,
  error,
  processing,
  retrying,
  appError,
  isSuccess,
  isError,
  isLoading,
  isIdle,
} from '@/types/async';
import type { AsyncResult, AppError } from '@/types/async';

describe('AsyncResult helpers', () => {
  it('idle() returns idle state', () => {
    const state = idle();
    expect(state.status).toBe('idle');
  });

  it('loading() returns loading state with optional progress', () => {
    const state = loading(0.5);
    expect(state.status).toBe('loading');
    expect(state.progress).toBe(0.5);
  });

  it('loading() without progress has undefined progress', () => {
    const state = loading();
    expect(state.status).toBe('loading');
    expect(state.progress).toBeUndefined();
  });

  it('success() wraps data with completedAt timestamp', () => {
    const state = success({ foo: 'bar' });
    expect(state.status).toBe('success');
    if (state.status === 'success') {
      expect(state.data).toEqual({ foo: 'bar' });
      expect(state.completedAt).toBeGreaterThan(0);
    }
  });

  it('error() creates error state with failedAt', () => {
    const err = appError('network', 'Connection failed', { retryable: true });
    const state = error(err);
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.error.category).toBe('network');
      expect(state.error.message).toBe('Connection failed');
      expect(state.error.retryable).toBe(true);
      expect(state.failedAt).toBeGreaterThan(0);
    }
  });

  it('processing() creates processing state with jobId', () => {
    const state = processing('job-123', 0.3);
    expect(state.status).toBe('processing');
    if (state.status === 'processing') {
      expect(state.jobId).toBe('job-123');
      expect(state.progress).toBe(0.3);
      expect(state.startedAt).toBeGreaterThan(0);
    }
  });

  it('retrying() creates retry state with attempt info', () => {
    const err = appError('server', 'Internal error');
    const state = retrying(2, 3, err);
    expect(state.status).toBe('retrying');
    if (state.status === 'retrying') {
      expect(state.attempt).toBe(2);
      expect(state.maxAttempts).toBe(3);
      expect(state.lastError.category).toBe('server');
    }
  });

  it('appError() creates structured error with defaults', () => {
    const err = appError('validation', 'Invalid input');
    expect(err.category).toBe('validation');
    expect(err.message).toBe('Invalid input');
    expect(err.retryable).toBe(false); // default
    expect(err.code).toBeUndefined();
  });

  it('appError() with all options', () => {
    const err = appError('rate_limit', 'Too many requests', {
      code: 'RATE_429',
      details: { retryAfter: 60 },
      retryable: true,
    });
    expect(err.category).toBe('rate_limit');
    expect(err.code).toBe('RATE_429');
    expect(err.details).toEqual({ retryAfter: 60 });
    expect(err.retryable).toBe(true);
  });
});

describe('AsyncResult type guards', () => {
  it('isSuccess correctly identifies success state', () => {
    const s = success('data');
    expect(isSuccess(s)).toBe(true);
    expect(isError(s)).toBe(false);
    expect(isLoading(s)).toBe(false);
    expect(isIdle(s)).toBe(false);
  });

  it('isError correctly identifies error state', () => {
    const e = error(appError('server', 'fail'));
    expect(isError(e)).toBe(true);
    expect(isSuccess(e)).toBe(false);
  });

  it('isLoading correctly identifies loading state', () => {
    const l = loading();
    expect(isLoading(l)).toBe(true);
    expect(isIdle(l)).toBe(false);
  });

  it('isIdle correctly identifies idle state', () => {
    const i = idle();
    expect(isIdle(i)).toBe(true);
    expect(isLoading(i)).toBe(false);
  });

  it('type guards narrow types correctly in conditional', () => {
    const result: AsyncResult<string> = success('hello');
    if (isSuccess(result)) {
      // TypeScript should narrow to AsyncSuccess<string>
      expect(result.data).toBe('hello');
      expect(result.completedAt).toBeGreaterThan(0);
    }
  });
});

describe('discriminated union exhaustiveness', () => {
  it('AsyncResult covers all status variants', () => {
    const states: AsyncResult<string>[] = [
      idle(),
      loading(),
      success('ok'),
      error(appError('unknown', 'err')),
      processing('job-1'),
      retrying(1, 3, appError('server', 'fail')),
    ];

    const statuses = states.map(s => s.status);
    expect(statuses).toEqual([
      'idle', 'loading', 'success', 'error', 'processing', 'retrying',
    ]);
  });
});
