// ─── Knowledge Analyzer Service ───────────────────────────────────────────────
// Typed service layer for the knowledge analysis pipeline.

import type {
  AsyncResult,
  KnowledgeAnalyzerInput,
  KnowledgeAnalysisResult,
  ExtractedEntity,
  KeyFinding,
  DetectedPattern,
  IdentifiedRisk,
  IdentifiedGap,
  Recommendation,
  EntityRelationship,
  IdentifiedTopic,
  DetectedIntent,
  Contradiction,
  AnalyzerStageResult,
  AnalysisDepth,
} from '@/types';
import { success, error, appError } from '@/types';
import { generateId } from '@/lib/helpers';
import { DEFAULT_AI_CONTROL_CONFIG } from '@/types/ai-control';
import { runAIRequest } from '@/services/ai-orchestrator';

// ─── Analyzer System Prompt ───────────────────────────────────────────────────

function buildAnalyzerSystemPrompt(depth: AnalysisDepth): string {
  const depthInstructions: Record<AnalysisDepth, string> = {
    quick: 'Provide a concise high-level analysis. Focus on key points, main entities, and primary intent.',
    standard: 'Provide a thorough analysis covering entities, topics, patterns, risks, and recommendations.',
    deep: 'Provide an exhaustive deep analysis. Extract every entity, relationship, pattern, contradiction, risk, and gap. Provide detailed recommendations with effort and impact estimates.',
  };

  return `You are an advanced knowledge analysis engine. Analyze the given input and return a structured JSON response.

${depthInstructions[depth]}

Return ONLY valid JSON with this exact structure:
{
  "overview": "Brief executive summary of the input",
  "keyFindings": [
    {
      "title": "Finding title",
      "description": "Detailed description",
      "severity": "info|notable|important|critical",
      "confidence": 0.0-1.0,
      "supportingEvidence": ["evidence1", "evidence2"],
      "relatedEntities": ["entity1"]
    }
  ],
  "extractedEntities": [
    {
      "name": "Entity name",
      "type": "person|organization|project|technology|location|concept|goal|event|date|metric",
      "confidence": 0.0-1.0,
      "context": "How entity relates to the content",
      "mentions": 1
    }
  ],
  "relationships": [
    {
      "source": "Entity A",
      "target": "Entity B",
      "relationship": "description of relationship",
      "confidence": 0.0-1.0,
      "bidirectional": false
    }
  ],
  "topics": [
    {
      "name": "Topic name",
      "relevance": 0.0-1.0,
      "subtopics": ["subtopic1"]
    }
  ],
  "detectedIntent": "inform|question|request|plan|analyze|compare|brainstorm|decide|review|unknown",
  "patterns": [
    {
      "name": "Pattern name",
      "description": "Description",
      "occurrences": 1,
      "examples": ["example"],
      "significance": "low|medium|high"
    }
  ],
  "risks": [
    {
      "title": "Risk title",
      "description": "Description",
      "level": "low|medium|high|critical",
      "mitigation": "Suggested mitigation",
      "affectedEntities": ["entity1"]
    }
  ],
  "gaps": [
    {
      "area": "Area with gap",
      "description": "What's missing",
      "impact": "low|medium|high",
      "suggestion": "How to address it"
    }
  ],
  "contradictions": [
    {
      "statementA": "First statement",
      "statementB": "Contradicting statement",
      "nature": "Description of contradiction",
      "severity": "minor|moderate|major"
    }
  ],
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed recommendation",
      "priority": "low|medium|high|urgent",
      "actionable": true,
      "effort": "low|medium|high",
      "impact": "low|medium|high"
    }
  ],
  "qualityScore": 0.0-1.0,
  "confidenceScore": 0.0-1.0
}

Rules:
- Every field must be present (use empty arrays for sections with no results)
- All scores must be between 0.0 and 1.0
- Be specific and evidence-based
- Avoid vague or generic observations
- Entities should be deduplicated by name
- Relationships should be meaningful and supported by content
- Recommendations must be actionable when marked as such`;
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export async function analyzeKnowledge(
  input: KnowledgeAnalyzerInput,
): Promise<AsyncResult<KnowledgeAnalysisResult>> {
  const startTime = Date.now();
  const stages: AnalyzerStageResult[] = [];

  try {
    // Stage 1: Preprocessing
    const preprocessStart = Date.now();
    const preprocessed = preprocessInput(input);
    stages.push({
      stage: 'preprocessing',
      durationMs: Date.now() - preprocessStart,
      success: true,
    });

    // Stage 2: Call AI for analysis
    const analysisStart = Date.now();
    const systemPrompt = buildAnalyzerSystemPrompt(input.depth);

    const userPrompt = buildUserPrompt(preprocessed, input);

    const result = await runAIRequest<{ reply?: string; message?: string }>({
      type: 'chat',
      userId: 'default-user',
      message: userPrompt,
      config: {
        ...DEFAULT_AI_CONTROL_CONFIG,
        model: 'gpt-4.1',
        temperature: 0.3,
      },
      options: {
        backendType: 'knowledge_chat',
        data: {
          action: 'chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model: 'gpt-4.1',
          temperature: 0.3,
        },
      },
    });

    stages.push({
      stage: 'classification',
      durationMs: Date.now() - analysisStart,
      success: result.success,
      error: result.success ? undefined : result.error,
    });

    if (!result.success || !result.data) {
      return error(appError('server', result.error || 'Analysis failed'));
    }

    // Stage 3: Parse and extract
    const extractionStart = Date.now();
    const data = result.data;
    const rawText = data.reply || data.message || '';
    const parsed = parseAnalysisResponse(rawText);
    stages.push({
      stage: 'extraction',
      durationMs: Date.now() - extractionStart,
      success: parsed !== null,
      error: parsed === null ? 'Failed to parse analysis response' : undefined,
    });

    if (!parsed) {
      return error(appError('processing_failed', 'Failed to parse knowledge analysis response'));
    }

    // Stage 4: Synthesis
    const synthesisStart = Date.now();
    const result: KnowledgeAnalysisResult = {
      id: generateId(),
      inputSummary: truncate(input.content, 200),
      analysisDepth: input.depth,
      overview: parsed.overview || 'No overview generated',
      keyFindings: normalizeFindings(parsed.keyFindings),
      extractedEntities: normalizeEntities(parsed.extractedEntities),
      relationships: normalizeRelationships(parsed.relationships),
      topics: normalizeTopics(parsed.topics),
      detectedIntent: normalizeIntent(parsed.detectedIntent),
      patterns: normalizePatterns(parsed.patterns),
      risks: normalizeRisks(parsed.risks),
      gaps: normalizeGaps(parsed.gaps),
      contradictions: normalizeContradictions(parsed.contradictions),
      recommendations: normalizeRecommendations(parsed.recommendations),
      qualityScore: clamp(parsed.qualityScore ?? 0.5, 0, 1),
      confidenceScore: clamp(parsed.confidenceScore ?? 0.5, 0, 1),
      stageResults: stages,
      analyzedAt: Date.now(),
      durationMs: Date.now() - startTime,
    };

    stages.push({
      stage: 'synthesis',
      durationMs: Date.now() - synthesisStart,
      success: true,
    });

    return success(result);
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

// ─── Preprocessing ────────────────────────────────────────────────────────────

function preprocessInput(input: KnowledgeAnalyzerInput): string {
  let content = input.content.trim();

  // Normalize excessive whitespace
  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.replace(/[ \t]{2,}/g, ' ');

  // Truncate very long inputs to avoid token limits
  const maxChars = 50000;
  if (content.length > maxChars) {
    content = content.slice(0, maxChars) + '\n\n[Content truncated for analysis]';
  }

  return content;
}

function buildUserPrompt(content: string, input: KnowledgeAnalyzerInput): string {
  const parts: string[] = [];

  if (input.title) {
    parts.push(`Title: ${input.title}`);
  }
  if (input.sourceUrl) {
    parts.push(`Source: ${input.sourceUrl}`);
  }
  if (input.additionalContext) {
    parts.push(`Additional Context: ${input.additionalContext}`);
  }

  parts.push(`Input Type: ${input.inputType}`);
  parts.push(`\nContent to analyze:\n${content}`);

  return parts.join('\n');
}

// ─── Response Parsing ─────────────────────────────────────────────────────────

interface RawAnalysisResponse {
  overview?: string;
  keyFindings?: unknown[];
  extractedEntities?: unknown[];
  relationships?: unknown[];
  topics?: unknown[];
  detectedIntent?: string;
  patterns?: unknown[];
  risks?: unknown[];
  gaps?: unknown[];
  contradictions?: unknown[];
  recommendations?: unknown[];
  qualityScore?: number;
  confidenceScore?: number;
}

function parseAnalysisResponse(raw: string): RawAnalysisResponse | null {
  try {
    // Try direct JSON parse
    return JSON.parse(raw) as RawAnalysisResponse;
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as RawAnalysisResponse;
      } catch {
        // fall through
      }
    }

    // Try finding JSON object in the text
    const braceStart = raw.indexOf('{');
    const braceEnd = raw.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(raw.slice(braceStart, braceEnd + 1)) as RawAnalysisResponse;
      } catch {
        // fall through
      }
    }

    return null;
  }
}

// ─── Normalization Helpers ────────────────────────────────────────────────────

function normalizeFindings(raw?: unknown[]): KeyFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    title: String(item.title || 'Untitled Finding'),
    description: String(item.description || ''),
    severity: normalizeSeverity(item.severity),
    confidence: clamp(Number(item.confidence) || 0.5, 0, 1),
    supportingEvidence: normalizeStringArray(item.supportingEvidence),
    relatedEntities: normalizeStringArray(item.relatedEntities),
  }));
}

function normalizeEntities(raw?: unknown[]): ExtractedEntity[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    name: String(item.name || 'Unknown'),
    type: normalizeEntityType(item.type),
    confidence: clamp(Number(item.confidence) || 0.5, 0, 1),
    context: String(item.context || ''),
    mentions: Math.max(1, Number(item.mentions) || 1),
  }));
}

function normalizeRelationships(raw?: unknown[]): EntityRelationship[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    source: String(item.source || ''),
    target: String(item.target || ''),
    relationship: String(item.relationship || ''),
    confidence: clamp(Number(item.confidence) || 0.5, 0, 1),
    bidirectional: Boolean(item.bidirectional),
  })).filter(r => r.source && r.target);
}

function normalizeTopics(raw?: unknown[]): IdentifiedTopic[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    name: String(item.name || 'Unknown'),
    relevance: clamp(Number(item.relevance) || 0.5, 0, 1),
    subtopics: normalizeStringArray(item.subtopics),
  }));
}

function normalizePatterns(raw?: unknown[]): DetectedPattern[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    name: String(item.name || 'Unknown Pattern'),
    description: String(item.description || ''),
    occurrences: Math.max(1, Number(item.occurrences) || 1),
    examples: normalizeStringArray(item.examples),
    significance: normalizeSignificance(item.significance),
  }));
}

function normalizeRisks(raw?: unknown[]): IdentifiedRisk[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    title: String(item.title || 'Unknown Risk'),
    description: String(item.description || ''),
    level: normalizeRiskLevel(item.level),
    mitigation: item.mitigation ? String(item.mitigation) : undefined,
    affectedEntities: normalizeStringArray(item.affectedEntities),
  }));
}

function normalizeGaps(raw?: unknown[]): IdentifiedGap[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    area: String(item.area || 'Unknown'),
    description: String(item.description || ''),
    impact: normalizeImpact(item.impact),
    suggestion: item.suggestion ? String(item.suggestion) : undefined,
  }));
}

function normalizeContradictions(raw?: unknown[]): Contradiction[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    statementA: String(item.statementA || ''),
    statementB: String(item.statementB || ''),
    nature: String(item.nature || ''),
    severity: normalizeContradictionSeverity(item.severity),
  })).filter(c => c.statementA && c.statementB);
}

function normalizeRecommendations(raw?: unknown[]): Recommendation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(item => ({
    title: String(item.title || 'Recommendation'),
    description: String(item.description || ''),
    priority: normalizeRecPriority(item.priority),
    actionable: Boolean(item.actionable ?? true),
    effort: normalizeImpact(item.effort),
    impact: normalizeImpact(item.impact),
  }));
}

function normalizeIntent(raw?: string): DetectedIntent {
  const valid: DetectedIntent[] = ['inform', 'question', 'request', 'plan', 'analyze', 'compare', 'brainstorm', 'decide', 'review', 'unknown'];
  const v = String(raw || '').toLowerCase() as DetectedIntent;
  return valid.includes(v) ? v : 'unknown';
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '…';
}

type Severity = 'info' | 'notable' | 'important' | 'critical';
function normalizeSeverity(v: unknown): Severity {
  const valid: Severity[] = ['info', 'notable', 'important', 'critical'];
  const s = String(v || '').toLowerCase() as Severity;
  return valid.includes(s) ? s : 'info';
}

function normalizeEntityType(v: unknown): ExtractedEntity['type'] {
  const valid: ExtractedEntity['type'][] = ['person', 'organization', 'project', 'technology', 'location', 'concept', 'goal', 'event', 'date', 'metric'];
  const s = String(v || '').toLowerCase() as ExtractedEntity['type'];
  return valid.includes(s) ? s : 'concept';
}

function normalizeSignificance(v: unknown): 'low' | 'medium' | 'high' {
  const valid = ['low', 'medium', 'high'] as const;
  const s = String(v || '').toLowerCase();
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'medium';
}

function normalizeRiskLevel(v: unknown): 'low' | 'medium' | 'high' | 'critical' {
  const valid = ['low', 'medium', 'high', 'critical'] as const;
  const s = String(v || '').toLowerCase();
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'medium';
}

function normalizeImpact(v: unknown): 'low' | 'medium' | 'high' {
  const valid = ['low', 'medium', 'high'] as const;
  const s = String(v || '').toLowerCase();
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'medium';
}

function normalizeContradictionSeverity(v: unknown): 'minor' | 'moderate' | 'major' {
  const valid = ['minor', 'moderate', 'major'] as const;
  const s = String(v || '').toLowerCase();
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'moderate';
}

function normalizeRecPriority(v: unknown): 'low' | 'medium' | 'high' | 'urgent' {
  const valid = ['low', 'medium', 'high', 'urgent'] as const;
  const s = String(v || '').toLowerCase();
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'medium';
}
