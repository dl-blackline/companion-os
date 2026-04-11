/**
 * EditCatalogItemPage — Wraps CatalogItemForm for editing an existing item.
 *
 * Fetches the current item on mount, displays the form pre-filled with data,
 * and saves changes via the update_item action.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CatalogItemForm } from '../components/CatalogItemForm';
import { supabase } from '@/lib/supabase-client';
import type { CatalogItem } from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface EditCatalogItemPageProps {
  itemId: string;
  onBack: () => void;
  onSaved: () => void;
}

/* ── Component ───────────────────────────────────────────────── */

export function EditCatalogItemPage({ itemId, onBack, onSaved }: EditCatalogItemPageProps) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const resolved = data?.item ?? data;
      setItem(resolved as CatalogItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const handleSave = useCallback(
    async (updated: Partial<CatalogItem>) => {
      setSaving(true);
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
          // Backend reads fields flat from body, not nested under "item"
          body: JSON.stringify({ action: 'update_item', item_id: itemId, ...updated }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Failed to save (${res.status})`);
        }

        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSaving(false);
      }
    },
    [itemId, onSaved],
  );

  /* ── Loading ───────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-60 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  /* ── Error ─────────────────────────────────────────────────── */

  if (error && !item) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Edit Item</h2>
          <p className="text-xs text-muted-foreground">
            {item?.title ?? 'Untitled Item'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {item && (
        <CatalogItemForm
          initialData={item}
          onSave={handleSave}
          onCancel={onBack}
          saving={saving}
        />
      )}
    </div>
  );
}
