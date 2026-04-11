/**
 * catalog-export.js — Marketplace template and CSV export backend.
 *
 * Supports:
 *   - create_template: create a new marketplace template from uploaded CSV headers
 *   - update_template: update mapping config and required columns
 *   - list_templates: list user's marketplace templates
 *   - get_template: get a single template
 *   - delete_template: remove a template
 *   - export_csv: generate CSV export for selected items using a template
 *   - record_publication: record a channel publication event
 *   - list_publications: list publications for an item
 */

import { supabase } from '../../lib/_supabase.js';
import { fail, ok, preflight } from '../../lib/_responses.js';

/* ── Allowed values ──────────────────────────────────────────── */

const MARKETPLACES = new Set(['whatnot', 'ebay', 'facebook_marketplace', 'storefront', 'custom']);
const PUBLICATION_TYPES = new Set(['csv_export', 'direct_api', 'manual']);
const PUBLICATION_STATUSES = new Set(['pending', 'exported', 'published', 'failed', 'withdrawn']);

const SUPPORTED_ACTIONS = new Set([
  'create_template', 'update_template', 'list_templates', 'get_template', 'delete_template',
  'export_csv', 'record_publication', 'list_publications',
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

/* ── CSV helpers ─────────────────────────────────────────────── */

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const DIM_LABELS = { in: 'in', cm: 'cm' };
const WT_LABELS = { lb: 'lb', oz: 'oz', kg: 'kg', g: 'g' };

function resolveField(item, mapping) {
  const raw = item[mapping.catalogField];
  if (raw == null) return '';
  if (mapping.transform === 'dimension_with_unit') {
    return `${raw} ${DIM_LABELS[item.dimension_unit] || 'in'}`;
  }
  if (mapping.transform === 'weight_with_unit') {
    return `${raw} ${WT_LABELS[item.weight_unit] || 'lb'}`;
  }
  return String(raw);
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

    /* ── create_template ─────────────────────────────────────── */
    if (action === 'create_template') {
      if (!body.marketplace || !MARKETPLACES.has(body.marketplace)) {
        return fail('Valid marketplace required', 'INVALID_MARKETPLACE', 400);
      }
      if (!body.template_name?.trim()) {
        return fail('template_name required', 'MISSING_FIELD', 400);
      }
      if (!Array.isArray(body.column_headers) || body.column_headers.length === 0) {
        return fail('column_headers array required', 'MISSING_FIELD', 400);
      }

      const { data, error } = await supabase
        .from('marketplace_templates')
        .insert({
          user_id: actor.id,
          marketplace: body.marketplace,
          template_name: body.template_name.trim(),
          original_filename: body.original_filename || null,
          column_headers: body.column_headers,
          mapping_config: body.mapping_config || {},
          required_columns: body.required_columns || [],
          is_default: body.is_default || false,
        })
        .select()
        .single();

      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ template: data });
    }

    /* ── update_template ─────────────────────────────────────── */
    if (action === 'update_template') {
      if (!body.template_id) return fail('template_id required', 'MISSING_FIELD', 400);

      const updates = {};
      if (body.template_name !== undefined) updates.template_name = body.template_name.trim();
      if (body.mapping_config !== undefined) updates.mapping_config = body.mapping_config;
      if (body.required_columns !== undefined) updates.required_columns = body.required_columns;
      if (body.is_default !== undefined) updates.is_default = !!body.is_default;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('marketplace_templates')
        .update(updates)
        .eq('id', body.template_id)
        .eq('user_id', actor.id)
        .select()
        .single();

      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ template: data });
    }

    /* ── list_templates ──────────────────────────────────────── */
    if (action === 'list_templates') {
      let query = supabase
        .from('marketplace_templates')
        .select('*')
        .eq('user_id', actor.id)
        .order('created_at', { ascending: false });

      if (body.marketplace && MARKETPLACES.has(body.marketplace)) {
        query = query.eq('marketplace', body.marketplace);
      }

      const { data, error } = await query;
      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ templates: data || [] });
    }

    /* ── get_template ────────────────────────────────────────── */
    if (action === 'get_template') {
      if (!body.template_id) return fail('template_id required', 'MISSING_FIELD', 400);

      const { data, error } = await supabase
        .from('marketplace_templates')
        .select('*')
        .eq('id', body.template_id)
        .eq('user_id', actor.id)
        .maybeSingle();

      if (error) return fail(error.message, 'DB_ERROR', 500);
      if (!data) return fail('Template not found', 'NOT_FOUND', 404);
      return ok({ template: data });
    }

    /* ── delete_template ─────────────────────────────────────── */
    if (action === 'delete_template') {
      if (!body.template_id) return fail('template_id required', 'MISSING_FIELD', 400);

      const { error } = await supabase
        .from('marketplace_templates')
        .delete()
        .eq('id', body.template_id)
        .eq('user_id', actor.id);

      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ deleted: true });
    }

    /* ── export_csv ──────────────────────────────────────────── */
    if (action === 'export_csv') {
      if (!body.template_id) return fail('template_id required', 'MISSING_FIELD', 400);
      if (!Array.isArray(body.item_ids) || body.item_ids.length === 0) {
        return fail('item_ids array required', 'MISSING_FIELD', 400);
      }

      // Fetch template
      const { data: template, error: tErr } = await supabase
        .from('marketplace_templates')
        .select('*')
        .eq('id', body.template_id)
        .eq('user_id', actor.id)
        .maybeSingle();

      if (tErr) return fail(tErr.message, 'DB_ERROR', 500);
      if (!template) return fail('Template not found', 'NOT_FOUND', 404);

      // Fetch items
      const { data: items, error: iErr } = await supabase
        .from('catalog_items')
        .select('*')
        .in('id', body.item_ids)
        .eq('user_id', actor.id);

      if (iErr) return fail(iErr.message, 'DB_ERROR', 500);
      if (!items || items.length === 0) {
        return fail('No items found', 'NOT_FOUND', 404);
      }

      // Validate required columns
      const mappingConfig = template.mapping_config || {};
      const requiredColumns = template.required_columns || [];
      const validationErrors = [];

      for (const reqCol of requiredColumns) {
        if (!mappingConfig[reqCol]) {
          validationErrors.push(`Required column "${reqCol}" has no mapping`);
        }
      }

      if (validationErrors.length > 0) {
        return fail(validationErrors.join('; '), 'VALIDATION_ERROR', 422);
      }

      // Generate CSV
      const headers = template.column_headers || [];
      const headerRow = headers.map(csvEscape).join(',');
      const dataRows = items.map(item => {
        return headers.map(col => {
          const mapping = mappingConfig[col];
          if (!mapping) return '';
          return csvEscape(resolveField(item, mapping));
        }).join(',');
      });

      const csv = [headerRow, ...dataRows].join('\n');

      return ok({
        csv,
        filename: `${template.marketplace}-export-${Date.now()}.csv`,
        row_count: items.length,
      });
    }

    /* ── record_publication ──────────────────────────────────── */
    if (action === 'record_publication') {
      if (!body.item_id) return fail('item_id required', 'MISSING_FIELD', 400);
      if (!body.channel || !MARKETPLACES.has(body.channel)) {
        return fail('Valid channel required', 'INVALID_CHANNEL', 400);
      }

      const { data, error } = await supabase
        .from('catalog_channel_publications')
        .insert({
          item_id: body.item_id,
          user_id: actor.id,
          channel: body.channel,
          publication_type: PUBLICATION_TYPES.has(body.publication_type) ? body.publication_type : 'csv_export',
          publication_status: PUBLICATION_STATUSES.has(body.publication_status) ? body.publication_status : 'exported',
          external_listing_id: body.external_listing_id || null,
          export_template_id: body.export_template_id || null,
          last_synced_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ publication: data });
    }

    /* ── list_publications ───────────────────────────────────── */
    if (action === 'list_publications') {
      let query = supabase
        .from('catalog_channel_publications')
        .select('*')
        .eq('user_id', actor.id)
        .order('created_at', { ascending: false });

      if (body.item_id) query = query.eq('item_id', body.item_id);
      if (body.channel && MARKETPLACES.has(body.channel)) {
        query = query.eq('channel', body.channel);
      }

      const { data, error } = await query;
      if (error) return fail(error.message, 'DB_ERROR', 500);
      return ok({ publications: data || [] });
    }

    return fail(`Unhandled action: ${action}`, 'INVALID_ACTION', 400);
  } catch (err) {
    return fail(err.message || 'Internal error', 'INTERNAL_ERROR', 500);
  }
}
