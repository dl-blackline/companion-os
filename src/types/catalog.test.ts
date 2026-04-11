/**
 * catalog.test.ts — Tests for catalog types and type-level assertions.
 */
import { describe, expect, it } from 'vitest';
import type {
  CatalogItem,
  CatalogDimensions,
  CatalogWeight,
  CatalogItemCondition,
  CatalogItemStatus,
  CatalogPublishStatus,
  DimensionUnit,
  WeightUnit,
  MeasurementSource,
  ListingReadinessStatus,
  MarketplaceChannel,
  PublicationType,
  PublicationStatus,
  DecoderOutput,
  MarketplaceTemplate,
  CatalogChannelPublication,
  MarketplaceFieldMapping,
  ReadinessCheck,
  ListingReadinessReport,
  ChannelRequirements,
  CsvExportResult,
} from './catalog';

/* ── Factory helpers ─────────────────────────────────────────── */

function makeCatalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'item-1',
    user_id: 'user-1',
    slug: 'test-item',
    title: 'Test Item',
    category: 'Electronics',
    subcategory: null,
    brand: 'TestBrand',
    model: null,
    variant: null,
    condition: 'good',
    description: 'A test item',
    internal_notes: null,
    quantity: 1,
    sku: null,
    asking_price: 29.99,
    currency: 'USD',
    estimated_low_value: 20,
    estimated_high_value: 40,
    estimated_likely_value: 30,
    ai_confidence_score: 0.85,
    ai_summary: 'Decoded from image',
    height_value: 10,
    width_value: 8,
    length_value: 4,
    dimension_unit: 'in',
    dimensions_source: 'ai_estimated',
    dimensions_confirmed: false,
    weight_value: 2.5,
    weight_unit: 'lb',
    weight_source: 'seller_entered',
    weight_confirmed: true,
    status: 'priced',
    publish_status: 'hidden',
    listing_readiness_status: 'marketplace_ready',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/* ── Type assertion tests ────────────────────────────────────── */

describe('Catalog types', () => {
  it('CatalogItem has all dimension fields', () => {
    const item = makeCatalogItem();
    expect(item.height_value).toBe(10);
    expect(item.width_value).toBe(8);
    expect(item.length_value).toBe(4);
    expect(item.dimension_unit).toBe('in');
    expect(item.dimensions_source).toBe('ai_estimated');
    expect(item.dimensions_confirmed).toBe(false);
  });

  it('CatalogItem has all weight fields', () => {
    const item = makeCatalogItem();
    expect(item.weight_value).toBe(2.5);
    expect(item.weight_unit).toBe('lb');
    expect(item.weight_source).toBe('seller_entered');
    expect(item.weight_confirmed).toBe(true);
  });

  it('CatalogItem accepts null dimension/weight values', () => {
    const item = makeCatalogItem({
      height_value: null,
      width_value: null,
      length_value: null,
      weight_value: null,
      dimensions_source: null,
      weight_source: null,
    });
    expect(item.height_value).toBeNull();
    expect(item.weight_value).toBeNull();
  });

  it('DimensionUnit accepts in and cm', () => {
    const units: DimensionUnit[] = ['in', 'cm'];
    expect(units).toHaveLength(2);
  });

  it('WeightUnit accepts lb, oz, kg, g', () => {
    const units: WeightUnit[] = ['lb', 'oz', 'kg', 'g'];
    expect(units).toHaveLength(4);
  });

  it('MeasurementSource accepts all valid sources', () => {
    const sources: MeasurementSource[] = [
      'image_detected', 'label_detected', 'ai_estimated',
      'seller_entered', 'seller_confirmed',
    ];
    expect(sources).toHaveLength(5);
  });

  it('CatalogItemCondition includes all valid conditions', () => {
    const conditions: CatalogItemCondition[] = [
      'new', 'like_new', 'excellent', 'good', 'fair', 'poor', 'for_parts',
    ];
    expect(conditions).toHaveLength(7);
  });

  it('CatalogItemStatus includes all valid statuses', () => {
    const statuses: CatalogItemStatus[] = [
      'draft', 'needs_review', 'ready_to_price', 'priced', 'published',
      'pending_sale', 'sold', 'archived',
    ];
    expect(statuses).toHaveLength(8);
  });

  it('ListingReadinessStatus includes all levels', () => {
    const statuses: ListingReadinessStatus[] = [
      'incomplete', 'catalog_ready', 'marketplace_ready', 'channel_ready',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('MarketplaceChannel includes all supported channels', () => {
    const channels: MarketplaceChannel[] = [
      'storefront', 'whatnot', 'ebay', 'facebook_marketplace', 'custom',
    ];
    expect(channels).toHaveLength(5);
  });

  it('CatalogPublishStatus has all states', () => {
    const ps: CatalogPublishStatus[] = ['hidden', 'published', 'sold_out', 'removed'];
    expect(ps).toHaveLength(4);
  });

  it('PublicationType has all options', () => {
    const pt: PublicationType[] = ['csv_export', 'direct_api', 'manual'];
    expect(pt).toHaveLength(3);
  });

  it('PublicationStatus has all states', () => {
    const ps: PublicationStatus[] = ['pending', 'exported', 'published', 'failed', 'withdrawn'];
    expect(ps).toHaveLength(5);
  });

  it('DecoderOutput can represent full and partial decodes', () => {
    const full: DecoderOutput = {
      title: 'Decoded Item',
      category: 'Toys',
      subcategory: null,
      brand: 'BrandX',
      model: 'M100',
      variant: null,
      condition: 'good',
      description: 'A toy',
      height_value: 5,
      width_value: 3,
      length_value: 2,
      dimension_unit: 'in',
      dimensions_source: 'ai_estimated',
      weight_value: 0.5,
      weight_unit: 'lb',
      weight_source: 'ai_estimated',
      estimated_low_value: 10,
      estimated_high_value: 30,
      estimated_likely_value: 20,
      ai_confidence_score: 0.75,
      ai_summary: 'Decoded',
      field_confidence: [{ field: 'title', value: 'Decoded Item', confidence: 0.9, source: 'ai_decoded' }],
      questions: [],
      attributes: [{ key: 'color', value: 'red', source: 'ai_decoded' }],
    };
    expect(full.title).toBe('Decoded Item');
    expect(full.questions).toHaveLength(0);

    const partial: DecoderOutput = {
      ...full,
      height_value: null,
      width_value: null,
      length_value: null,
      dimensions_source: null,
      weight_value: null,
      weight_source: null,
      ai_confidence_score: 0.3,
      questions: ['What are the dimensions?', 'How much does it weigh?'],
    };
    expect(partial.height_value).toBeNull();
    expect(partial.questions).toHaveLength(2);
  });

  it('MarketplaceTemplate can represent eBay and Whatnot templates', () => {
    const ebay: MarketplaceTemplate = {
      id: 't-1',
      user_id: 'u-1',
      marketplace: 'ebay',
      template_name: 'eBay Bulk Upload',
      original_filename: 'ebay-template.csv',
      column_headers: ['Title', 'Price', 'Description', 'Item Height'],
      mapping_config: {
        'Title': { catalogField: 'title', templateColumn: 'Title' },
        'Price': { catalogField: 'asking_price', templateColumn: 'Price' },
        'Item Height': { catalogField: 'height_value', templateColumn: 'Item Height', transform: 'dimension_with_unit' },
      },
      required_columns: ['Title', 'Price'],
      is_default: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(ebay.marketplace).toBe('ebay');
    expect(ebay.column_headers).toHaveLength(4);

    const whatnot: MarketplaceTemplate = {
      ...ebay,
      id: 't-2',
      marketplace: 'whatnot',
      template_name: 'Whatnot Listing',
      column_headers: ['Title', 'Starting Price', 'Category'],
      mapping_config: {
        'Title': { catalogField: 'title', templateColumn: 'Title' },
      },
      required_columns: ['Title'],
    };
    expect(whatnot.marketplace).toBe('whatnot');
  });

  it('CatalogChannelPublication tracks publication per channel', () => {
    const pub: CatalogChannelPublication = {
      id: 'pub-1',
      item_id: 'item-1',
      user_id: 'user-1',
      channel: 'ebay',
      publication_type: 'csv_export',
      publication_status: 'exported',
      external_listing_id: null,
      export_template_id: 't-1',
      last_synced_at: '2026-01-01T00:00:00Z',
      last_error: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(pub.channel).toBe('ebay');
    expect(pub.publication_status).toBe('exported');
  });

  it('MarketplaceFieldMapping supports transform option', () => {
    const mapping: MarketplaceFieldMapping = {
      catalogField: 'height_value',
      templateColumn: 'Item Height',
      transform: 'dimension_with_unit',
    };
    expect(mapping.transform).toBe('dimension_with_unit');
  });

  it('ReadinessCheck captures gate state', () => {
    const check: ReadinessCheck = {
      field: 'weight_value',
      label: 'Weight',
      gate: 'blocked',
      message: 'Weight is required',
    };
    expect(check.gate).toBe('blocked');
  });

  it('ListingReadinessReport aggregates checks', () => {
    const report: ListingReadinessReport = {
      overallStatus: 'incomplete',
      catalogChecks: [],
      channelChecks: {
        storefront: [],
        whatnot: [],
        ebay: [],
        facebook_marketplace: [],
        custom: [],
      },
    };
    expect(report.overallStatus).toBe('incomplete');
  });

  it('ChannelRequirements describes channel fields', () => {
    const reqs: ChannelRequirements = {
      channel: 'ebay',
      fields: [
        { field: 'title', label: 'Title', required: true },
        { field: 'height_value', label: 'Height', required: true },
      ],
    };
    expect(reqs.fields).toHaveLength(2);
  });

  it('CsvExportResult carries csv data and metadata', () => {
    const result: CsvExportResult = {
      csv: 'Title,Price\nTest,9.99',
      filename: 'ebay-export.csv',
      rowCount: 1,
      warnings: [],
    };
    expect(result.csv).toContain('Title');
    expect(result.rowCount).toBe(1);
  });
});
