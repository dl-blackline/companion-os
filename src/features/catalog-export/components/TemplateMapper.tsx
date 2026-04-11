/**
 * TemplateMapper — Map catalog fields to marketplace template columns.
 *
 * For each column header in the template, allows the user to select
 * which catalog field maps to it, with optional transforms for
 * dimension/weight fields. Supports marking columns as required.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  MarketplaceFieldMapping,
  MarketplaceTemplate,
} from '@/types/catalog';

/* ── Available catalog fields for mapping ────────────────────── */

interface CatalogFieldOption {
  value: string;
  label: string;
  transforms?: string[];
}

const CATALOG_FIELDS: CatalogFieldOption[] = [
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'category', label: 'Category' },
  { value: 'subcategory', label: 'Subcategory' },
  { value: 'brand', label: 'Brand' },
  { value: 'model', label: 'Model' },
  { value: 'variant', label: 'Variant' },
  { value: 'condition', label: 'Condition' },
  { value: 'asking_price', label: 'Price' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'sku', label: 'SKU' },
  { value: 'height_value', label: 'Height', transforms: ['none', 'dimension_with_unit'] },
  { value: 'width_value', label: 'Width', transforms: ['none', 'dimension_with_unit'] },
  { value: 'length_value', label: 'Length', transforms: ['none', 'dimension_with_unit'] },
  { value: 'dimension_unit', label: 'Dimension Unit' },
  { value: 'weight_value', label: 'Weight', transforms: ['none', 'weight_with_unit'] },
  { value: 'weight_unit', label: 'Weight Unit' },
  { value: 'estimated_low_value', label: 'Est. Low Value' },
  { value: 'estimated_high_value', label: 'Est. High Value' },
  { value: 'estimated_likely_value', label: 'Est. Likely Value' },
];

/* ── Props ───────────────────────────────────────────────────── */

export interface TemplateMapperProps {
  template: MarketplaceTemplate;
  onSave: (
    mappingConfig: Record<string, MarketplaceFieldMapping>,
    requiredColumns: string[],
  ) => void;
}

/* ── Component ───────────────────────────────────────────────── */

export function TemplateMapper({ template, onSave }: TemplateMapperProps) {
  const [mappings, setMappings] = useState<Record<string, MarketplaceFieldMapping>>(
    template.mapping_config ?? {},
  );
  const [required, setRequired] = useState<Set<string>>(
    new Set(template.required_columns ?? []),
  );

  const setMapping = (column: string, catalogField: string) => {
    if (!catalogField) {
      const next = { ...mappings };
      delete next[column];
      setMappings(next);
      return;
    }
    const fieldDef = CATALOG_FIELDS.find((f) => f.value === catalogField);
    setMappings((prev) => ({
      ...prev,
      [column]: {
        catalogField,
        templateColumn: column,
        transform: fieldDef?.transforms ? fieldDef.transforms[0] : undefined,
      },
    }));
  };

  const setTransform = (column: string, transform: string) => {
    setMappings((prev) => ({
      ...prev,
      [column]: { ...prev[column], transform },
    }));
  };

  const toggleRequired = (column: string) => {
    setRequired((prev) => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  };

  const handleSave = () => {
    onSave(mappings, Array.from(required));
  };

  const mappedCount = Object.keys(mappings).length;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Map Template Columns</h3>
        <Badge variant="secondary" className="text-[10px]">
          {mappedCount}/{template.column_headers.length} mapped
        </Badge>
      </div>

      <p className="text-[10px] text-muted-foreground">
        For each column in the {template.marketplace} template, select which catalog field
        should fill it. Mark columns as required to enforce validation before export.
      </p>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {template.column_headers.map((col) => {
          const mapping = mappings[col];
          const fieldDef = mapping
            ? CATALOG_FIELDS.find((f) => f.value === mapping.catalogField)
            : null;

          return (
            <div
              key={col}
              className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0"
            >
              {/* Column name */}
              <div className="w-36 shrink-0">
                <p className="text-xs font-medium truncate">{col}</p>
              </div>

              {/* Required toggle */}
              <Button
                size="sm"
                variant={required.has(col) ? 'default' : 'outline'}
                className="h-6 px-1.5 text-[10px] shrink-0"
                onClick={() => toggleRequired(col)}
              >
                Req
              </Button>

              {/* Field selector */}
              <select
                value={mapping?.catalogField ?? ''}
                onChange={(e) => setMapping(col, e.target.value)}
                className="flex-1 h-7 text-xs rounded-md border bg-background px-2"
              >
                <option value="">— unmapped —</option>
                {CATALOG_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              {/* Transform selector */}
              {fieldDef?.transforms && fieldDef.transforms.length > 1 && (
                <select
                  value={mapping?.transform ?? 'none'}
                  onChange={(e) => setTransform(col, e.target.value)}
                  className="w-28 h-7 text-[10px] rounded-md border bg-background px-1"
                >
                  {fieldDef.transforms.map((t) => (
                    <option key={t} value={t}>
                      {t === 'none' ? 'Raw value' : t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <Button size="sm" onClick={handleSave}>
        Save Mapping
      </Button>
    </Card>
  );
}
