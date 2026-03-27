-- Media Memory and Knowledge System
-- Migration: 011_media_memory.sql
--
-- Adds tables for user-uploaded media, AI analysis results,
-- pending memory candidates (awaiting user approval), and
-- media-derived knowledge entries.

-- ─── Uploaded Media ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS uploaded_media (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path     TEXT NOT NULL,
  public_url       TEXT,
  filename         TEXT NOT NULL,
  media_type       TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type        TEXT,
  file_size_bytes  BIGINT,
  -- User-provided label / title
  user_title       TEXT,
  user_note        TEXT,
  -- Processing state
  processing_state TEXT NOT NULL DEFAULT 'pending'
                   CHECK (processing_state IN ('pending', 'processing', 'done', 'failed')),
  -- Soft-delete / archival
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_media_user_id
  ON uploaded_media(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_uploaded_media_type
  ON uploaded_media(user_id, media_type) WHERE deleted_at IS NULL;

ALTER TABLE uploaded_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uploaded_media_owner" ON uploaded_media;

CREATE POLICY "uploaded_media_owner" ON uploaded_media
  FOR ALL USING (user_id = auth.uid());

-- ─── Media Analysis Results ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_analysis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id        UUID NOT NULL REFERENCES uploaded_media(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Core outputs
  summary         TEXT,
  description     TEXT,
  extracted_text  TEXT,
  transcript      TEXT,
  -- Structured metadata stored as JSON arrays / objects
  tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  entities        JSONB NOT NULL DEFAULT '[]'::jsonb,
  emotional_cues  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Video-specific: array of { timestamp, description } objects
  timestamped_moments JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Analysis model used
  model_used      TEXT,
  -- Embedding for similarity search
  embedding       vector(1536),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_analysis_media_id
  ON media_analysis(media_id);

CREATE INDEX IF NOT EXISTS idx_media_analysis_user_id
  ON media_analysis(user_id);

-- Note: IVFFlat lists = 50 is suitable for medium datasets (~10k–100k rows).
-- For smaller datasets (<10k), reduce to lists = 10; for large datasets (>100k), set lists ≈ sqrt(total_rows).
CREATE INDEX IF NOT EXISTS idx_media_analysis_embedding
  ON media_analysis USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

ALTER TABLE media_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_analysis_owner" ON media_analysis;

CREATE POLICY "media_analysis_owner" ON media_analysis
  FOR ALL USING (user_id = auth.uid());

-- ─── Memory Candidates (awaiting user approval) ───────────────────────────────

CREATE TABLE IF NOT EXISTS memory_candidates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id         UUID REFERENCES uploaded_media(id) ON DELETE CASCADE,
  -- Proposed memory content
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'episodic'
                   CHECK (category IN ('identity','relationship','project','knowledge','episodic','session','media')),
  confidence       FLOAT NOT NULL DEFAULT 0.7 CHECK (confidence BETWEEN 0 AND 1),
  privacy_level    TEXT NOT NULL DEFAULT 'private'
                   CHECK (privacy_level IN ('public','private','sensitive')),
  tags             JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- User decision
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  decided_at       TIMESTAMPTZ,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_candidates_user_pending
  ON memory_candidates(user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_memory_candidates_media_id
  ON memory_candidates(media_id);

ALTER TABLE memory_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memory_candidates_owner" ON memory_candidates;

CREATE POLICY "memory_candidates_owner" ON memory_candidates
  FOR ALL USING (user_id = auth.uid());

-- ─── Media-to-Memory Links ────────────────────────────────────────────────────
-- Links confirmed memories (episodic / relationship) back to source media.

CREATE TABLE IF NOT EXISTS media_memory_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id    UUID NOT NULL REFERENCES uploaded_media(id) ON DELETE CASCADE,
  -- References either episodic_memory or relationship_memory by id (text uuid)
  memory_type TEXT NOT NULL CHECK (memory_type IN ('episodic','relationship','summary')),
  memory_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_id, memory_type, memory_id)
);

ALTER TABLE media_memory_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_memory_links_owner" ON media_memory_links;

CREATE POLICY "media_memory_links_owner" ON media_memory_links
  FOR ALL USING (user_id = auth.uid());

-- ─── Media Knowledge Entries ─────────────────────────────────────────────────
-- Structured knowledge items derived from uploaded media.

CREATE TABLE IF NOT EXISTS media_knowledge_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id        UUID NOT NULL REFERENCES uploaded_media(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  item_type       TEXT NOT NULL DEFAULT 'media'
                  CHECK (item_type IN ('document','note','link','snippet','media')),
  category        TEXT NOT NULL DEFAULT 'media',
  tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary         TEXT,
  embedding       vector(1536),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_knowledge_user_id
  ON media_knowledge_entries(user_id) WHERE deleted_at IS NULL;

-- Note: IVFFlat lists = 50 is suitable for medium datasets (~10k–100k rows).
-- For smaller datasets (<10k), reduce to lists = 10; for large datasets (>100k), set lists ≈ sqrt(total_rows).
CREATE INDEX IF NOT EXISTS idx_media_knowledge_embedding
  ON media_knowledge_entries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

ALTER TABLE media_knowledge_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_knowledge_owner" ON media_knowledge_entries;

CREATE POLICY "media_knowledge_owner" ON media_knowledge_entries
  FOR ALL USING (user_id = auth.uid());

-- ─── User Memory Preferences ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_memory_preferences (
  user_id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_enabled             BOOLEAN NOT NULL DEFAULT true,
  auto_save_memory           BOOLEAN NOT NULL DEFAULT false,
  ask_before_saving          BOOLEAN NOT NULL DEFAULT true,
  media_learning_enabled     BOOLEAN NOT NULL DEFAULT true,
  retention_days             INT,         -- NULL = keep forever
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_memory_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memory_prefs_owner" ON user_memory_preferences;

CREATE POLICY "memory_prefs_owner" ON user_memory_preferences
  FOR ALL USING (user_id = auth.uid());

-- ─── RPC: similarity search for media analysis embeddings ────────────────────

CREATE OR REPLACE FUNCTION match_media_analysis(
  query_embedding   vector(1536),
  match_count       INT DEFAULT 5,
  filter_user_id    UUID DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  media_id        UUID,
  user_id         UUID,
  summary         TEXT,
  description     TEXT,
  tags            JSONB,
  entities        JSONB,
  similarity      FLOAT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ma.id,
    ma.media_id,
    ma.user_id,
    ma.summary,
    ma.description,
    ma.tags,
    ma.entities,
    1 - (ma.embedding <=> query_embedding) AS similarity,
    ma.created_at
  FROM media_analysis ma
  WHERE (filter_user_id IS NULL OR ma.user_id = filter_user_id)
  ORDER BY ma.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─── RPC: similarity search for media knowledge entries ──────────────────────

CREATE OR REPLACE FUNCTION match_media_knowledge(
  query_embedding   vector(1536),
  match_count       INT DEFAULT 5,
  filter_user_id    UUID DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  media_id    UUID,
  user_id     UUID,
  title       TEXT,
  content     TEXT,
  summary     TEXT,
  tags        JSONB,
  similarity  FLOAT,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mke.id,
    mke.media_id,
    mke.user_id,
    mke.title,
    mke.content,
    mke.summary,
    mke.tags,
    1 - (mke.embedding <=> query_embedding) AS similarity,
    mke.created_at
  FROM media_knowledge_entries mke
  WHERE (filter_user_id IS NULL OR mke.user_id = filter_user_id)
    AND mke.deleted_at IS NULL
  ORDER BY mke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
