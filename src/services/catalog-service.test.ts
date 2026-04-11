/**
 * catalog-service.test.ts — Tests for catalog service logic:
 *   - Dimension/weight display helpers
 *   - Listing readiness evaluator
 *   - CSV export engine
 *   - Template defaults
 *   - CSV header parser
 *   - Source label helpers
 */
import { describe, expect, it } from 'vitest';
import {
  formatDimensions,
  formatWeight,
  hasDimensions,
  hasWeight,
  getChannelRequirements,
  evaluateListingReadiness,
  generateCsvExport,
  validateExportReadiness,
  createDefaultEbayMappingConfig,
  createDefaultWhatnotMappingConfig,
  parseCsvHeaders,
  getSourceLabel,
} from './catalog-service';
import type { CatalogItem, MarketplaceTemplate } from '@/types/catalog';

/* ── Factory helpers ─────────────────────────────────────────── */

function makeItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'item-1',
    user_id: 'user-1',
    slug: null,
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
    sku: 'SKU-001',
    asking_price: 29.99,
    currency: 'USD',
    estimated_low_value: 20,
    estimated_high_value: 40,
    estimated_likely_value: 30,
    ai_confidence_score: 0.85,
    ai_summary: 'Decoded',
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

function makeTemplate(overrides: Partial<MarketplaceTemplate> = {}): MarketplaceTemplate {
  return {
    id: 't-1',
    user_id: 'u-1',
    marketplace: 'ebay',
    template_name: 'eBay Template',
    original_filename: 'template.csv',
    column_headers: ['Title', 'Price', 'Weight'],
    mapping_config: {
      'Title': { catalogField: 'title', templateColumn: 'Title' },
      'Price': { catalogField: 'asking_price', templateColumn: 'Price' },
      'Weight': { catalogField: 'weight_value', templateColumn: 'Weight', transform: 'weight_with_unit' },
    },
    required_columns: ['Title', 'Price'],
    is_default: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/* ── Dimension & weight helpers ──────────────────────────────── */

describe('formatDimensions', () => {
  it('formats complete dimensions', () => {
    const item = makeItem();
    expect(formatDimensions(item)).toBe('10 × 8 × 4 in');
  });

  it('returns null for all-null dimensions', () => {
    const item = makeItem({ height_value: null, width_value: null, length_value: null });
    expect(formatDimensions(item)).toBeNull();
  });

  it('uses ? for partially missing dimensions', () => {
    const item = makeItem({ width_value: null });
    expect(formatDimensions(item)).toBe('10 × ? × 4 in');
  });

  it('respects cm unit', () => {
    const item = makeItem({ dimension_unit: 'cm' });
    expect(formatDimensions(item)).toBe('10 × 8 × 4 cm');
  });
});

describe('formatWeight', () => {
  it('formats weight with unit', () => {
    expect(formatWeight(makeItem())).toBe('2.5 lb');
  });

  it('returns null for null weight', () => {
    expect(formatWeight(makeItem({ weight_value: null }))).toBeNull();
  });

  it('supports different units', () => {
    expect(formatWeight(makeItem({ weight_unit: 'kg' }))).toBe('2.5 kg');
    expect(formatWeight(makeItem({ weight_unit: 'oz' }))).toBe('2.5 oz');
    expect(formatWeight(makeItem({ weight_unit: 'g' }))).toBe('2.5 g');
  });
});

describe('hasDimensions', () => {
  it('returns true when all present', () => {
    expect(hasDimensions(makeItem())).toBe(true);
  });

  it('returns false when any missing', () => {
    expect(hasDimensions(makeItem({ height_value: null }))).toBe(false);
    expect(hasDimensions(makeItem({ width_value: null }))).toBe(false);
    expect(hasDimensions(makeItem({ length_value: null }))).toBe(false);
  });
});

describe('hasWeight', () => {
  it('returns true when present', () => {
    expect(hasWeight(makeItem())).toBe(true);
  });

  it('returns false when null', () => {
    expect(hasWeight(makeItem({ weight_value: null }))).toBe(false);
  });
});

/* ── Channel requirements ────────────────────────────────────── */

describe('getChannelRequirements', () => {
  it('returns requirements for eBay', () => {
    const reqs = getChannelRequirements('ebay');
    expect(reqs.channel).toBe('ebay');
    const fields = reqs.fields.map(f => f.field);
    expect(fields).toContain('title');
    expect(fields).toContain('height_value');
    expect(fields).toContain('weight_value');
  });

  it('returns requirements for Whatnot', () => {
    const reqs = getChannelRequirements('whatnot');
    expect(reqs.channel).toBe('whatnot');
    expect(reqs.fields.some(f => f.field === 'height_value')).toBe(true);
  });

  it('storefront does not require dimensions', () => {
    const reqs = getChannelRequirements('storefront');
    expect(reqs.fields.some(f => f.field === 'height_value')).toBe(false);
  });
});

/* ── Listing readiness evaluator ─────────────────────────────── */

describe('evaluateListingReadiness', () => {
  it('returns channel_ready for fully complete item', () => {
    const report = evaluateListingReadiness(makeItem(), 3);
    expect(report.overallStatus).toBe('channel_ready');
  });

  it('returns incomplete when title is missing', () => {
    const report = evaluateListingReadiness(makeItem({ title: null }), 3);
    expect(report.overallStatus).toBe('incomplete');
    expect(report.catalogChecks.some(c => c.field === 'title' && c.gate === 'blocked')).toBe(true);
  });

  it('blocks channels needing dimensions when dimensions missing', () => {
    const item = makeItem({ height_value: null, width_value: null, length_value: null });
    const report = evaluateListingReadiness(item, 3, ['ebay', 'whatnot', 'storefront']);
    // eBay and Whatnot require dimensions, storefront does not
    expect(report.channelChecks['ebay'].some(c => c.field === 'height_value' && c.gate === 'blocked')).toBe(true);
    expect(report.channelChecks['whatnot'].some(c => c.field === 'height_value' && c.gate === 'blocked')).toBe(true);
    // Storefront should still be ready (no dimension requirement)
    expect(report.channelChecks['storefront'].every(c => c.gate === 'ready')).toBe(true);
  });

  it('blocks when weight is missing for channels that require it', () => {
    const item = makeItem({ weight_value: null });
    const report = evaluateListingReadiness(item, 3, ['ebay']);
    expect(report.channelChecks['ebay'].some(c => c.field === 'weight_value' && c.gate === 'blocked')).toBe(true);
  });

  it('returns marketplace_ready when some channels ready', () => {
    const item = makeItem({ height_value: null }); // missing dim blocks eBay
    const report = evaluateListingReadiness(item, 3, ['storefront', 'ebay']);
    // Storefront ready, eBay blocked
    expect(report.overallStatus).toBe('marketplace_ready');
  });

  it('blocks when no images for channels requiring them', () => {
    const report = evaluateListingReadiness(makeItem(), 0, ['storefront']);
    expect(report.channelChecks['storefront'].some(c => c.field === 'images' && c.gate === 'blocked')).toBe(true);
  });

  it('catalog_ready when basics OK but all channels blocked', () => {
    const item = makeItem({ asking_price: null, description: null, height_value: null });
    const report = evaluateListingReadiness(item, 0, ['ebay']);
    expect(report.overallStatus).toBe('catalog_ready');
  });
});

/* ── CSV export engine ───────────────────────────────────────── */

describe('generateCsvExport', () => {
  it('generates a valid CSV with header and data rows', () => {
    const items = [makeItem()];
    const template = makeTemplate();
    const result = generateCsvExport(items, template);

    expect(result.rowCount).toBe(1);
    expect(result.filename).toContain('ebay-export-');
    expect(result.csv).toContain('Title,Price,Weight');
    expect(result.csv).toContain('Test Item');
    expect(result.csv).toContain('29.99');
    expect(result.csv).toContain('2.5 lb');
  });

  it('generates empty data rows for unmapped columns', () => {
    const template = makeTemplate({
      column_headers: ['Title', 'Price', 'Unmapped Column'],
      mapping_config: {
        'Title': { catalogField: 'title', templateColumn: 'Title' },
        'Price': { catalogField: 'asking_price', templateColumn: 'Price' },
      },
    });
    const result = generateCsvExport([makeItem()], template);
    const lines = result.csv.split('\n');
    expect(lines[0]).toBe('Title,Price,Unmapped Column');
    // Data row should have empty value for unmapped column
    expect(lines[1]).toMatch(/Test Item,29\.99,$/);
  });

  it('escapes commas and quotes in CSV values', () => {
    const item = makeItem({ title: 'Item, with "quotes"' });
    const template = makeTemplate({
      column_headers: ['Title'],
      mapping_config: { 'Title': { catalogField: 'title', templateColumn: 'Title' } },
      required_columns: [],
    });
    const result = generateCsvExport([item], template);
    expect(result.csv).toContain('"Item, with ""quotes"""');
  });

  it('handles multiple items', () => {
    const items = [makeItem(), makeItem({ id: 'item-2', title: 'Second Item' })];
    const result = generateCsvExport(items, makeTemplate());
    expect(result.rowCount).toBe(2);
    const lines = result.csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('applies dimension_with_unit transform', () => {
    const template = makeTemplate({
      column_headers: ['Height'],
      mapping_config: {
        'Height': { catalogField: 'height_value', templateColumn: 'Height', transform: 'dimension_with_unit' },
      },
      required_columns: [],
    });
    const result = generateCsvExport([makeItem()], template);
    expect(result.csv).toContain('10 in');
  });
});

describe('validateExportReadiness', () => {
  it('returns valid for complete items and mapped template', () => {
    const result = validateExportReadiness([makeItem()], makeTemplate());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports error for unmapped required column', () => {
    const template = makeTemplate({
      required_columns: ['Title', 'Missing Column'],
    });
    const result = validateExportReadiness([makeItem()], template);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Missing Column'))).toBe(true);
  });

  it('reports error for item missing required field value', () => {
    const item = makeItem({ title: null });
    const result = validateExportReadiness([item], makeTemplate());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('title'))).toBe(true);
  });
});

/* ── Default template factories ──────────────────────────────── */

describe('createDefaultEbayMappingConfig', () => {
  it('creates mappings for common eBay fields', () => {
    const config = createDefaultEbayMappingConfig();
    expect(config['Title']).toBeDefined();
    expect(config['Price']).toBeDefined();
    expect(config['Item Height']).toBeDefined();
    expect(config['Item Weight']).toBeDefined();
    expect(config['Item Height'].transform).toBe('dimension_with_unit');
    expect(config['Item Weight'].transform).toBe('weight_with_unit');
  });
});

describe('createDefaultWhatnotMappingConfig', () => {
  it('creates mappings for common Whatnot fields', () => {
    const config = createDefaultWhatnotMappingConfig();
    expect(config['Title']).toBeDefined();
    expect(config['Starting Price']).toBeDefined();
    expect(config['Height']).toBeDefined();
    expect(config['Weight']).toBeDefined();
    expect(config['Weight'].transform).toBe('weight_with_unit');
  });
});

/* ── CSV header parser ───────────────────────────────────────── */

describe('parseCsvHeaders', () => {
  it('parses simple comma-separated headers', () => {
    expect(parseCsvHeaders('Title,Price,Category')).toEqual(['Title', 'Price', 'Category']);
  });

  it('handles quoted headers', () => {
    expect(parseCsvHeaders('"Title","Price","Item Height"')).toEqual(['Title', 'Price', 'Item Height']);
  });

  it('handles mixed quoted and unquoted', () => {
    expect(parseCsvHeaders('Title,"Item Height",Price')).toEqual(['Title', 'Item Height', 'Price']);
  });

  it('returns empty array for empty string', () => {
    expect(parseCsvHeaders('')).toEqual([]);
  });

  it('only parses first line', () => {
    expect(parseCsvHeaders('Title,Price\nData1,9.99')).toEqual(['Title', 'Price']);
  });

  it('trims whitespace from headers', () => {
    expect(parseCsvHeaders(' Title , Price , Weight ')).toEqual(['Title', 'Price', 'Weight']);
  });
});

/* ── Source label helpers ────────────────────────────────────── */

describe('getSourceLabel', () => {
  it('returns human-readable labels', () => {
    expect(getSourceLabel('ai_estimated')).toBe('AI Estimated');
    expect(getSourceLabel('seller_entered')).toBe('Seller Entered');
    expect(getSourceLabel('seller_confirmed')).toBe('Seller Confirmed');
    expect(getSourceLabel('image_detected')).toBe('AI Detected');
    expect(getSourceLabel('label_detected')).toBe('Label Detected');
  });

  it('returns "Not set" for null', () => {
    expect(getSourceLabel(null)).toBe('Not set');
  });

  it('returns raw value for unknown source', () => {
    expect(getSourceLabel('unknown_source')).toBe('unknown_source');
  });
});
