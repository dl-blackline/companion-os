/**
 * catalog-api.ts — Shared API helpers for catalog backend calls.
 *
 * Centralizes auth token fetching, request construction, and response
 * envelope unwrapping so that all catalog pages use a consistent pattern.
 */

import { supabase } from '@/lib/supabase-client';
import type { CatalogItem } from '@/types/catalog';

/* ── Auth ────────────────────────────────────────────────────── */

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/* ── Generic request ─────────────────────────────────────────── */

async function catalogRequest<T = unknown>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const headers = await getAuthHeaders();

  const res = await fetch('/.netlify/functions/catalog-items', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...params }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `API error (${res.status})`);
  }

  const json = await res.json();
  return (json.data ?? json) as T;
}

/* ── Typed helpers ───────────────────────────────────────────── */

/** List the current user's catalog items (with optional filters). */
export async function listCatalogItems(
  filters: { status?: string; category?: string; limit?: number } = {},
): Promise<CatalogItem[]> {
  const data = await catalogRequest<{ items?: CatalogItem[] } | CatalogItem[]>(
    'list_items',
    filters,
  );
  return Array.isArray(data) ? data : (data?.items ?? []);
}

/** Fetch a single catalog item by ID. */
export async function getCatalogItem(itemId: string): Promise<CatalogItem> {
  const data = await catalogRequest<{ item?: CatalogItem } | CatalogItem>(
    'get_item',
    { item_id: itemId },
  );
  const item = (data as { item?: CatalogItem })?.item ?? (data as CatalogItem);
  if (!item?.id) throw new Error('Item not found');
  return item;
}

/** Create a new catalog item. Fields are spread flat into the request body. */
export async function createCatalogItem(
  fields: Partial<CatalogItem>,
): Promise<CatalogItem> {
  const data = await catalogRequest<{ item?: CatalogItem } | CatalogItem>(
    'create_item',
    fields as Record<string, unknown>,
  );
  const item = (data as { item?: CatalogItem })?.item ?? (data as CatalogItem);
  if (!item?.id) throw new Error('Failed to create item');
  return item;
}

/** Update an existing catalog item. Fields are spread flat into the request body. */
export async function updateCatalogItem(
  itemId: string,
  fields: Partial<CatalogItem>,
): Promise<CatalogItem> {
  const data = await catalogRequest<{ item?: CatalogItem } | CatalogItem>(
    'update_item',
    { item_id: itemId, ...(fields as Record<string, unknown>) },
  );
  const item = (data as { item?: CatalogItem })?.item ?? (data as CatalogItem);
  if (!item?.id) throw new Error('Failed to update item');
  return item;
}

/** Soft-delete (archive) a catalog item. */
export async function deleteCatalogItem(itemId: string): Promise<void> {
  await catalogRequest('delete_item', { item_id: itemId });
}
