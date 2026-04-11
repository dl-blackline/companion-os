/**
 * CatalogItemPage — Item detail page showing full item data,
 * image gallery placeholder, readiness card, and action buttons.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListingReadinessCard } from '../components/ListingReadinessCard';
import { formatDimensions, formatWeight } from '@/services/catalog-service';
import { supabase } from '@/lib/supabase-client';
import type { CatalogItem } from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface CatalogItemPageProps {
  itemId: string;
  onBack: () => void;
  onEdit: () => void;
  onDecode: () => void;
}

/* ── Label maps ──────────────────────────────────────────────── */

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  for_parts: 'For Parts',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  needs_review: 'Needs Review',
  ready_to_price: 'Ready to Price',
  priced: 'Priced',
  published: 'Published',
  pending_sale: 'Pending Sale',
  sold: 'Sold',
  archived: 'Archived',
};

/* ── Component ───────────────────────────────────────────────── */

export function CatalogItemPage({ itemId, onBack, onEdit, onDecode }: CatalogItemPageProps) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/.netlify/functions/catalog-items', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_item', item_id: itemId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to fetch item (${res.status})`);
      }

      const json = await res.json();
      const data = json.data ?? json;
      setItem(data as CatalogItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  /* ── Loading ───────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="aspect-video rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  /* ── Error ─────────────────────────────────────────────────── */

  if (error || !item) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back to Library
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          {error ?? 'Item not found.'}
        </div>
      </div>
    );
  }

  const dims = formatDimensions(item);
  const wt = formatWeight(item);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back to Library
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDecode}>
            Decode
          </Button>
          <Button size="sm" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>

      {/* ── Image gallery placeholder ────────────────────────── */}
      <div className="aspect-video rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center">
        <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">
          No Images
        </span>
      </div>

      {/* ── Core details ─────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <h2 className="text-base font-bold tracking-tight">
              {item.title ?? 'Untitled Item'}
            </h2>
            {(item.brand || item.model) && (
              <p className="text-xs text-muted-foreground">
                {[item.brand, item.model].filter(Boolean).join(' · ')}
              </p>
            )}
            {item.category && (
              <p className="text-[10px] text-muted-foreground">{item.category}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary" className="text-[10px]">
              {STATUS_LABEL[item.status] ?? item.status}
            </Badge>
            {item.condition && (
              <Badge variant="outline" className="text-[10px]">
                {CONDITION_LABEL[item.condition] ?? item.condition}
              </Badge>
            )}
          </div>
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
        )}
      </Card>

      {/* ── Measurements ─────────────────────────────────────── */}
      {(dims || wt) && (
        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-semibold">Dimensions &amp; Weight</h3>
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            {dims && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                  Dimensions
                </p>
                <p className="text-foreground">{dims}</p>
              </div>
            )}
            {wt && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                  Weight
                </p>
                <p className="text-foreground">{wt}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Pricing ──────────────────────────────────────────── */}
      <Card className="p-4 space-y-2">
        <h3 className="text-sm font-semibold">Pricing</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
              Asking Price
            </p>
            <p className="text-foreground font-semibold">
              {item.asking_price != null ? `$${item.asking_price.toFixed(2)}` : '—'}
            </p>
          </div>
          {item.estimated_likely_value != null && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                AI Estimate
              </p>
              <p className="text-foreground">
                ${item.estimated_low_value ?? '?'} – ${item.estimated_high_value ?? '?'}
                <span className="ml-1 font-semibold">(~${item.estimated_likely_value})</span>
              </p>
            </div>
          )}
        </div>
        {item.ai_summary && (
          <p className="text-[10px] text-muted-foreground mt-1">{item.ai_summary}</p>
        )}
      </Card>

      {/* ── Listing Readiness ────────────────────────────────── */}
      <ListingReadinessCard item={item} />
    </div>
  );
}
