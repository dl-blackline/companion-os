import { supabase } from "../../lib/_supabase.js";
import { generateMedia } from "../../lib/media-engine.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { validatePayloadSize } from '../../lib/_security.js';
import { log } from "../../lib/_log.js";

const PGRST_NOT_FOUND = "PGRST116";
const MAX_VARIATIONS = 4;
const MIN_VARIATIONS = 2;

const AVATAR_BASE_PROMPT =
  "Create a polished, modern, premium profile avatar from the provided reference photo. " +
  "Preserve recognizable facial identity, skin tone, age range, hairstyle, and key facial structure. " +
  "Use clean lighting, crisp facial details, natural symmetry, and app-ready framing. " +
  "Avoid uncanny outputs, warped anatomy, extra limbs, and generic-looking faces.";

const EMOJICON_BASE_PROMPT =
  "Create a simplified emojicon-style identity portrait from the provided reference photo. " +
  "Preserve recognizable identity traits while stylizing into a clean, iconic, emoji-inspired visual. " +
  "Use bold readable shapes, expressive but subtle facial cues, and polished app-ready composition. " +
  "Avoid distortion, uncanny features, and loss of likeness.";

const VARIANT_DIRECTIONS = [
  "frontal headshot with neutral expression and soft studio light",
  "slight three-quarter angle with confident expression and clean gradient background",
  "warmer mood with subtle smile, balanced contrast, and crisp edge definition",
  "minimal background with strong silhouette readability and modern profile-photo crop",
];

function clampVariationCount(value) {
  const parsed = Number.isFinite(value) ? Number(value) : 3;
  return Math.max(MIN_VARIATIONS, Math.min(MAX_VARIATIONS, parsed));
}

async function getUserFromToken(token) {
  if (!token || !supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user || null;
}

function buildVariantPrompt({ style, originalImageUrl, variantDirection }) {
  const base = style === "emojicon" ? EMOJICON_BASE_PROMPT : AVATAR_BASE_PROMPT;
  return [
    base,
    "",
    `Reference image URL: ${originalImageUrl}`,
    "Reference guidance: this URL is the source photo; keep this same person recognizable.",
    `Variation direction: ${variantDirection}.`,
    "Output as a square profile image suitable for app avatar use.",
  ].join("\n");
}

async function generateVariants({ style, originalImageUrl, count }) {
  const tasks = Array.from({ length: count }).map(async (_, idx) => {
    const prompt = buildVariantPrompt({
      style,
      originalImageUrl,
      variantDirection: VARIANT_DIRECTIONS[idx % VARIANT_DIRECTIONS.length],
    });

    const result = await generateMedia({
      type: "image",
      prompt,
      options: {
        style: style === "emojicon" ? "artistic" : "portrait",
        size: "1024x1024",
      },
    });

    if (!result?.url) return null;

    return {
      index: idx,
      url: result.url,
      prompt,
      model: result.model || null,
      provider: result.provider || null,
      created_at: new Date().toISOString(),
    };
  });

  const settled = await Promise.allSettled(tasks);
  const variants = [];

  for (const item of settled) {
    if (item.status === "fulfilled" && item.value?.url) {
      variants.push(item.value);
    }
  }

  return variants;
}

async function mergeUserPreferences(userId, patch) {
  const { data: existing, error: existingErr } = await supabase
    .from("user_preferences")
    .select("prefs")
    .eq("user_id", userId)
    .single();

  if (existingErr && existingErr.code !== PGRST_NOT_FOUND) {
    throw new Error("Failed to read user preferences");
  }

  const merged = { ...(existing?.prefs || {}), ...patch };

  const { error: saveErr } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, prefs: merged }, { onConflict: "user_id" });

  if (saveErr) throw new Error("Failed to update user preferences");
}

async function handleGenerate(userId, body) {
  const {
    style,
    original_image_url,
    original_storage_path,
    original_filename,
    variation_count,
  } = body;

  if (!style || !["avatar", "emojicon"].includes(style)) {
    return fail("style must be 'avatar' or 'emojicon'", "ERR_VALIDATION", 400);
  }

  if (!original_image_url || typeof original_image_url !== "string") {
    return fail("original_image_url is required", "ERR_VALIDATION", 400);
  }

  const count = clampVariationCount(variation_count);
  const variants = await generateVariants({
    style,
    originalImageUrl: original_image_url,
    count,
  });

  if (!variants.length) {
    return fail("Image generation failed for all variants", "ERR_MEDIA", 502);
  }

  const { data, error } = await supabase
    .from("user_identity_profiles")
    .insert({
      user_id: userId,
      original_image_url,
      original_storage_path: original_storage_path || null,
      original_filename: original_filename || null,
      style_type: style,
      variants,
      is_active: false,
    })
    .select("id, user_id, original_image_url, original_storage_path, original_filename, style_type, variants, selected_variant_index, selected_variant_url, is_active, created_at, updated_at")
    .single();

  if (error) {
    log.error("[user-identity] failed to insert identity profile", error.message);
    return fail("Failed to persist identity variants", "ERR_DB", 500);
  }

  return ok({ identity: data, generated_count: variants.length });
}

async function handleSelect(userId, body) {
  const { identity_id, variant_index } = body;

  if (!identity_id) {
    return fail("identity_id is required", "ERR_VALIDATION", 400);
  }
  if (!Number.isInteger(variant_index)) {
    return fail("variant_index must be an integer", "ERR_VALIDATION", 400);
  }

  const { data: identity, error: fetchErr } = await supabase
    .from("user_identity_profiles")
    .select("id, user_id, style_type, variants")
    .eq("id", identity_id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !identity) {
    return fail("Identity record not found", "ERR_NOT_FOUND", 404);
  }

  const variants = Array.isArray(identity.variants) ? identity.variants : [];
  const selected = variants[variant_index];
  if (!selected?.url) {
    return fail("Selected variant is invalid", "ERR_VALIDATION", 400);
  }

  const deactivate = await supabase
    .from("user_identity_profiles")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (deactivate.error) {
    return fail("Failed to update active identity", "ERR_DB", 500);
  }

  const { data: updated, error: updateErr } = await supabase
    .from("user_identity_profiles")
    .update({
      selected_variant_index: variant_index,
      selected_variant_url: selected.url,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", identity_id)
    .eq("user_id", userId)
    .select("id, user_id, original_image_url, original_storage_path, original_filename, style_type, variants, selected_variant_index, selected_variant_url, is_active, created_at, updated_at")
    .single();

  if (updateErr || !updated) {
    return fail("Failed to save active identity", "ERR_DB", 500);
  }

  await mergeUserPreferences(userId, {
    avatar_url: selected.url,
    avatar_style: identity.style_type,
    active_identity_id: identity_id,
  });

  return ok({ identity: updated, active_avatar_url: selected.url });
}

async function handleGetActive(userId) {
  const { data, error } = await supabase
    .from("user_identity_profiles")
    .select("id, user_id, original_image_url, original_storage_path, original_filename, style_type, variants, selected_variant_index, selected_variant_url, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return fail("Failed to load identity", "ERR_DB", 500);
  }

  return ok({ identity: data || null });
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") return fail("Method not allowed", "ERR_METHOD", 405);
  if (!supabase) return fail("Server configuration error", "ERR_CONFIG", 500);

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return fail("Unauthorized", "ERR_AUTH", 401);

  const sizeCheck = validatePayloadSize(event.body);
  if (!sizeCheck.valid) return fail(sizeCheck.error, 'ERR_PAYLOAD_SIZE', 413);

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return fail("Invalid JSON body", "ERR_VALIDATION", 400);
  }

  const { action } = body;
  if (!action) return fail("action is required", "ERR_VALIDATION", 400);

  try {
    if (action === "generate") return await handleGenerate(user.id, body);
    if (action === "select") return await handleSelect(user.id, body);
    if (action === "get_active") return await handleGetActive(user.id);
    return fail(`Unsupported action: ${action}`, "ERR_VALIDATION", 400);
  } catch (err) {
    log.error("[user-identity] handler error", err?.message || err);
    return fail(err?.message || "Identity workflow failed", "ERR_INTERNAL", 500);
  }
}
