/**
 * catalog-items.js — Catalog CRUD backend function.
 *
 * Supports:
 *   - list_items: list user's catalog items with optional filters
 *   - get_item: get a single catalog item by id
 *   - create_item: create a new catalog item
 *   - update_item: update an existing catalog item (including dimensions/weight)
 *   - delete_item: soft-delete (archive) an item
 *   - evaluate_readiness: compute listing readiness for an item
 */

import { supabase } from '../../lib/_supabase.js';
import { fail, ok, preflight } from '../../lib/_responses.js';

/* ── Allowed values ──────────────────────────────────────────── */

const STATUSES = new Set([
  'draft', 'needs_review', 'ready_to_price', 'priced', 'published',
  'pending_sale', 'sold', 'archived',
]);
const CONDITIONS = new Set([
  'new', 'like_new', 'excellent', 'good', 'fair', 'poor', 'for_parts',
]);
const DIMENSION_UNITS = new Set(['in', 'cm']);
const WEIGHT_UNITS = new Set(['lb', 'oz', 'kg', 'g']);
const MEASUREMENT_SOURCES = new Set([
  'image_detected', 'label_detected', 'ai_estimated', 'seller_entered', 'seller_confirmed',
]);
const READINESS_STATUSES = new Set(['incomplete', 'catalog_ready', 'marketplace_ready', 'channel_ready']);

const SUPPORTED_ACTIONS = new Set([
  'list_items', 'get_item', 'create_item', 'update_item', 'delete_item',
  'evaluate_readiness',
]);

/* ── Auth helper ─────────────────────────────────────────────── */

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

/* ── Value helpers ───────────────────────────────────────────── */

function stringOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numericOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boolOrDefault(value, def) {
  if (typeof value === 'boolean') return value;
  return def;
}

/* ── Readiness computation ───────────────────────────────────── */

function computeReadiness(item) {
  const hasCatalogBasics = item.title && item.category && item.condition;
  if (!hasCatalogBasics) return 'incomplete';

  const hasShipping =
    item.height_value != null &&
    item.width_value != null &&
    item.length_value != null &&
    item.weight_value != null;

  const hasPrice = item.asking_price != null;
  const hasDescription = !!item.description;

  if (hasShipping && hasPrice && hasDescription) return 'channel_ready';
  if (hasPrice && hasDescription) return 'marketplace_ready';
  return 'catalog_ready';
}

/* ── Handler ─────────────────────────────────────────────────── */

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const token = getAuthToken(event);
    const actor = await resolveActor(token);
    if (!actor) return fail('Authentication required', 'UNAUTHORIZED', 401);

    const body = JSON.parse(event.body || '{}');
    const action = body.action;

    if (!action || !SUPPORTED_ACTIONS.has(action)) {
      return fail(`Unsupported action: ${action}`, 'INVALID_ACTION', 400);
    }

    /* ── list_items ──────────────────────────────────────────── */
    if (action === 'list_items') {
      let query = supabase
        .from('catalog_items')
        .select('*')
        .eq('user_id', actor.id)
        .order('updated_at', { ascending: false });

      if (body.status) query = query.eq('status', body.status);
      if (body.category) query = query.eq('category', body.category);
      if (body.listing_readiness_status) {
        query = query.eq('listing_readiness_status', body.listing_readiness_status);
      }
      if (body.limit) query = query.limit(body.limit);

      const { data, error } = await query;
      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ items: data || [] });
    }

    /* ── get_item ────────────────────────────────────────────── */
    if (action === 'get_item') {
      if (!body.item_id) return fail('item_id required', 'MISSING_FIELD', 400);

      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('id', body.item_id)
        .eq('user_id', actor.id)
        .maybeSingle();

      if (error) return fail(error.message, 'DB_ERROR', 500);
      if (!data) return fail('Item not found', 'NOT_FOUND', 404);
      return ok({ item: data });
    }

    /* ── create_item ─────────────────────────────────────────── */
    if (action === 'create_item') {
      const row = buildItemRow(body, actor.id);
      row.listing_readiness_status = computeReadiness(row);

      const { data, error } = await supabase
        .from('catalog_items')
        .insert(row)
        .select()
        .single();

      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ item: data });
    }

    /* ── update_item ─────────────────────────────────────────── */
    if (action === 'update_item') {
      if (!body.item_id) return fail('item_id required', 'MISSING_FIELD', 400);

      // Verify ownership
      const { data: existing } = await supabase
        .from('catalog_items')
        .select('id')
        .eq('id', body.item_id)
        .eq('user_id', actor.id)
        .maybeSingle();
      if (!existing) return fail('Item not found', 'NOT_FOUND', 404);

      const updates = buildItemUpdates(body);
      // Recompute readiness on update
      if (Object.keys(updates).length > 0) {
        // Fetch current state to merge
        const { data: current } = await supabase
          .from('catalog_items')
          .select('*')
          .eq('id', body.item_id)
          .single();
        const merged = { ...current, ...updates };
        updates.listing_readiness_status = computeReadiness(merged);
        updates.updated_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('catalog_items')
        .update(updates)
        .eq('id', body.item_id)
        .eq('user_id', actor.id)
        .select()
        .single();

      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ item: data });
    }

    /* ── delete_item ─────────────────────────────────────────── */
    if (action === 'delete_item') {
      if (!body.item_id) return fail('item_id required', 'MISSING_FIELD', 400);

      const { error } = await supabase
        .from('catalog_items')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', body.item_id)
        .eq('user_id', actor.id);

      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ archived: true });
    }

    /* ── evaluate_readiness ──────────────────────────────────── */
    if (action === 'evaluate_readiness') {
      if (!body.item_id) return fail('item_id required', 'MISSING_FIELD', 400);

      const { data: item, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('id', body.item_id)
        .eq('user_id', actor.id)
        .maybeSingle();

      if (error) return fail(error.message, 'DB_ERROR', 500);
      if (!item) return fail('Item not found', 'NOT_FOUND', 404);

      const readiness = computeReadiness(item);

      // Update if changed
      if (readiness !== item.listing_readiness_status) {
        await supabase
          .from('catalog_items')
          .update({ listing_readiness_status: readiness, updated_at: new Date().toISOString() })
          .eq('id', item.id);
      }

      return ok({ readiness, item: { ...item, listing_readiness_status: readiness } });
    }

    return fail(`Unhandled action: ${action}`, 'INVALID_ACTION', 400);
  } catch (err) {
    return fail(err.message || 'Internal error', 'INTERNAL_ERROR', 500);
  }
}

/* ── Row builders ────────────────────────────────────────────── */

function buildItemRow(body, userId) {
  return {
    user_id: userId,
    title: stringOrNull(body.title),
    slug: stringOrNull(body.slug),
    category: stringOrNull(body.category),
    subcategory: stringOrNull(body.subcategory),
    brand: stringOrNull(body.brand),
    model: stringOrNull(body.model),
    variant: stringOrNull(body.variant),
    condition: CONDITIONS.has(body.condition) ? body.condition : null,
    description: stringOrNull(body.description),
    internal_notes: stringOrNull(body.internal_notes),
    quantity: Math.max(1, parseInt(body.quantity, 10) || 1),
    sku: stringOrNull(body.sku),
    asking_price: numericOrNull(body.asking_price),
    currency: body.currency || 'USD',
    estimated_low_value: numericOrNull(body.estimated_low_value),
    estimated_high_value: numericOrNull(body.estimated_high_value),
    estimated_likely_value: numericOrNull(body.estimated_likely_value),
    ai_confidence_score: numericOrNull(body.ai_confidence_score),
    ai_summary: stringOrNull(body.ai_summary),

    // Dimensions
    height_value: numericOrNull(body.height_value),
    width_value: numericOrNull(body.width_value),
    length_value: numericOrNull(body.length_value),
    dimension_unit: DIMENSION_UNITS.has(body.dimension_unit) ? body.dimension_unit : 'in',
    dimensions_source: MEASUREMENT_SOURCES.has(body.dimensions_source) ? body.dimensions_source : null,
    dimensions_confirmed: boolOrDefault(body.dimensions_confirmed, false),

    // Weight
    weight_value: numericOrNull(body.weight_value),
    weight_unit: WEIGHT_UNITS.has(body.weight_unit) ? body.weight_unit : 'lb',
    weight_source: MEASUREMENT_SOURCES.has(body.weight_source) ? body.weight_source : null,
    weight_confirmed: boolOrDefault(body.weight_confirmed, false),

    status: STATUSES.has(body.status) ? body.status : 'draft',
    publish_status: 'hidden',
    listing_readiness_status: 'incomplete',
  };
}

function buildItemUpdates(body) {
  const updates = {};
  const fields = [
    'title', 'slug', 'category', 'subcategory', 'brand', 'model', 'variant',
    'description', 'internal_notes', 'sku', 'ai_summary',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = stringOrNull(body[f]);
  }
  const numerics = [
    'asking_price', 'estimated_low_value', 'estimated_high_value', 'estimated_likely_value',
    'ai_confidence_score', 'height_value', 'width_value', 'length_value', 'weight_value',
  ];
  for (const f of numerics) {
    if (body[f] !== undefined) updates[f] = numericOrNull(body[f]);
  }
  if (body.condition !== undefined) {
    updates.condition = CONDITIONS.has(body.condition) ? body.condition : null;
  }
  if (body.quantity !== undefined) {
    updates.quantity = Math.max(1, parseInt(body.quantity, 10) || 1);
  }
  if (body.dimension_unit !== undefined && DIMENSION_UNITS.has(body.dimension_unit)) {
    updates.dimension_unit = body.dimension_unit;
  }
  if (body.weight_unit !== undefined && WEIGHT_UNITS.has(body.weight_unit)) {
    updates.weight_unit = body.weight_unit;
  }
  if (body.dimensions_source !== undefined) {
    updates.dimensions_source = MEASUREMENT_SOURCES.has(body.dimensions_source) ? body.dimensions_source : null;
  }
  if (body.weight_source !== undefined) {
    updates.weight_source = MEASUREMENT_SOURCES.has(body.weight_source) ? body.weight_source : null;
  }
  if (body.dimensions_confirmed !== undefined) {
    updates.dimensions_confirmed = boolOrDefault(body.dimensions_confirmed, false);
  }
  if (body.weight_confirmed !== undefined) {
    updates.weight_confirmed = boolOrDefault(body.weight_confirmed, false);
  }
  if (body.status !== undefined && STATUSES.has(body.status)) {
    updates.status = body.status;
  }
  if (body.listing_readiness_status !== undefined && READINESS_STATUSES.has(body.listing_readiness_status)) {
    updates.listing_readiness_status = body.listing_readiness_status;
  }
  return updates;
}
