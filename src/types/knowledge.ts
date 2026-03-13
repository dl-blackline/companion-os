// ─── Knowledge Analyzer Types ─────────────────────────────────────────────────
// Types for the knowledge analysis pipeline — from raw input to structured insight.

// ─── Input Types ──────────────────────────────────────────────────────────────

export type KnowledgeInputType = 'text' | 'document' | 'url' | 'conversation' | 'media_analysis';

export interface KnowledgeAnalyzerInput {
  readonly content: string;
  readonly inputType: KnowledgeInputType;
  readonly title?: string;
  readonly sourceUrl?: string;
  readonly additionalContext?: string;
  /** Depth of analysis requested. */
  readonly depth: AnalysisDepth;
}

export type AnalysisDepth = 'quick' | 'standard' | 'deep';

// ─── Pipeline Stage Types ─────────────────────────────────────────────────────

export type AnalyzerStage =
  | 'preprocessing'
  | 'classification'
  | 'extraction'
  | 'reasoning'
  | 'synthesis'
  | 'formatting';

export interface AnalyzerStageResult {
  readonly stage: AnalyzerStage;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: string;
}

// ─── Entity Types ─────────────────────────────────────────────────────────────

export type EntityType =
  | 'person'
  | 'organization'
  | 'project'
  | 'technology'
  | 'location'
  | 'concept'
  | 'goal'
  | 'event'
  | 'date'
  | 'metric';

export interface ExtractedEntity {
  readonly name: string;
  readonly type: EntityType;
  readonly confidence: number;
  readonly context: string;
  readonly mentions: number;
}

// ─── Relationship Types ───────────────────────────────────────────────────────

export interface EntityRelationship {
  readonly source: string;
  readonly target: string;
  readonly relationship: string;
  readonly confidence: number;
  readonly bidirectional: boolean;
}

// ─── Finding Types ────────────────────────────────────────────────────────────

export type FindingSeverity = 'info' | 'notable' | 'important' | 'critical';

export interface KeyFinding {
  readonly title: string;
  readonly description: string;
  readonly severity: FindingSeverity;
  readonly confidence: number;
  readonly supportingEvidence: readonly string[];
  readonly relatedEntities: readonly string[];
}

// ─── Pattern Types ────────────────────────────────────────────────────────────

export interface DetectedPattern {
  readonly name: string;
  readonly description: string;
  readonly occurrences: number;
  readonly examples: readonly string[];
  readonly significance: 'low' | 'medium' | 'high';
}

// ─── Risk & Gap Types ─────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface IdentifiedRisk {
  readonly title: string;
  readonly description: string;
  readonly level: RiskLevel;
  readonly mitigation?: string;
  readonly affectedEntities: readonly string[];
}

export interface IdentifiedGap {
  readonly area: string;
  readonly description: string;
  readonly impact: 'low' | 'medium' | 'high';
  readonly suggestion?: string;
}

// ─── Recommendation Types ─────────────────────────────────────────────────────

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Recommendation {
  readonly title: string;
  readonly description: string;
  readonly priority: RecommendationPriority;
  readonly actionable: boolean;
  readonly effort: 'low' | 'medium' | 'high';
  readonly impact: 'low' | 'medium' | 'high';
}

// ─── Topic & Intent ───────────────────────────────────────────────────────────

export interface IdentifiedTopic {
  readonly name: string;
  readonly relevance: number;
  readonly subtopics: readonly string[];
}

export type DetectedIntent =
  | 'inform'
  | 'question'
  | 'request'
  | 'plan'
  | 'analyze'
  | 'compare'
  | 'brainstorm'
  | 'decide'
  | 'review'
  | 'unknown';

// ─── Contradiction & Conflict ─────────────────────────────────────────────────

export interface Contradiction {
  readonly statementA: string;
  readonly statementB: string;
  readonly nature: string;
  readonly severity: 'minor' | 'moderate' | 'major';
}

// ─── Full Analysis Result ─────────────────────────────────────────────────────

export interface KnowledgeAnalysisResult {
  readonly id: string;
  readonly inputSummary: string;
  readonly analysisDepth: AnalysisDepth;
  readonly overview: string;
  readonly keyFindings: readonly KeyFinding[];
  readonly extractedEntities: readonly ExtractedEntity[];
  readonly relationships: readonly EntityRelationship[];
  readonly topics: readonly IdentifiedTopic[];
  readonly detectedIntent: DetectedIntent;
  readonly patterns: readonly DetectedPattern[];
  readonly risks: readonly IdentifiedRisk[];
  readonly gaps: readonly IdentifiedGap[];
  readonly contradictions: readonly Contradiction[];
  readonly recommendations: readonly Recommendation[];
  readonly qualityScore: number;
  readonly confidenceScore: number;
  readonly stageResults: readonly AnalyzerStageResult[];
  readonly analyzedAt: number;
  readonly durationMs: number;
}

// ─── Knowledge Node / Edge (for graph storage) ───────────────────────────────

export interface KnowledgeNode {
  readonly id: string;
  readonly entity: string;
  readonly entityType: EntityType;
  readonly userId: string;
  readonly createdAt: string;
}

export interface KnowledgeEdge {
  readonly id: string;
  readonly sourceEntity: string;
  readonly targetEntity: string;
  readonly relationship: string;
  readonly userId: string;
  readonly createdAt: string;
}
