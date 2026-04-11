/**
 * TemplateUploader — Upload and parse marketplace CSV templates.
 *
 * Supports Whatnot, eBay, and future marketplace CSV templates.
 * Parses the header row from the uploaded file and stores the column structure.
 */

import { useCallback, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseCsvHeaders } from '@/services/catalog-service';
import type { MarketplaceChannel, MarketplaceTemplate } from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface TemplateUploaderProps {
  marketplace: MarketplaceChannel;
  onTemplateCreated: (template: Partial<MarketplaceTemplate>) => void;
}

const MARKETPLACE_LABELS: Record<string, string> = {
  whatnot: 'Whatnot',
  ebay: 'eBay',
  facebook_marketplace: 'Facebook Marketplace',
  storefront: 'Storefront',
  custom: 'Custom',
};

/* ── Component ───────────────────────────────────────────────── */

export function TemplateUploader({ marketplace, onTemplateCreated }: TemplateUploaderProps) {
  const [templateName, setTemplateName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith('.csv')) {
        setError('Please upload a .csv file');
        return;
      }

      setFilename(file.name);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text !== 'string') {
          setError('Could not read file');
          return;
        }
        const parsed = parseCsvHeaders(text);
        if (parsed.length === 0) {
          setError('No headers found in CSV');
          return;
        }
        setHeaders(parsed);
        if (!templateName) {
          setTemplateName(`${MARKETPLACE_LABELS[marketplace] ?? marketplace} Template`);
        }
      };
      reader.onerror = () => setError('Error reading file');
      reader.readAsText(file);
    },
    [marketplace, templateName],
  );

  const handleCreate = () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }
    if (headers.length === 0) {
      setError('Upload a CSV template first');
      return;
    }

    onTemplateCreated({
      marketplace,
      template_name: templateName.trim(),
      original_filename: filename,
      column_headers: headers,
      mapping_config: {},
      required_columns: [],
      is_default: false,
    });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">
          Upload {MARKETPLACE_LABELS[marketplace] ?? marketplace} Template
        </h3>
        <Badge variant="secondary" className="text-[10px]">
          CSV
        </Badge>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Upload a CSV template from {MARKETPLACE_LABELS[marketplace] ?? marketplace}.
        The system will parse the header row and allow you to map catalog fields to template columns.
      </p>

      <div className="space-y-2">
        <label className="text-[10px] font-medium text-muted-foreground">Template Name</label>
        <Input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="My eBay Template"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-medium text-muted-foreground">CSV File</label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="text-xs"
        />
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {headers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground">
            Detected {headers.length} columns:
          </p>
          <div className="flex flex-wrap gap-1">
            {headers.map((h) => (
              <Badge key={h} variant="outline" className="text-[10px]">
                {h}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button
        size="sm"
        onClick={handleCreate}
        disabled={headers.length === 0 || !templateName.trim()}
      >
        Create Template
      </Button>
    </Card>
  );
}
