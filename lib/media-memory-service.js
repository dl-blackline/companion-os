/**
 * media-memory-service.js
 *
 * Orchestrates the full media → analysis → memory pipeline:
 *  1. analyzeMediaForMemory   — calls vision-analyzer and extracts structured data
 *  2. generateMemoryCandidates — produces candidate memories awaiting user approval
 *  3. storeMediaRecord        — persists uploaded_media row
 *  4. storeAnalysis           — persists media_analysis row
 *  5. storeCandidates         — persists memory_candidate rows
 *  6. storeKnowledgeEntry     — persists a media_knowledge_entries row
 *  7. approveCandidate        — moves candidate → episodic/relationship memory
 *  8. rejectCandidate         — marks candidate rejected
 *  9. searchMediaMemories     — semantic search over media_analysis embeddings
 * 10. getRelevantMediaContext — retrieve top-k media memories for chat context
 * 11. deleteMedia             — cascade-delete a media record + dependents
 */

import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./openai-client.js";
import { analyzeImage, describeVideo } from "./vision-analyzer.js";
import { route } from "./ai-router.js";
import {
  storeEpisodicMemory,
  storeRelationshipMemory,
} from "./memory-manager.js";

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment configuration");
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/* ─── Structured analysis prompt ─────────────────────────────────────────── */

const ANALYSIS_SYSTEM_PROMPT = `You are an advanced media analysis intelligence engine for a personal AI companion.
Analyze the provided media with depth and precision. Return a JSON object with the following fields. Respond with valid JSON only — no markdown, no explanation.

{
  "summary": "1-2 sentence executive overview of what this media shows",
  "description": "detailed multi-sentence description covering all notable elements, composition, quality, and context",
  "extracted_text": "any text visible in the image (OCR) or spoken in the video (transcript excerpt), or null",
  "transcript": "full spoken transcript if this is a video with audio, or null",
  "tags": ["array", "of", "relevant", "keywords"],
  "entities": [
    { "name": "entity name", "type": "person|place|object|event|brand|other", "confidence": 0.0-1.0 }
  ],
  "emotional_cues": ["array of emotional or contextual notes, e.g. 'appears happy', 'outdoor setting'"],
  "timestamped_moments": [
    { "timestamp": "HH:MM:SS or seconds", "description": "what happens at this point" }
  ],
  "content_classification": {
    "primary_category": "Main category (e.g. 'travel', 'food', 'work', 'social', 'document', 'screenshot')",
    "subcategories": ["more specific categories"],
    "is_safe": true,
    "sensitivity_flags": []
  },
  "quality_indicators": {
    "visual_quality": "low|medium|high",
    "information_density": "low|medium|high",
    "analysis_confidence": 0.0-1.0
  },
  "memory_candidates": [
    {
      "title": "Short descriptive title for this memory",
      "content": "What the companion should remember from this media",
      "category": "identity|relationship|project|knowledge|episodic|media",
      "confidence": 0.0-1.0,
      "tags": ["relevant", "tags"]
    }
  ]
}

Rules:
- Only include memory_candidates with confidence > 0.5.
- Do not infer sensitive facts (age, health, financial) without high visual certainty.
- Distinguish observations (from the image) from inferences (contextual guesses).
- Keep memory content factual and concise.
- timestamped_moments is only relevant for videos; return [] for images.
- If no entities/tags/cues are present, return empty arrays.
- Be thorough in OCR — extract all visible text including signs, labels, screens, documents.
- For videos, note key scene transitions and subjects.
- content_classification helps categorize the media for future retrieval.
- quality_indicators help the system decide how much weight to give this analysis.`;

/* ─── analyzeMediaForMemory ───────────────────────────────────────────────── */

/**
 * Run vision analysis on uploaded media and extract structured memory data.
 *
 * @param {object} opts
 * @param {string} opts.media_url        - Public URL or base64 data URL
 * @param {'image'|'video'} opts.media_type
 * @param {string} [opts.user_context]   - Optional note from the user ("this is my dog Max")
 * @param {string} [opts.model]          - Optional model override
 * @returns {Promise<object>} Parsed analysis object
 */
export async function analyzeMediaForMemory({ media_url, media_type, user_context, model }) {
  const userPrompt = user_context
    ? `User note: "${user_context}"\n\nPlease analyze this ${media_type} according to the instructions.`
    : `Please analyze this ${media_type} according to the instructions.`;

  let rawAnalysis;

  try {
    if (media_type === "video") {
      rawAnalysis = await describeVideo({
        video_url: media_url,
        prompt: userPrompt,
        model,
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      });
    } else {
      rawAnalysis = await analyzeImage({
        image_url: media_url,
        prompt: userPrompt,
        model,
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      });
    }
  } catch (err) {
    console.error("Media analysis failed:", err.message);
    throw new Error(`Media analysis failed: ${err.message}`);
  }

  // Strip markdown code fences if the model wrapped the JSON
  const cleaned = rawAnalysis
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // If JSON parsing fails, return a minimal safe object
    console.warn("Failed to parse structured analysis; returning text summary only");
    return {
      summary: rawAnalysis.slice(0, 500),
      description: rawAnalysis,
      extracted_text: null,
      transcript: null,
      tags: [],
      entities: [],
      emotional_cues: [],
      timestamped_moments: [],
      memory_candidates: [],
    };
  }
}

/* ─── storeMediaRecord ────────────────────────────────────────────────────── */

/**
 * Persist an uploaded_media row. Returns the created record.
 */
export async function storeMediaRecord({
  user_id,
  storage_path,
  public_url,
  filename,
  media_type,
  mime_type,
  file_size_bytes,
  user_title,
  user_note,
  processing_state = "pending",
}) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("uploaded_media")
    .insert({
      user_id,
      storage_path,
      public_url,
      filename,
      media_type,
      mime_type,
      file_size_bytes,
      user_title,
      user_note,
      processing_state,
    })
    .select()
    .single();

  if (error) {
    console.error("storeMediaRecord error:", error.message);
    throw new Error(error.message);
  }

  return data;
}

/* ─── updateMediaProcessingState ─────────────────────────────────────────── */

export async function updateMediaProcessingState(media_id, state) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("uploaded_media")
    .update({ processing_state: state, updated_at: new Date().toISOString() })
    .eq("id", media_id);

  if (error) {
    console.error("updateMediaProcessingState error:", error.message);
  }
}

/* ─── storeAnalysis ───────────────────────────────────────────────────────── */

/**
 * Persist a media_analysis row and generate an embedding for similarity search.
 * Returns the created record.
 */
export async function storeAnalysis({ media_id, user_id, analysis, model_used }) {
  const supabase = getSupabase();

  // Build a combined text string for embedding
  const embeddingText = [
    analysis.summary || "",
    analysis.description || "",
    (analysis.tags || []).join(" "),
    (analysis.entities || []).map((e) => e.name).join(" "),
    analysis.extracted_text || "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 8000);

  let embedding = null;
  if (embeddingText.trim()) {
    try {
      embedding = await generateEmbedding(embeddingText);
    } catch (err) {
      console.warn("Embedding generation failed for media analysis:", err.message);
    }
  }

  const { data, error } = await supabase
    .from("media_analysis")
    .insert({
      media_id,
      user_id,
      summary: analysis.summary || null,
      description: analysis.description || null,
      extracted_text: analysis.extracted_text || null,
      transcript: analysis.transcript || null,
      tags: analysis.tags || [],
      entities: analysis.entities || [],
      emotional_cues: analysis.emotional_cues || [],
      timestamped_moments: analysis.timestamped_moments || [],
      model_used: model_used || null,
      embedding,
    })
    .select()
    .single();

  if (error) {
    console.error("storeAnalysis error:", error.message);
    throw new Error(error.message);
  }

  return data;
}

/* ─── storeCandidates ─────────────────────────────────────────────────────── */

/**
 * Persist memory_candidate rows from analysis.memory_candidates.
 * Returns the inserted rows.
 */
export async function storeCandidates({ media_id, user_id, candidates }) {
  if (!candidates || candidates.length === 0) return [];

  const supabase = getSupabase();

  const rows = candidates.map((c) => ({
    user_id,
    media_id,
    title: c.title,
    content: c.content,
    category: c.category || "media",
    confidence: typeof c.confidence === "number" ? c.confidence : 0.7,
    privacy_level: "private",
    tags: c.tags || [],
    status: "pending",
  }));

  const { data, error } = await supabase
    .from("memory_candidates")
    .insert(rows)
    .select();

  if (error) {
    console.error("storeCandidates error:", error.message);
    return [];
  }

  return data || [];
}

/* ─── storeKnowledgeEntry ─────────────────────────────────────────────────── */

/**
 * Persist a media_knowledge_entries row from the analysis.
 * Returns the created record.
 */
export async function storeKnowledgeEntry({ media_id, user_id, analysis, media_type, user_title }) {
  const supabase = getSupabase();

  const title =
    user_title ||
    (analysis.summary
      ? analysis.summary.slice(0, 80)
      : `${media_type === "video" ? "Video" : "Image"} upload`);

  const content = [
    analysis.description || analysis.summary || "",
    analysis.extracted_text ? `\n\nExtracted text:\n${analysis.extracted_text}` : "",
    analysis.transcript ? `\n\nTranscript:\n${analysis.transcript}` : "",
  ]
    .join("")
    .trim();

  // Build embedding text
  const embeddingText = [title, content, (analysis.tags || []).join(" ")]
    .join(" ")
    .slice(0, 8000);

  let embedding = null;
  if (embeddingText.trim()) {
    try {
      embedding = await generateEmbedding(embeddingText);
    } catch (err) {
      console.warn("Embedding generation failed for knowledge entry:", err.message);
    }
  }

  const { data, error } = await supabase
    .from("media_knowledge_entries")
    .insert({
      user_id,
      media_id,
      title,
      content,
      item_type: "media",
      category: media_type === "video" ? "video" : "image",
      tags: analysis.tags || [],
      summary: analysis.summary || null,
      embedding,
    })
    .select()
    .single();

  if (error) {
    console.error("storeKnowledgeEntry error:", error.message);
    throw new Error(error.message);
  }

  return data;
}

/* ─── approveCandidate ────────────────────────────────────────────────────── */

/**
 * Approve a memory candidate: write to the appropriate memory table and
 * mark the candidate as approved. Optionally override title/content.
 */
export async function approveCandidate({
  candidate_id,
  user_id,
  title_override,
  content_override,
}) {
  const supabase = getSupabase();

  // Fetch candidate
  const { data: candidate, error: fetchErr } = await supabase
    .from("memory_candidates")
    .select("*")
    .eq("id", candidate_id)
    .eq("user_id", user_id)
    .single();

  if (fetchErr || !candidate) {
    throw new Error(fetchErr?.message || "Candidate not found");
  }

  const finalContent = content_override || candidate.content;
  const finalTitle = title_override || candidate.title;
  const memoryText = `${finalTitle}: ${finalContent}`;

  // Store in the appropriate long-term memory table
  const memoryType =
    candidate.category === "relationship" || candidate.category === "identity"
      ? "relationship"
      : "episodic";

  try {
    if (memoryType === "relationship") {
      await storeRelationshipMemory({
        user_id,
        memory: memoryText,
        importance_score: candidate.confidence,
      });
    } else {
      await storeEpisodicMemory({
        user_id,
        event: memoryText,
        importance_score: candidate.confidence,
      });
    }
  } catch (err) {
    console.warn("Could not store in long-term memory table:", err.message);
  }

  // Mark candidate as approved
  const { error: updateErr } = await supabase
    .from("memory_candidates")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", candidate_id)
    .eq("user_id", user_id);

  if (updateErr) {
    console.error("approveCandidate update error:", updateErr.message);
  }

  return { approved: true, memory_type: memoryType };
}

/* ─── rejectCandidate ─────────────────────────────────────────────────────── */

export async function rejectCandidate({ candidate_id, user_id }) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("memory_candidates")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("id", candidate_id)
    .eq("user_id", user_id);

  if (error) {
    console.error("rejectCandidate error:", error.message);
    throw new Error(error.message);
  }

  return { rejected: true };
}

/* ─── listMediaForUser ────────────────────────────────────────────────────── */

export async function listMediaForUser({ user_id, limit = 50, offset = 0, media_type }) {
  const supabase = getSupabase();

  let query = supabase
    .from("uploaded_media")
    .select(
      `id, user_id, storage_path, public_url, filename, media_type,
       file_size_bytes, user_title, user_note, processing_state, created_at, updated_at,
       media_analysis(id, summary, tags, entities, emotional_cues, created_at),
       memory_candidates(id, title, content, category, confidence, status, tags)`
    )
    .eq("user_id", user_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (media_type) {
    query = query.eq("media_type", media_type);
  }

  const { data, error } = await query;

  if (error) {
    console.error("listMediaForUser error:", error.message);
    return [];
  }

  return data || [];
}

/* ─── getPendingCandidates ────────────────────────────────────────────────── */

export async function getPendingCandidates({ user_id }) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("memory_candidates")
    .select(`*, uploaded_media(id, public_url, filename, media_type, user_title)`)
    .eq("user_id", user_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPendingCandidates error:", error.message);
    return [];
  }

  return data || [];
}

/* ─── deleteMedia ─────────────────────────────────────────────────────────── */

/**
 * Soft-delete an uploaded_media record.
 * Cascade deletes handle analysis, candidates, and knowledge entries via FK.
 */
export async function deleteMedia({ media_id, user_id }) {
  const supabase = getSupabase();

  // Soft delete — preserves audit trail
  const { error } = await supabase
    .from("uploaded_media")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", media_id)
    .eq("user_id", user_id);

  if (error) {
    console.error("deleteMedia error:", error.message);
    throw new Error(error.message);
  }

  return { deleted: true };
}

/* ─── searchMediaMemories ─────────────────────────────────────────────────── */

/**
 * Semantic search over media_analysis embeddings for a given user.
 */
export async function searchMediaMemories({ query, user_id, limit = 5 }) {
  const supabase = getSupabase();

  let embedding;
  try {
    embedding = await generateEmbedding(query);
  } catch (err) {
    console.warn("Embedding failed for media search:", err.message);
    return [];
  }

  const { data, error } = await supabase.rpc("match_media_analysis", {
    query_embedding: embedding,
    match_count: limit,
    filter_user_id: user_id,
  });

  if (error) {
    console.error("searchMediaMemories error:", error.message);
    return [];
  }

  return data || [];
}

/* ─── getRelevantMediaContext ─────────────────────────────────────────────── */

/**
 * Retrieve the top-k most relevant media memories for a given chat message.
 * Returns a formatted string ready to inject into the system prompt.
 */
export async function getRelevantMediaContext({ message, user_id, limit = 3 }) {
  const results = await searchMediaMemories({ query: message, user_id, limit });

  if (!results || results.length === 0) return null;

  const lines = results
    .filter((r) => r.similarity > 0.7)
    .map((r) => {
      const tagStr = Array.isArray(r.tags) ? r.tags.join(", ") : "";
      return `- [Media Memory] ${r.summary || r.description || "(no summary)"}${tagStr ? ` [tags: ${tagStr}]` : ""}`;
    });

  if (lines.length === 0) return null;

  return `Relevant media memories the user has shared:\n${lines.join("\n")}`;
}

/* ─── runFullMediaPipeline ────────────────────────────────────────────────── */

/**
 * End-to-end pipeline: analyse → store analysis → store candidates → store knowledge entry.
 * Returns { media_record, analysis_record, candidates, knowledge_entry }.
 *
 * @param {object} opts
 * @param {string} opts.user_id
 * @param {string} opts.storage_path
 * @param {string} opts.public_url
 * @param {string} opts.filename
 * @param {'image'|'video'} opts.media_type
 * @param {string} [opts.mime_type]
 * @param {number} [opts.file_size_bytes]
 * @param {string} [opts.user_title]
 * @param {string} [opts.user_note]
 * @param {string} [opts.model]
 */
export async function runFullMediaPipeline(opts) {
  const {
    user_id,
    storage_path,
    public_url,
    filename,
    media_type,
    mime_type,
    file_size_bytes,
    user_title,
    user_note,
    model,
  } = opts;

  // 1. Persist the upload record immediately (so the user can track progress)
  const media_record = await storeMediaRecord({
    user_id,
    storage_path,
    public_url,
    filename,
    media_type,
    mime_type,
    file_size_bytes,
    user_title,
    user_note,
    processing_state: "processing",
  });

  let analysis_record = null;
  let candidates = [];
  let knowledge_entry = null;

  try {
    // 2. Run vision analysis
    const analysis = await analyzeMediaForMemory({
      media_url: public_url || storage_path,
      media_type,
      user_context: user_note || user_title,
      model,
    });

    // 3. Store analysis result
    analysis_record = await storeAnalysis({
      media_id: media_record.id,
      user_id,
      analysis,
      model_used: model || "gpt-4.1",
    });

    // 4. Store memory candidates
    if (analysis.memory_candidates && analysis.memory_candidates.length > 0) {
      candidates = await storeCandidates({
        media_id: media_record.id,
        user_id,
        candidates: analysis.memory_candidates,
      });
    }

    // 5. Store knowledge entry
    knowledge_entry = await storeKnowledgeEntry({
      media_id: media_record.id,
      user_id,
      analysis,
      media_type,
      user_title,
    });

    // 6. Mark as done
    await updateMediaProcessingState(media_record.id, "done");
  } catch (err) {
    console.error("Media pipeline error:", err.message);
    await updateMediaProcessingState(media_record.id, "failed");
  }

  return { media_record, analysis_record, candidates, knowledge_entry };
}
