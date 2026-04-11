/**
 * ExportValidationPanel — Pre-export validation and CSV generation.
 *
 * Validates selected items against the template's required columns,
 * shows any errors, and generates/downloads the CSV when valid.
 */

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  generateCsvExport,
  validateExportReadiness,
} from '@/services/catalog-service';
import type { CatalogItem, MarketplaceTemplate } from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface ExportValidationPanelProps {
  items: CatalogItem[];
  template: MarketplaceTemplate;
}

/* ── Component ───────────────────────────────────────────────── */

export function ExportValidationPanel({ items, template }: ExportValidationPanelProps) {
  const [downloaded, setDownloaded] = useState(false);

  const validation = useMemo(
    () => validateExportReadiness(items, template),
    [items, template],
  );

  const handleExport = () => {
    const result = generateCsvExport(items, template);

    // Trigger browser download
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);

    setDownloaded(true);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Export Validation</h3>
        <Badge
          variant={validation.valid ? 'default' : 'destructive'}
          className="text-[10px]"
        >
          {validation.valid ? 'Ready to Export' : `${validation.errors.length} Issue(s)`}
        </Badge>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          Template: <strong>{template.template_name}</strong> ({template.marketplace})
        </p>
        <p>
          Items: <strong>{items.length}</strong>
        </p>
        <p>
          Columns: <strong>{template.column_headers.length}</strong> (
          {template.required_columns.length} required)
        </p>
        <p>
          Mapped: <strong>{Object.keys(template.mapping_config).length}</strong>
        </p>
      </div>

      {/* ── Errors ──────────────────────────────────────────────── */}
      {!validation.valid && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-destructive uppercase tracking-wide">
            Validation Errors
          </p>
          <ul className="space-y-0.5">
            {validation.errors.map((err, i) => (
              <li key={i} className="text-[10px] text-destructive flex items-start gap-1">
                <span>✕</span>
                <span>{err}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Export button ───────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleExport}
          disabled={!validation.valid || items.length === 0}
        >
          {downloaded ? '↓ Download Again' : '↓ Export CSV'}
        </Button>
        {downloaded && (
          <span className="text-[10px] text-muted-foreground">
            CSV downloaded with {items.length} item(s)
          </span>
        )}
      </div>
    </Card>
  );
}
