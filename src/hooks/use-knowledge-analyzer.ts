// ─── useKnowledgeAnalyzer Hook ────────────────────────────────────────────────
// Typed hook for running knowledge analysis and managing analyzer state.

import { useState, useCallback, useRef } from 'react';
import type {
  AsyncResult,
  KnowledgeAnalyzerInput,
  KnowledgeAnalysisResult,
  AnalysisDepth,
  KnowledgeInputType,
} from '@/types';
import { idle, loading } from '@/types';
import { analyzeKnowledge } from '@/services/knowledge-service';

interface UseKnowledgeAnalyzerReturn {
  /** Current analysis state. */
  analysisState: AsyncResult<KnowledgeAnalysisResult>;
  /** History of completed analyses. */
  history: readonly KnowledgeAnalysisResult[];
  /** Run a knowledge analysis. */
  analyze: (input: KnowledgeAnalyzerInput) => Promise<void>;
  /** Quick analyze with minimal configuration. */
  quickAnalyze: (content: string, title?: string) => Promise<void>;
  /** Clear current state. */
  reset: () => void;
  /** Clear all history. */
  clearHistory: () => void;
}

export function useKnowledgeAnalyzer(): UseKnowledgeAnalyzerReturn {
  const [analysisState, setAnalysisState] = useState<AsyncResult<KnowledgeAnalysisResult>>(idle());
  const [history, setHistory] = useState<KnowledgeAnalysisResult[]>([]);
  const analyzeRef = useRef(0);

  const analyze = useCallback(async (input: KnowledgeAnalyzerInput) => {
    const runId = ++analyzeRef.current;
    setAnalysisState(loading());

    const result = await analyzeKnowledge(input);

    // Guard against stale results from previous runs
    if (analyzeRef.current !== runId) return;

    setAnalysisState(result);

    if (result.status === 'success') {
      setHistory(prev => [result.data, ...prev].slice(0, 50));
    }
  }, []);

  const quickAnalyze = useCallback(async (content: string, title?: string) => {
    let inputType: KnowledgeInputType = 'text';
    try {
      new URL(content.trim());
      inputType = 'url';
    } catch {
      // Not a valid URL — use 'text'
    }
    const depth: AnalysisDepth = content.length > 5000 ? 'deep' : content.length > 500 ? 'standard' : 'quick';

    await analyze({
      content,
      inputType,
      title,
      depth,
    });
  }, [analyze]);

  const reset = useCallback(() => {
    setAnalysisState(idle());
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    analysisState,
    history,
    analyze,
    quickAnalyze,
    reset,
    clearHistory,
  };
}
