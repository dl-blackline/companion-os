// ─── Catalog Commerce Types ──────────────────────────────────
// First-class types for catalog items, dimensions, weight,
// marketplace templates, channel publications, and listing readiness.

/* ── Enums / unions ──────────────────────────────────────────── */

export type CatalogItemCondition =
  | 'new'
  | 'like_new'
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'for_parts';

export type CatalogItemStatus =
  | 'draft'
  | 'needs_review'
  | 'ready_to_price'
  | 'priced'
  | 'published'
  | 'pending_sale'
  | 'sold'
  | 'archived';

export type CatalogPublishStatus = 'hidden' | 'published' | 'sold_out' | 'removed';

export type DimensionUnit = 'in' | 'cm';
export type WeightUnit = 'lb' | 'oz' | 'kg' | 'g';

export type MeasurementSource =
  | 'image_detected'
  | 'label_detected'
  | 'ai_estimated'
  | 'seller_entered'
  | 'seller_confirmed';

export type ListingReadinessStatus =
  | 'incomplete'
  | 'catalog_ready'
  | 'marketplace_ready'
  | 'channel_ready';

export type MarketplaceChannel =
  | 'storefront'
  | 'whatnot'
  | 'ebay'
  | 'facebook_marketplace'
  | 'custom';

export type PublicationType = 'csv_export' | 'direct_api' | 'manual';

export type PublicationStatus = 'pending' | 'exported' | 'published' | 'failed' | 'withdrawn';

export type AttributeSource = 'ai_decoded' | 'ai_estimated' | 'seller_entered' | 'seller_confirmed';

/* ── Dimensions & Weight ─────────────────────────────────────── */

export interface CatalogDimensions {
  height_value: number | null;
  width_value: number | null;
  length_value: number | null;
  dimension_unit: DimensionUnit;
  dimensions_source: MeasurementSource | null;
  dimensions_confirmed: boolean;
}

export interface CatalogWeight {
  weight_value: number | null;
  weight_unit: WeightUnit;
  weight_source: MeasurementSource | null;
  weight_confirmed: boolean;
}

/* ── Core catalog item ───────────────────────────────────────── */

export interface CatalogItem extends CatalogDimensions, CatalogWeight {
  id: string;
  user_id: string;
  slug: string | null;
  title: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  condition: CatalogItemCondition | null;
  description: string | null;
  internal_notes: string | null;
  quantity: number;
  sku: string | null;

  asking_price: number | null;
  currency: string;
  estimated_low_value: number | null;
  estimated_high_value: number | null;
  estimated_likely_value: number | null;

  ai_confidence_score: number | null;
  ai_summary: string | null;

  status: CatalogItemStatus;
  publish_status: CatalogPublishStatus;
  listing_readiness_status: ListingReadinessStatus;

  created_at: string;
  updated_at: string;
}

/* ── Related entities ────────────────────────────────────────── */

export interface CatalogItemImage {
  id: string;
  item_id: string;
  user_id: string;
  storage_path: string;
  sort_order: number;
  alt_text: string | null;
  created_at: string;
}

export interface CatalogItemAttribute {
  id: string;
  item_id: string;
  key: string;
  value: string;
  source: AttributeSource | null;
}

export interface CatalogItemQuestion {
  id: string;
  item_id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
}

/* ── Marketplace templates ───────────────────────────────────── */

export interface MarketplaceFieldMapping {
  /** Catalog field name (e.g. 'title', 'height_value') */
  catalogField: string;
  /** Template column header the catalog field maps to */
  templateColumn: string;
  /** Optional transform: 'none' | 'dimension_with_unit' | 'weight_with_unit' | 'custom' */
  transform?: string;
}

export interface MarketplaceTemplate {
  id: string;
  user_id: string;
  marketplace: MarketplaceChannel;
  template_name: string;
  original_filename: string | null;
  column_headers: string[];
  mapping_config: Record<string, MarketplaceFieldMapping>;
  required_columns: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/* ── Channel publications ────────────────────────────────────── */

export interface CatalogChannelPublication {
  id: string;
  item_id: string;
  user_id: string;
  channel: MarketplaceChannel;
  publication_type: PublicationType;
  publication_status: PublicationStatus;
  external_listing_id: string | null;
  export_template_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/* ── AI Decoder output ───────────────────────────────────────── */

export interface DecoderFieldConfidence {
  field: string;
  value: unknown;
  confidence: number;
  source: MeasurementSource | AttributeSource;
}

export interface DecoderOutput {
  title: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  condition: CatalogItemCondition | null;
  description: string | null;

  height_value: number | null;
  width_value: number | null;
  length_value: number | null;
  dimension_unit: DimensionUnit;
  dimensions_source: MeasurementSource | null;

  weight_value: number | null;
  weight_unit: WeightUnit;
  weight_source: MeasurementSource | null;

  estimated_low_value: number | null;
  estimated_high_value: number | null;
  estimated_likely_value: number | null;
  ai_confidence_score: number;
  ai_summary: string | null;

  field_confidence: DecoderFieldConfidence[];
  questions: string[];
  attributes: Array<{ key: string; value: string; source: AttributeSource }>;
}

/* ── Listing readiness evaluation ────────────────────────────── */

export type ReadinessGate = 'ready' | 'warning' | 'blocked';

export interface ReadinessCheck {
  field: string;
  label: string;
  gate: ReadinessGate;
  message: string;
}

export interface ListingReadinessReport {
  overallStatus: ListingReadinessStatus;
  catalogChecks: ReadinessCheck[];
  channelChecks: Record<MarketplaceChannel, ReadinessCheck[]>;
}

/* ── Channel requirements registry ───────────────────────────── */

export interface ChannelFieldRequirement {
  field: string;
  label: string;
  required: boolean;
}

export interface ChannelRequirements {
  channel: MarketplaceChannel;
  fields: ChannelFieldRequirement[];
}

/* ── Export result ────────────────────────────────────────────── */

export interface CsvExportResult {
  csv: string;
  filename: string;
  rowCount: number;
  warnings: string[];
}
