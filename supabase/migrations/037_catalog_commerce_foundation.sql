-- ============================================================
-- Migration 037: Catalog Commerce Foundation
--
-- Creates core catalog tables with first-class support for:
--   - catalog items with dimensions, weight, and listing readiness
--   - catalog item images
--   - catalog item attributes (key/value with source tracking)
--   - catalog item questions (AI follow-up / seller answers)
--   - marketplace templates (Whatnot, eBay, future channels)
--   - channel publications (multi-channel syndication tracking)
-- ============================================================

-- ── catalog_items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug                   TEXT,
  title                  TEXT,
  category               TEXT,
  subcategory            TEXT,
  brand                  TEXT,
  model                  TEXT,
  variant                TEXT,
  condition              TEXT CHECK (condition IS NULL OR condition IN (
    'new', 'like_new', 'excellent', 'good', 'fair', 'poor', 'for_parts'
  )),
  description            TEXT,
  internal_notes         TEXT,
  quantity               INTEGER NOT NULL DEFAULT 1,
  sku                    TEXT,

  -- pricing ──────────────────────────────────────────────────
  asking_price           NUMERIC,
  currency               TEXT NOT NULL DEFAULT 'USD',
  estimated_low_value    NUMERIC,
  estimated_high_value   NUMERIC,
  estimated_likely_value NUMERIC,

  -- AI decode metadata ───────────────────────────────────────
  ai_confidence_score    NUMERIC,
  ai_summary             TEXT,

  -- dimensions ───────────────────────────────────────────────
  height_value           NUMERIC,
  width_value            NUMERIC,
  length_value           NUMERIC,
  dimension_unit         TEXT NOT NULL DEFAULT 'in' CHECK (dimension_unit IN ('in', 'cm')),
  dimensions_source      TEXT CHECK (dimensions_source IS NULL OR dimensions_source IN (
    'image_detected', 'label_detected', 'ai_estimated', 'seller_entered', 'seller_confirmed'
  )),
  dimensions_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,

  -- weight ───────────────────────────────────────────────────
  weight_value           NUMERIC,
  weight_unit            TEXT NOT NULL DEFAULT 'lb' CHECK (weight_unit IN ('lb', 'oz', 'kg', 'g')),
  weight_source          TEXT CHECK (weight_source IS NULL OR weight_source IN (
    'image_detected', 'label_detected', 'ai_estimated', 'seller_entered', 'seller_confirmed'
  )),
  weight_confirmed       BOOLEAN NOT NULL DEFAULT FALSE,

  -- statuses ─────────────────────────────────────────────────
  status                 TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'needs_review', 'ready_to_price', 'priced', 'published',
    'pending_sale', 'sold', 'archived'
  )),
  publish_status         TEXT NOT NULL DEFAULT 'hidden' CHECK (publish_status IN (
    'hidden', 'published', 'sold_out', 'removed'
  )),
  listing_readiness_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (listing_readiness_status IN (
    'incomplete', 'catalog_ready', 'marketplace_ready', 'channel_ready'
  )),

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_user_id ON catalog_items(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_status  ON catalog_items(status);
CREATE INDEX IF NOT EXISTS idx_catalog_items_slug    ON catalog_items(slug);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_items_self"
  ON catalog_items FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── catalog_item_images ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_item_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  alt_text      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_item_images_item_id ON catalog_item_images(item_id);

ALTER TABLE catalog_item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_item_images_self"
  ON catalog_item_images FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── catalog_item_attributes ─────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_item_attributes (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id  UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  source   TEXT CHECK (source IS NULL OR source IN (
    'ai_decoded', 'ai_estimated', 'seller_entered', 'seller_confirmed'
  ))
);

CREATE INDEX IF NOT EXISTS idx_catalog_item_attributes_item_id ON catalog_item_attributes(item_id);

ALTER TABLE catalog_item_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_item_attributes_self"
  ON catalog_item_attributes FOR ALL
  USING (
    item_id IN (SELECT id FROM catalog_items WHERE user_id = auth.uid())
  )
  WITH CHECK (
    item_id IN (SELECT id FROM catalog_items WHERE user_id = auth.uid())
  );

-- ── catalog_item_questions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_item_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT,
  answered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_catalog_item_questions_item_id ON catalog_item_questions(item_id);

ALTER TABLE catalog_item_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_item_questions_self"
  ON catalog_item_questions FOR ALL
  USING (
    item_id IN (SELECT id FROM catalog_items WHERE user_id = auth.uid())
  )
  WITH CHECK (
    item_id IN (SELECT id FROM catalog_items WHERE user_id = auth.uid())
  );

-- ── marketplace_templates ───────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace         TEXT NOT NULL CHECK (marketplace IN (
    'whatnot', 'ebay', 'facebook_marketplace', 'storefront', 'custom'
  )),
  template_name       TEXT NOT NULL,
  original_filename   TEXT,
  column_headers      JSONB NOT NULL DEFAULT '[]'::JSONB,
  mapping_config      JSONB NOT NULL DEFAULT '{}'::JSONB,
  required_columns    JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_default          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_templates_user_id ON marketplace_templates(user_id);

ALTER TABLE marketplace_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_templates_self"
  ON marketplace_templates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── catalog_channel_publications ────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_channel_publications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id              UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel              TEXT NOT NULL CHECK (channel IN (
    'storefront', 'whatnot', 'ebay', 'facebook_marketplace', 'custom'
  )),
  publication_type     TEXT NOT NULL DEFAULT 'csv_export' CHECK (publication_type IN (
    'csv_export', 'direct_api', 'manual'
  )),
  publication_status   TEXT NOT NULL DEFAULT 'pending' CHECK (publication_status IN (
    'pending', 'exported', 'published', 'failed', 'withdrawn'
  )),
  external_listing_id  TEXT,
  export_template_id   UUID REFERENCES marketplace_templates(id),
  last_synced_at       TIMESTAMPTZ,
  last_error           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_channel_pubs_item_id ON catalog_channel_publications(item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_channel_pubs_user_id ON catalog_channel_publications(user_id);

ALTER TABLE catalog_channel_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_channel_publications_self"
  ON catalog_channel_publications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
