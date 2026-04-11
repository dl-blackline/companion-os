/**
 * CatalogPage — Main catalog workspace page.
 *
 * Handles internal sub-routing via `view` state:
 *   - library  → CatalogLibrary grid
 *   - new      → Create flow (upload & decode or manual entry)
 *   - detail   → CatalogItemPage
 *   - edit     → EditCatalogItemPage
 *
 * Parses URL pathname for initial view and uses pushState for sub-navigation.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase-client';
import { CatalogLibrary } from '../components/CatalogLibrary';
import { CatalogItemForm } from '../components/CatalogItemForm';
import { ItemDecoderUploader } from '../components/ItemDecoderUploader';
import { DecodedItemReviewForm } from '../components/DecodedItemReviewForm';
import { CatalogItemPage } from './CatalogItemPage';
import { EditCatalogItemPage } from './EditCatalogItemPage';
import type { CatalogItem, DecoderOutput } from '@/types/catalog';

/* ── View types ──────────────────────────────────────────────── */

type CatalogView = 'library' | 'new' | 'detail' | 'edit';
type NewSubView = 'choose' | 'decode' | 'review' | 'manual';

/* ── URL helpers ─────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseInitialView(pathname: string): { view: CatalogView; itemId?: string } {
  const segments = pathname.replace(/^\/catalog\/?/, '').split('/').filter(Boolean);

  if (segments.length === 0) return { view: 'library' };
  if (segments[0] === 'new') return { view: 'new' };
  if (UUID_RE.test(segments[0])) {
    if (segments[1] === 'edit') return { view: 'edit', itemId: segments[0] };
    return { view: 'detail', itemId: segments[0] };
  }
  return { view: 'library' };
}

/* ── API helpers ─────────────────────────────────────────────── */

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function catalogApi(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/.netlify/functions/catalog-items', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...params }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `API error (${res.status})`);
  }

  const json = await res.json();
  return json.data ?? json;
}

/* ── Component ───────────────────────────────────────────────── */

export function CatalogPage() {
  const initial = useMemo(() => parseInitialView(window.location.pathname), []);
  const [view, setView] = useState<CatalogView>(initial.view);
  const [currentItemId, setCurrentItemId] = useState<string | undefined>(initial.itemId);
  const [newSubView, setNewSubView] = useState<NewSubView>('choose');
  const [decoderOutput, setDecoderOutput] = useState<DecoderOutput | null>(null);
  const [decodedImageFiles, setDecodedImageFiles] = useState<File[]>([]);

  // Library state
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Navigation helpers ────────────────────────────────────── */

  const navigate = useCallback((v: CatalogView, itemId?: string) => {
    setView(v);
    setCurrentItemId(itemId);

    let path = '/catalog';
    if (v === 'new') path = '/catalog/new';
    else if (v === 'detail' && itemId) path = `/catalog/${itemId}`;
    else if (v === 'edit' && itemId) path = `/catalog/${itemId}/edit`;

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }, []);

  const goToLibrary = useCallback(() => {
    setNewSubView('choose');
    setDecoderOutput(null);
    setDecodedImageFiles([]);
    navigate('library');
  }, [navigate]);

  /* ── Fetch items ───────────────────────────────────────────── */

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await catalogApi('list_items') as CatalogItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* ── CRUD handlers ─────────────────────────────────────────── */

  const handleCreateItem = useCallback(
    async (item: Partial<CatalogItem>) => {
      setSaving(true);
      try {
        const created = await catalogApi('create_item', { item }) as CatalogItem;
        setItems((prev) => [created, ...prev]);
        navigate('detail', created.id);
      } catch {
        // error is silently handled; toast could be added here
      } finally {
        setSaving(false);
      }
    },
    [navigate],
  );

  const handleDecodedSave = useCallback(
    async (item: Partial<CatalogItem>, _questions: { question: string; answer: string }[]) => {
      await handleCreateItem(item);
    },
    [handleCreateItem],
  );

  /* ── Render ────────────────────────────────────────────────── */

  // Detail view
  if (view === 'detail' && currentItemId) {
    return (
      <CatalogItemPage
        itemId={currentItemId}
        onBack={goToLibrary}
        onEdit={() => navigate('edit', currentItemId)}
        onDecode={() => {
          navigate('new');
          setNewSubView('decode');
        }}
      />
    );
  }

  // Edit view
  if (view === 'edit' && currentItemId) {
    return (
      <EditCatalogItemPage
        itemId={currentItemId}
        onBack={() => navigate('detail', currentItemId)}
        onSaved={() => {
          fetchItems();
          navigate('detail', currentItemId);
        }}
      />
    );
  }

  // New item flow
  if (view === 'new') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">New Item</h2>
            <p className="text-xs text-muted-foreground">Add a new item to your catalog.</p>
          </div>
          <Button variant="outline" size="sm" onClick={goToLibrary}>
            ← Back
          </Button>
        </div>

        {newSubView === 'choose' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <button
              onClick={() => setNewSubView('decode')}
              className="rounded-xl border border-border/60 bg-muted/20 p-6 text-left space-y-2 hover:border-border hover:bg-muted/40 transition-colors"
            >
              <p className="text-sm font-semibold">Upload &amp; Decode</p>
              <p className="text-[10px] text-muted-foreground">
                Upload photos and let AI identify your item, suggest pricing, and fill in details.
              </p>
            </button>
            <button
              onClick={() => setNewSubView('manual')}
              className="rounded-xl border border-border/60 bg-muted/20 p-6 text-left space-y-2 hover:border-border hover:bg-muted/40 transition-colors"
            >
              <p className="text-sm font-semibold">Manual Entry</p>
              <p className="text-[10px] text-muted-foreground">
                Manually fill in all item details without AI assistance.
              </p>
            </button>
          </div>
        )}

        {newSubView === 'decode' && !decoderOutput && (
          <ItemDecoderUploader
            onDecodeComplete={(output, imageFiles) => {
              setDecoderOutput(output);
              setDecodedImageFiles(imageFiles);
              setNewSubView('review');
            }}
            onCancel={() => setNewSubView('choose')}
          />
        )}

        {newSubView === 'review' && decoderOutput && (
          <DecodedItemReviewForm
            decoderOutput={decoderOutput}
            imageCount={decodedImageFiles.length}
            onSave={handleDecodedSave}
            onCancel={() => {
              setDecoderOutput(null);
              setDecodedImageFiles([]);
              setNewSubView('decode');
            }}
            saving={saving}
          />
        )}

        {newSubView === 'manual' && (
          <CatalogItemForm
            onSave={handleCreateItem}
            onCancel={() => setNewSubView('choose')}
            saving={saving}
          />
        )}
      </div>
    );
  }

  // Library view (default)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Catalog</h2>
          <p className="text-xs text-muted-foreground">Your item library.</p>
        </div>
        <Button size="sm" onClick={() => navigate('new')}>
          + New Item
        </Button>
      </div>

      <CatalogLibrary
        items={items}
        loading={loading}
        onItemClick={(id) => navigate('detail', id)}
        onCreateNew={() => navigate('new')}
      />
    </div>
  );
}
