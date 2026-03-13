// ─── Memory Service ───────────────────────────────────────────────────────────
// Typed service layer for memory CRUD, ranking, relevance scoring, and injection.

import type {
  AsyncResult,
  MemoryRecord,
  MemoryType,
  MemoryPriority,
  MemorySource,
  MemoryIngestionInput,
  MemoryClassificationResult,
  MemoryRetrievalQuery,
  ScoredMemory,
  MemorySearchResult,
  MemoryInjectionPlan,
  AppliedMemory,
  IgnoredMemory,
  MemoryConflict,
  MemoryPreferenceEntry,
  MemoryApplicationReason,
  MemoryIgnoreReason,
  InjectionLayer,
  Memory,
  MemoryCategory,
  PrivacyLevel,
} from '@/types';
import { success, error, appError } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = '/.netlify/functions';

/** Priority numeric values for comparison. */
const PRIORITY_RANK: Record<MemoryPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

/** Memory types that represent user instructions/preferences (high-priority for obedience). */
const INSTRUCTION_TYPES: ReadonlySet<MemoryType> = new Set([
  'instruction',
  'preference',
  'correction',
  'workflow',
]);

// ─── Memory Classification ────────────────────────────────────────────────────

/**
 * Classify memory content to determine type, priority, and normalization.
 * Uses heuristic analysis for fast local classification.
 */
export function classifyMemoryContent(content: string, source: MemorySource): MemoryClassificationResult {
  const lower = content.toLowerCase().trim();

  // Detect instruction patterns
  const instructionPatterns = [
    /^always\b/i, /^never\b/i, /^when\s+(you|i)\b/i, /^make sure\b/i,
    /^remember\s+to\b/i, /^don['']?t\b/i, /^do not\b/i, /^use\b/i,
    /^prefer\b/i, /^avoid\b/i, /^respond\s+(in|with)\b/i,
    /^format\b/i, /^my\s+(name|tone|style|preference)\b/i,
    /^call\s+me\b/i, /^i\s+(want|like|prefer|need)\b/i,
    /^treat\s+me\b/i, /^speak\s+(to\s+me|like)\b/i,
  ];

  const isInstruction = instructionPatterns.some(p => p.test(lower)) || source === 'user_instruction';

  // Detect preference patterns
  const preferencePatterns = [
    /\b(prefer|like|love|enjoy|dislike|hate|favorite)\b/i,
    /\b(style|tone|format|language|mode)\b/i,
  ];
  const isPreference = preferencePatterns.some(p => p.test(lower));

  // Determine type
  let memoryType: MemoryType = 'fact';
  if (isInstruction) memoryType = 'instruction';
  else if (isPreference) memoryType = 'preference';
  else if (/\b(birthday|graduated|married|moved|started|quit|launched)\b/i.test(lower)) memoryType = 'episodic';
  else if (/\b(wife|husband|friend|colleague|boss|partner|mom|dad|sibling)\b/i.test(lower)) memoryType = 'relationship';
  else if (/\b(step\s*\d|workflow|process|procedure|pipeline)\b/i.test(lower)) memoryType = 'workflow';
  else if (/\b(live[sd]?\s+in|work[sd]?\s+(at|for)|job|role|position|company)\b/i.test(lower)) memoryType = 'context';

  // Determine priority
  let priority: MemoryPriority = 'normal';
  if (isInstruction) priority = 'high';
  else if (source === 'user_explicit') priority = 'high';
  else if (isPreference) priority = 'normal';
  else if (source === 'auto_captured') priority = 'low';

  // Determine category
  let category: MemoryCategory = 'knowledge';
  if (memoryType === 'instruction' || memoryType === 'preference') category = 'identity';
  else if (memoryType === 'episodic') category = 'episodic';
  else if (memoryType === 'relationship') category = 'relationship';
  else if (memoryType === 'context') category = 'identity';

  // Extract tags
  const extractedTags: string[] = [];
  if (isInstruction) extractedTags.push('instruction');
  if (isPreference) extractedTags.push('preference');

  // Generate suggested title
  const suggestedTitle = content.length > 60 ? content.slice(0, 57) + '…' : content;

  return {
    memoryType,
    category,
    priority,
    confidence: isInstruction ? 0.95 : isPreference ? 0.85 : 0.7,
    suggestedTitle,
    normalizedContent: content.trim(),
    extractedTags,
    isInstruction,
    isPreference,
  };
}

// ─── Memory CRUD ──────────────────────────────────────────────────────────────

export async function saveMemory(
  input: MemoryIngestionInput,
): Promise<AsyncResult<Memory>> {
  try {
    const classification = classifyMemoryContent(input.content, input.source);

    const res = await fetch(`${API_BASE}/search-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        user_id: input.userId,
        title: input.title || classification.suggestedTitle,
        content: classification.normalizedContent,
        category: input.category || classification.category,
        tags: [...(input.tags || []), ...classification.extractedTags],
        priority: input.priority || classification.priority,
        memory_type: classification.memoryType,
        source: input.source,
        confidence: classification.confidence,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return error(appError('server', (body as Record<string, string>).error || 'Failed to save memory'));
    }

    const data = await res.json() as { memory: Memory };
    return success(data.memory);
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

export async function searchMemories(
  query: MemoryRetrievalQuery,
): Promise<AsyncResult<MemorySearchResult>> {
  const startTime = Date.now();

  try {
    const res = await fetch(`${API_BASE}/search-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'search',
        user_id: query.userId,
        query: query.queryText,
        limit: query.maxResults,
        include_types: query.includeTypes,
        min_confidence: query.minConfidence,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return error(appError('server', (body as Record<string, string>).error || 'Memory search failed'));
    }

    const data = await res.json() as { results: Array<{ memory: Memory; similarity: number }> };

    const scored: ScoredMemory[] = (data.results || []).map(item => {
      const mem = item.memory;
      const relevanceScore = item.similarity || 0;
      const recencyScore = computeRecencyScore(mem.createdAt);
      const priorityBoost = mem.isPinned ? 0.15 : 0;

      return {
        memory: toMemoryRecord(mem),
        relevanceScore,
        recencyScore,
        finalScore: relevanceScore * 0.6 + recencyScore * 0.2 + priorityBoost + 0.2,
        reason: determineApplicationReason(toMemoryRecord(mem), relevanceScore),
      };
    }).sort((a, b) => b.finalScore - a.finalScore);

    return success({
      query: query.queryText,
      results: scored,
      totalMatches: scored.length,
      searchDurationMs: Date.now() - startTime,
    });
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

// ─── Memory Injection Plan Builder ────────────────────────────────────────────

/**
 * Build a memory injection plan for a given context.
 * This determines which memories should be actively applied to the current interaction.
 *
 * Priority order:
 * 1. System rules (safety constraints — not memory-sourced)
 * 2. Current session override (live user instruction)
 * 3. Relevant saved memories (ranked by score)
 * 4. Defaults / fallback behavior
 */
export function buildInjectionPlan(
  memories: readonly ScoredMemory[],
  sessionOverrides: readonly string[],
  maxApplied = 15,
): MemoryInjectionPlan {
  const applied: AppliedMemory[] = [];
  const ignored: IgnoredMemory[] = [];
  const conflictsResolved: MemoryConflict[] = [];
  const activeInstructions: string[] = [];
  const activePreferences: MemoryPreferenceEntry[] = [];

  // Session overrides take first priority
  for (const override of sessionOverrides) {
    activeInstructions.push(override);
  }

  // Score and filter memories
  const candidates = [...memories].sort((a, b) => b.finalScore - a.finalScore);

  const seenContent = new Set<string>();

  for (const candidate of candidates) {
    const { memory } = candidate;

    // Skip inactive or expired memories
    if (!memory.isActive) {
      ignored.push({ memoryId: memory.id, title: memory.title, reason: 'inactive' });
      continue;
    }

    if (memory.expiresAt && new Date(memory.expiresAt) < new Date()) {
      ignored.push({ memoryId: memory.id, title: memory.title, reason: 'expired' });
      continue;
    }

    // Skip low confidence
    if (memory.confidence < 0.3) {
      ignored.push({ memoryId: memory.id, title: memory.title, reason: 'low_confidence' });
      continue;
    }

    // Skip low relevance (unless it's a pinned instruction)
    if (candidate.finalScore < 0.3 && !memory.isPinned && !INSTRUCTION_TYPES.has(memory.memoryType)) {
      ignored.push({ memoryId: memory.id, title: memory.title, reason: 'low_relevance' });
      continue;
    }

    // Deduplicate by content similarity
    const contentKey = memory.content.toLowerCase().trim().slice(0, 100);
    if (seenContent.has(contentKey)) {
      ignored.push({ memoryId: memory.id, title: memory.title, reason: 'conflict_resolved' });
      continue;
    }
    seenContent.add(contentKey);

    // Check session override conflicts
    const overridden = sessionOverrides.some(o =>
      o.toLowerCase().includes(memory.content.toLowerCase().slice(0, 30)),
    );
    if (overridden) {
      ignored.push({ memoryId: memory.id, title: memory.title, reason: 'superseded_by_session' });
      continue;
    }

    // Apply memory
    if (applied.length < maxApplied) {
      const layer: InjectionLayer = memory.isPinned ? 'saved_memory' : 'saved_memory';

      applied.push({
        memoryId: memory.id,
        title: memory.title,
        content: memory.content,
        memoryType: memory.memoryType,
        layer,
        score: candidate.finalScore,
        reason: candidate.reason,
      });

      // Collect instructions and preferences
      if (INSTRUCTION_TYPES.has(memory.memoryType)) {
        activeInstructions.push(memory.content);
      }

      if (memory.memoryType === 'preference') {
        activePreferences.push({
          key: memory.title,
          value: memory.content,
          source: 'saved_memory',
        });
      }
    } else {
      ignored.push({ memoryId: memory.id, title: memory.title, reason: 'low_relevance' });
    }
  }

  return {
    userId: memories[0]?.memory.userId || '',
    appliedMemories: applied,
    ignoredMemories: ignored,
    activeInstructions,
    activePreferences,
    conflictsResolved,
    totalCandidates: memories.length,
    totalApplied: applied.length,
    generatedAt: Date.now(),
  };
}

/**
 * Format memory injection plan as a string to be inserted into the system prompt.
 * This is the key function that makes memories influence AI behavior.
 */
export function formatInjectionForPrompt(plan: MemoryInjectionPlan): string {
  if (plan.totalApplied === 0) return '';

  const sections: string[] = [];

  // Instructions section — highest behavioral impact
  if (plan.activeInstructions.length > 0) {
    sections.push(
      '## USER INSTRUCTIONS & PREFERENCES (MUST FOLLOW)',
      'The user has saved these instructions. Follow them unless the current request explicitly contradicts them:',
      ...plan.activeInstructions.map((inst, i) => `${i + 1}. ${inst}`),
    );
  }

  // Context memories — informational
  const contextMemories = plan.appliedMemories.filter(
    m => !INSTRUCTION_TYPES.has(m.memoryType),
  );
  if (contextMemories.length > 0) {
    sections.push(
      '',
      '## USER CONTEXT (from memory)',
      'Known facts and context about the user:',
      ...contextMemories.map(m => `- ${m.title}: ${m.content}`),
    );
  }

  // Preferences section
  if (plan.activePreferences.length > 0) {
    sections.push(
      '',
      '## USER PREFERENCES',
      ...plan.activePreferences.map(p => `- ${p.key}: ${p.value}`),
    );
  }

  return sections.join('\n');
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function toMemoryRecord(mem: Memory): MemoryRecord {
  return {
    id: mem.id,
    userId: '',
    title: mem.title,
    content: mem.content,
    category: mem.category,
    memoryType: classifyMemoryContent(mem.content, 'user_explicit').memoryType,
    priority: mem.isPinned ? 'high' : 'normal',
    source: 'user_explicit',
    privacyLevel: mem.privacyLevel || 'private',
    confidence: mem.confidence,
    tags: mem.tags || [],
    relatedEntityIds: mem.relatedMemories || [],
    expiresAt: null,
    isPinned: mem.isPinned,
    isActive: true,
    createdAt: new Date(mem.createdAt).toISOString(),
    updatedAt: new Date(mem.updatedAt).toISOString(),
  };
}

function computeRecencyScore(createdAt: number): number {
  const ageMs = Date.now() - createdAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // Decay function: recent memories score higher
  if (ageDays < 1) return 1.0;
  if (ageDays < 7) return 0.9;
  if (ageDays < 30) return 0.7;
  if (ageDays < 90) return 0.5;
  if (ageDays < 365) return 0.3;
  return 0.1;
}

function determineApplicationReason(
  memory: MemoryRecord,
  relevanceScore: number,
): MemoryApplicationReason {
  if (memory.isPinned) return 'pinned';
  if (memory.memoryType === 'instruction') return 'user_instruction';
  if (memory.memoryType === 'preference') return 'user_preference';
  if (relevanceScore > 0.8) return 'high_relevance';
  return 'recent_context';
}
