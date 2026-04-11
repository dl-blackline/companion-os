/**
 * catalog-service.ts — Core catalog business logic.
 *
 * Responsibilities:
 *   - Listing readiness evaluation (catalog-ready / marketplace-ready / channel-ready)
 *   - Channel requirement registry
 *   - CSV export engine (template-driven, supports Whatnot, eBay, and future channels)
 *   - Dimension / weight helpers
 */

import type {
  CatalogItem,
  CatalogDimensions,
  CatalogWeight,
  ChannelFieldRequirement,
  ChannelRequirements,
  CsvExportResult,
  DimensionUnit,
  ListingReadinessReport,
  ListingReadinessStatus,
  MarketplaceChannel,
  MarketplaceFieldMapping,
  MarketplaceTemplate,
  ReadinessCheck,
  ReadinessGate,
  WeightUnit,
} from '@/types/catalog';

/* ═══════════════════════════════════════════════════════════════
   1. Dimension & weight display helpers
   ═══════════════════════════════════════════════════════════════ */

const DIMENSION_LABELS: Record<DimensionUnit, string> = { in: 'in', cm: 'cm' };
const WEIGHT_LABELS: Record<WeightUnit, string> = { lb: 'lb', oz: 'oz', kg: 'kg', g: 'g' };

export function formatDimensions(d: CatalogDimensions): string | null {
  const { height_value, width_value, length_value, dimension_unit } = d;
  if (height_value == null && width_value == null && length_value == null) return null;
  const parts = [
    height_value != null ? `${height_value}` : '?',
    width_value != null ? `${width_value}` : '?',
    length_value != null ? `${length_value}` : '?',
  ];
  return `${parts.join(' × ')} ${DIMENSION_LABELS[dimension_unit]}`;
}

export function formatWeight(w: CatalogWeight): string | null {
  if (w.weight_value == null) return null;
  return `${w.weight_value} ${WEIGHT_LABELS[w.weight_unit]}`;
}

export function hasDimensions(d: CatalogDimensions): boolean {
  return d.height_value != null && d.width_value != null && d.length_value != null;
}

export function hasWeight(w: CatalogWeight): boolean {
  return w.weight_value != null;
}

/* ═══════════════════════════════════════════════════════════════
   2. Channel requirements registry
   ═══════════════════════════════════════════════════════════════ */

/** Fields every marketplace channel can require.  */
const COMMON_REQUIRED: ChannelFieldRequirement[] = [
  { field: 'title', label: 'Title', required: true },
  { field: 'asking_price', label: 'Price', required: true },
  { field: 'description', label: 'Description', required: true },
  { field: 'category', label: 'Category', required: true },
  { field: 'condition', label: 'Condition', required: true },
];

const SHIPPING_FIELDS: ChannelFieldRequirement[] = [
  { field: 'height_value', label: 'Height', required: true },
  { field: 'width_value', label: 'Width', required: true },
  { field: 'length_value', label: 'Length', required: true },
  { field: 'weight_value', label: 'Weight', required: true },
];

const IMAGE_FIELD: ChannelFieldRequirement = { field: 'images', label: 'Images', required: true };

const CHANNEL_REGISTRY: Record<MarketplaceChannel, ChannelRequirements> = {
  storefront: {
    channel: 'storefront',
    fields: [...COMMON_REQUIRED, IMAGE_FIELD],
  },
  whatnot: {
    channel: 'whatnot',
    fields: [...COMMON_REQUIRED, IMAGE_FIELD, ...SHIPPING_FIELDS],
  },
  ebay: {
    channel: 'ebay',
    fields: [...COMMON_REQUIRED, IMAGE_FIELD, ...SHIPPING_FIELDS],
  },
  facebook_marketplace: {
    channel: 'facebook_marketplace',
    fields: [...COMMON_REQUIRED, IMAGE_FIELD],
  },
  custom: {
    channel: 'custom',
    fields: [...COMMON_REQUIRED],
  },
};

export function getChannelRequirements(channel: MarketplaceChannel): ChannelRequirements {
  return CHANNEL_REGISTRY[channel];
}

/* ═══════════════════════════════════════════════════════════════
   3. Listing readiness evaluator
   ═══════════════════════════════════════════════════════════════ */

function checkField(
  item: CatalogItem,
  field: string,
  label: string,
  required: boolean,
  _imageCount?: number,
): ReadinessCheck {
  // Special: images check uses supplied count
  if (field === 'images') {
    const count = _imageCount ?? 0;
    if (required && count === 0) {
      return { field, label, gate: 'blocked', message: `${label} required — none uploaded` };
    }
    return { field, label, gate: 'ready', message: `${count} image(s)` };
  }

  const value = (item as Record<string, unknown>)[field];
  if (value == null || value === '' || value === 0) {
    return {
      field,
      label,
      gate: required ? 'blocked' : 'warning',
      message: required ? `${label} is required` : `${label} is missing`,
    };
  }
  return { field, label, gate: 'ready', message: 'OK' };
}

/**
 * Evaluate listing readiness for a catalog item.
 * Returns an overall status plus per-field checks for catalog and each channel.
 */
export function evaluateListingReadiness(
  item: CatalogItem,
  imageCount: number = 0,
  channels: MarketplaceChannel[] = ['storefront', 'whatnot', 'ebay'],
): ListingReadinessReport {
  // Catalog-level checks: title, category, condition
  const catalogFields: ChannelFieldRequirement[] = [
    { field: 'title', label: 'Title', required: true },
    { field: 'category', label: 'Category', required: true },
    { field: 'condition', label: 'Condition', required: true },
  ];
  const catalogChecks = catalogFields.map((f) =>
    checkField(item, f.field, f.label, f.required, imageCount),
  );

  const catalogBlocked = catalogChecks.some((c) => c.gate === 'blocked');

  // Channel-level checks
  const channelChecks: Record<MarketplaceChannel, ReadinessCheck[]> = {} as Record<
    MarketplaceChannel,
    ReadinessCheck[]
  >;
  let allChannelsReady = true;
  let anyChannelReady = false;

  for (const ch of channels) {
    const reqs = getChannelRequirements(ch);
    channelChecks[ch] = reqs.fields.map((f) =>
      checkField(item, f.field, f.label, f.required, imageCount),
    );
    const blocked = channelChecks[ch].some((c) => c.gate === 'blocked');
    if (blocked) allChannelsReady = false;
    else anyChannelReady = true;
  }

  let overallStatus: ListingReadinessStatus = 'incomplete';
  if (!catalogBlocked) {
    overallStatus = 'catalog_ready';
    if (anyChannelReady) overallStatus = 'marketplace_ready';
    if (allChannelsReady) overallStatus = 'channel_ready';
  }

  return { overallStatus, catalogChecks, channelChecks };
}

/* ═══════════════════════════════════════════════════════════════
   4. CSV export engine (template-driven)
   ═══════════════════════════════════════════════════════════════ */

/** Escape a CSV cell per RFC 4180. */
function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Resolve a catalog field value, applying optional transforms.
 */
function resolveFieldValue(
  item: CatalogItem,
  mapping: MarketplaceFieldMapping,
): string {
  const raw = (item as Record<string, unknown>)[mapping.catalogField];

  if (raw == null) return '';

  // Transform: combine dimension value + unit
  if (mapping.transform === 'dimension_with_unit') {
    return `${raw} ${DIMENSION_LABELS[item.dimension_unit]}`;
  }
  if (mapping.transform === 'weight_with_unit') {
    return `${raw} ${WEIGHT_LABELS[item.weight_unit]}`;
  }

  return String(raw);
}

/**
 * Generate a CSV string for a set of catalog items using a marketplace template.
 */
export function generateCsvExport(
  items: CatalogItem[],
  template: MarketplaceTemplate,
): CsvExportResult {
  const warnings: string[] = [];
  const headers = template.column_headers;
  const mappingConfig = template.mapping_config;

  // Header row
  const headerRow = headers.map(csvEscape).join(',');

  // Data rows
  const dataRows = items.map((item) => {
    return headers
      .map((col) => {
        const mapping = mappingConfig[col];
        if (!mapping) return '';
        return csvEscape(resolveFieldValue(item, mapping));
      })
      .join(',');
  });

  const csv = [headerRow, ...dataRows].join('\n');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${template.marketplace}-export-${ts}.csv`;

  return { csv, filename, rowCount: items.length, warnings };
}

/**
 * Validate that required columns are mapped and items have values for them.
 */
export function validateExportReadiness(
  items: CatalogItem[],
  template: MarketplaceTemplate,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check that all required columns have a mapping
  for (const reqCol of template.required_columns) {
    if (!template.mapping_config[reqCol]) {
      errors.push(`Required column "${reqCol}" has no field mapping`);
    }
  }

  // Check that each item has values for required mapped fields
  for (const reqCol of template.required_columns) {
    const mapping = template.mapping_config[reqCol];
    if (!mapping) continue;

    for (const item of items) {
      const val = (item as Record<string, unknown>)[mapping.catalogField];
      if (val == null || val === '') {
        errors.push(
          `Item "${item.title ?? item.id}" is missing required field "${mapping.catalogField}" for column "${reqCol}"`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/* ═══════════════════════════════════════════════════════════════
   5. Default template factories
   ═══════════════════════════════════════════════════════════════ */

/**
 * Create a sensible default eBay mapping config for common eBay CSV headers.
 */
export function createDefaultEbayMappingConfig(): Record<string, MarketplaceFieldMapping> {
  return {
    'Title': { catalogField: 'title', templateColumn: 'Title' },
    'Description': { catalogField: 'description', templateColumn: 'Description' },
    'Category': { catalogField: 'category', templateColumn: 'Category' },
    'Price': { catalogField: 'asking_price', templateColumn: 'Price' },
    'Quantity': { catalogField: 'quantity', templateColumn: 'Quantity' },
    'Condition': { catalogField: 'condition', templateColumn: 'Condition' },
    'Brand': { catalogField: 'brand', templateColumn: 'Brand' },
    'Item Height': { catalogField: 'height_value', templateColumn: 'Item Height', transform: 'dimension_with_unit' },
    'Item Width': { catalogField: 'width_value', templateColumn: 'Item Width', transform: 'dimension_with_unit' },
    'Item Length': { catalogField: 'length_value', templateColumn: 'Item Length', transform: 'dimension_with_unit' },
    'Item Weight': { catalogField: 'weight_value', templateColumn: 'Item Weight', transform: 'weight_with_unit' },
    'SKU': { catalogField: 'sku', templateColumn: 'SKU' },
  };
}

/**
 * Create a sensible default Whatnot mapping config.
 */
export function createDefaultWhatnotMappingConfig(): Record<string, MarketplaceFieldMapping> {
  return {
    'Title': { catalogField: 'title', templateColumn: 'Title' },
    'Description': { catalogField: 'description', templateColumn: 'Description' },
    'Category': { catalogField: 'category', templateColumn: 'Category' },
    'Starting Price': { catalogField: 'asking_price', templateColumn: 'Starting Price' },
    'Quantity': { catalogField: 'quantity', templateColumn: 'Quantity' },
    'Condition': { catalogField: 'condition', templateColumn: 'Condition' },
    'Brand': { catalogField: 'brand', templateColumn: 'Brand' },
    'Height': { catalogField: 'height_value', templateColumn: 'Height', transform: 'dimension_with_unit' },
    'Width': { catalogField: 'width_value', templateColumn: 'Width', transform: 'dimension_with_unit' },
    'Length': { catalogField: 'length_value', templateColumn: 'Length', transform: 'dimension_with_unit' },
    'Weight': { catalogField: 'weight_value', templateColumn: 'Weight', transform: 'weight_with_unit' },
  };
}

/**
 * Parse CSV header row from uploaded template file content.
 * Returns the column headers array.
 */
export function parseCsvHeaders(csvContent: string): string[] {
  const firstLine = csvContent.split('\n')[0];
  if (!firstLine) return [];

  // Simple CSV parser for header row: handle quoted fields
  const headers: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      headers.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  headers.push(current.trim());

  return headers;
}

/* ═══════════════════════════════════════════════════════════════
   6. Source label helpers
   ═══════════════════════════════════════════════════════════════ */

const SOURCE_LABELS: Record<string, string> = {
  image_detected: 'AI Detected',
  label_detected: 'Label Detected',
  ai_estimated: 'AI Estimated',
  seller_entered: 'Seller Entered',
  seller_confirmed: 'Seller Confirmed',
};

export function getSourceLabel(source: string | null): string {
  if (!source) return 'Not set';
  return SOURCE_LABELS[source] ?? source;
}

export type { ReadinessGate };
