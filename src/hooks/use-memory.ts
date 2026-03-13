// ─── useMemory Hook ───────────────────────────────────────────────────────────
// Typed hook for memory CRUD, search, and injection plan management.

import { useState, useCallback, useRef } from 'react';
import type {
  AsyncResult,
  Memory,
  MemorySearchResult,
  MemoryInjectionPlan,
  MemoryIngestionInput,
  MemoryRetrievalQuery,
  MemoryClassificationResult,
  MemorySource,
} from '@/types';
import { idle, loading } from '@/types';
import {
  saveMemory,
  searchMemories,
  buildInjectionPlan,
  classifyMemoryContent,
} from '@/services/memory-service';

interface UseMemoryReturn {
  /** State of the last save operation. */
  saveState: AsyncResult<Memory>;
  /** State of the last search operation. */
  searchState: AsyncResult<MemorySearchResult>;
  /** Current injection plan (what memories are active). */
  injectionPlan: MemoryInjectionPlan | null;
  /** Save a new memory. */
  save: (input: MemoryIngestionInput) => Promise<void>;
  /** Search memories by query. */
  search: (query: MemoryRetrievalQuery) => Promise<void>;
  /** Classify content without saving (preview). */
  classify: (content: string, source?: MemorySource) => MemoryClassificationResult;
  /** Build injection plan from search results + session overrides. */
  buildPlan: (sessionOverrides?: string[]) => void;
  /** Reset states. */
  reset: () => void;
}

export function useMemory(): UseMemoryReturn {
  const [saveState, setSaveState] = useState<AsyncResult<Memory>>(idle());
  const [searchState, setSearchState] = useState<AsyncResult<MemorySearchResult>>(idle());
  const [injectionPlan, setInjectionPlan] = useState<MemoryInjectionPlan | null>(null);
  const searchRef = useRef(0);

  const save = useCallback(async (input: MemoryIngestionInput) => {
    setSaveState(loading());
    const result = await saveMemory(input);
    setSaveState(result);
  }, []);

  const search = useCallback(async (query: MemoryRetrievalQuery) => {
    const runId = ++searchRef.current;
    setSearchState(loading());
    const result = await searchMemories(query);
    if (searchRef.current !== runId) return;
    setSearchState(result);
  }, []);

  const classify = useCallback((content: string, source: MemorySource = 'user_explicit') => {
    return classifyMemoryContent(content, source);
  }, []);

  const buildPlan = useCallback((sessionOverrides: string[] = []) => {
    if (searchState.status !== 'success') return;
    const plan = buildInjectionPlan(searchState.data.results, sessionOverrides);
    setInjectionPlan(plan);
  }, [searchState]);

  const reset = useCallback(() => {
    setSaveState(idle());
    setSearchState(idle());
    setInjectionPlan(null);
  }, []);

  return {
    saveState,
    searchState,
    injectionPlan,
    save,
    search,
    classify,
    buildPlan,
    reset,
  };
}
