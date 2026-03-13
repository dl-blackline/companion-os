// ─── Memory Domain Types ──────────────────────────────────────────────────────
// Types for the memory pipeline: ingestion, classification, storage, retrieval,
// ranking, injection, and runtime enforcement.

import type { MemoryCategory, PrivacyLevel } from './index';

// ─── Memory Classification ────────────────────────────────────────────────────

export type MemoryType =
  | 'preference'           // User likes/dislikes, style preferences
  | 'instruction'          // Explicit behavioral rules or instructions
  | 'fact'                 // Factual information about user or world
  | 'episodic'             // Events, experiences, milestones
  | 'relationship'         // Info about people/entities user interacts with
  | 'workflow'             // Procedures, processes user follows
  | 'context'              // Situational context (job, location, etc.)
  | 'correction';          // User corrections of AI behavior

export type MemoryPriority = 'low' | 'normal' | 'high' | 'critical';

export type MemorySource =
  | 'user_explicit'        // User explicitly saved to memory
  | 'user_instruction'     // User typed instruction/preference into memory
  | 'auto_captured'        // System captured from conversation
  | 'media_analysis'       // Captured from media analysis
  | 'import';              // Imported from external source

// ─── Memory Record ────────────────────────────────────────────────────────────

export interface MemoryRecord {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly content: string;
  readonly category: MemoryCategory;
  readonly memoryType: MemoryType;
  readonly priority: MemoryPriority;
  readonly source: MemorySource;
  readonly privacyLevel: PrivacyLevel;
  readonly confidence: number;
  readonly tags: readonly string[];
  readonly relatedEntityIds: readonly string[];
  readonly expiresAt: string | null;
  readonly isPinned: boolean;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ─── Memory Retrieval & Ranking ───────────────────────────────────────────────

export interface MemoryRetrievalQuery {
  readonly userId: string;
  readonly queryText: string;
  readonly contextWindow?: string;
  readonly maxResults: number;
  readonly includeTypes?: readonly MemoryType[];
  readonly excludeTypes?: readonly MemoryType[];
  readonly minConfidence?: number;
  readonly minPriority?: MemoryPriority;
}

export interface ScoredMemory {
  readonly memory: MemoryRecord;
  /** Semantic similarity score (0–1). */
  readonly relevanceScore: number;
  /** Recency-adjusted score. */
  readonly recencyScore: number;
  /** Combined final score. */
  readonly finalScore: number;
  /** Why this memory was included. */
  readonly reason: MemoryApplicationReason;
}

export type MemoryApplicationReason =
  | 'high_relevance'
  | 'user_instruction'
  | 'user_preference'
  | 'recent_context'
  | 'pinned'
  | 'always_active';

// ─── Memory Conflict Resolution ───────────────────────────────────────────────

export interface MemoryConflict {
  readonly memoryA: MemoryRecord;
  readonly memoryB: MemoryRecord;
  readonly conflictType: ConflictType;
  readonly resolution: ConflictResolution;
}

export type ConflictType =
  | 'contradictory'    // Two memories say opposite things
  | 'superseded'       // Newer memory replaces older one
  | 'duplicate'        // Same content, different records
  | 'scope_overlap';   // Different scopes, ambiguous application

export type ConflictResolution =
  | 'use_newer'
  | 'use_higher_priority'
  | 'use_user_explicit'
  | 'use_session_override'
  | 'merge'
  | 'ignore_both';

// ─── Memory Injection ─────────────────────────────────────────────────────────

/**
 * Priority order for memory injection:
 * 1. System rules (safety, platform constraints)
 * 2. Current explicit user request (live session instruction)
 * 3. Relevant saved memory (ranked by score)
 * 4. Defaults / fallback behavior
 */
export type InjectionLayer =
  | 'system_rules'
  | 'session_override'
  | 'saved_memory'
  | 'defaults';

export interface MemoryInjectionPlan {
  readonly userId: string;
  readonly appliedMemories: readonly AppliedMemory[];
  readonly ignoredMemories: readonly IgnoredMemory[];
  readonly activeInstructions: readonly string[];
  readonly activePreferences: readonly MemoryPreferenceEntry[];
  readonly conflictsResolved: readonly MemoryConflict[];
  readonly totalCandidates: number;
  readonly totalApplied: number;
  readonly generatedAt: number;
}

export interface AppliedMemory {
  readonly memoryId: string;
  readonly title: string;
  readonly content: string;
  readonly memoryType: MemoryType;
  readonly layer: InjectionLayer;
  readonly score: number;
  readonly reason: MemoryApplicationReason;
}

export interface IgnoredMemory {
  readonly memoryId: string;
  readonly title: string;
  readonly reason: MemoryIgnoreReason;
}

export type MemoryIgnoreReason =
  | 'low_relevance'
  | 'superseded_by_session'
  | 'conflict_resolved'
  | 'expired'
  | 'inactive'
  | 'low_confidence'
  | 'safety_filter';

export interface MemoryPreferenceEntry {
  readonly key: string;
  readonly value: string;
  readonly source: 'saved_memory' | 'session_override' | 'default';
}

// ─── Memory Ingestion ─────────────────────────────────────────────────────────

export interface MemoryIngestionInput {
  readonly userId: string;
  readonly content: string;
  readonly source: MemorySource;
  readonly title?: string;
  readonly category?: MemoryCategory;
  readonly tags?: readonly string[];
  readonly priority?: MemoryPriority;
  readonly expiresAt?: string;
}

export interface MemoryClassificationResult {
  readonly memoryType: MemoryType;
  readonly category: MemoryCategory;
  readonly priority: MemoryPriority;
  readonly confidence: number;
  readonly suggestedTitle: string;
  readonly normalizedContent: string;
  readonly extractedTags: readonly string[];
  readonly isInstruction: boolean;
  readonly isPreference: boolean;
}

// ─── Memory Search Results ────────────────────────────────────────────────────

export interface MemorySearchResult {
  readonly query: string;
  readonly results: readonly ScoredMemory[];
  readonly totalMatches: number;
  readonly searchDurationMs: number;
}
