/**
 * CatalogItemCard — Compact card for displaying a catalog item in the library grid.
 *
 * Shows thumbnail, title, brand, category, condition badge, asking price,
 * and a listing readiness mini badge. Clicking navigates to item detail.
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { evaluateListingReadiness } from '@/services/catalog-service';
import type { CatalogItem } from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface CatalogItemCardProps {
  item: CatalogItem;
  imageCount?: number;
  onClick: () => void;
}

/* ── Condition label ─────────────────────────────────────────── */

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  for_parts: 'For Parts',
};

/* ── Readiness badge styling ─────────────────────────────────── */

const READINESS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  incomplete: 'destructive',
  catalog_ready: 'secondary',
  marketplace_ready: 'default',
  channel_ready: 'default',
};

const READINESS_LABEL: Record<string, string> = {
  incomplete: 'Incomplete',
  catalog_ready: 'Catalog Ready',
  marketplace_ready: 'Mkt Ready',
  channel_ready: 'Ready',
};

/* ── Component ───────────────────────────────────────────────── */

export function CatalogItemCard({ item, imageCount = 0, onClick }: CatalogItemCardProps) {
  const readiness = evaluateListingReadiness(item, imageCount);

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden border border-border/60 transition-all',
        'hover:border-border hover:shadow-md hover:shadow-primary/5',
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
          No Image
        </div>
      </div>

      {/* Details */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-semibold text-foreground leading-tight line-clamp-2 flex-1">
            {item.title ?? 'Untitled Item'}
          </h4>
          <Badge
            variant={READINESS_VARIANT[readiness.overallStatus] ?? 'destructive'}
            className="text-[9px] shrink-0"
          >
            {READINESS_LABEL[readiness.overallStatus] ?? 'Unknown'}
          </Badge>
        </div>

        {(item.brand || item.category) && (
          <p className="text-[10px] text-muted-foreground leading-tight truncate">
            {[item.brand, item.category].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          {item.condition && (
            <Badge variant="outline" className="text-[9px]">
              {CONDITION_LABEL[item.condition] ?? item.condition}
            </Badge>
          )}
          {item.asking_price != null && (
            <span className="text-xs font-semibold text-foreground ml-auto">
              ${item.asking_price.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
