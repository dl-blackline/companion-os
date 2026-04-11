/**
 * item-decoder.js — AI-powered catalog item decoder.
 *
 * Accepts one or more base64-encoded images and uses OpenAI's vision model
 * to extract structured item metadata: title, category, brand, model,
 * condition, dimensions, weight, value estimates, and follow-up questions.
 *
 * Request body: { images: string[] }  — array of data-URL-encoded images
 * Response: { success: true, data: { decoderOutput: DecoderOutput } }
 */

import { supabase } from "../../lib/_supabase.js";
import { fail, ok, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

/* ── Auth helper ─────────────────────────────────────────────── */

function getAuthToken(event) {
  const authHeader =
    event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace("Bearer ", "") || "";
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

/* ── Decoder system prompt ───────────────────────────────────── */

const DECODER_SYSTEM_PROMPT = `You are a catalog item decoder for a reselling platform.
Given one or more images of an item, extract as much structured metadata as possible.

Return a JSON object with exactly these fields:
{
  "title": string | null,
  "category": string | null,
  "subcategory": string | null,
  "brand": string | null,
  "model": string | null,
  "variant": string | null,
  "condition": "new" | "like_new" | "excellent" | "good" | "fair" | "poor" | "for_parts" | null,
  "description": string | null,
  "height_value": number | null,
  "width_value": number | null,
  "length_value": number | null,
  "dimension_unit": "in" | "cm",
  "dimensions_source": "image_detected" | "ai_estimated" | null,
  "weight_value": number | null,
  "weight_unit": "lb" | "oz" | "kg" | "g",
  "weight_source": "image_detected" | "ai_estimated" | null,
  "estimated_low_value": number | null,
  "estimated_high_value": number | null,
  "estimated_likely_value": number | null,
  "ai_confidence_score": number,
  "ai_summary": string | null,
  "field_confidence": [{ "field": string, "value": any, "confidence": number, "source": string }],
  "questions": string[],
  "attributes": [{ "key": string, "value": string, "source": "ai_decoded" | "ai_estimated" }]
}

Rules:
- Use null for any field you cannot determine from the images.
- condition should be your best assessment based on visible wear, packaging, etc.
- dimensions should only be set if you can detect or estimate from the image (e.g. reference objects, labels).
- dimension_unit defaults to "in" for US market.
- weight_unit defaults to "lb" for US market.
- estimated values should be realistic resale values in USD.
- ai_confidence_score is 0.0-1.0 overall confidence.
- field_confidence should list per-field confidence with source ("image_detected" or "ai_estimated").
- questions should list 1-3 follow-up questions if key information is unclear.
- Keep ai_summary brief (1-2 sentences).
- Return ONLY the JSON object, no markdown fences or extra text.`;

/* ── Handler ─────────────────────────────────────────────────── */

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return preflight();

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const token = getAuthToken(event);
    const actor = await resolveActor(token);
    if (!actor) return fail("Authentication required", "UNAUTHORIZED", 401);

    const body = JSON.parse(event.body || "{}");
    const { images } = body;

    if (!Array.isArray(images) || images.length === 0) {
      return fail(
        "At least one image is required",
        "MISSING_IMAGES",
        400,
      );
    }

    if (images.length > 10) {
      return fail("Maximum 10 images allowed", "TOO_MANY_IMAGES", 400);
    }

    // Validate that images are data URLs
    for (const img of images) {
      if (typeof img !== "string" || !img.startsWith("data:image/")) {
        return fail(
          "Images must be base64-encoded data URLs (data:image/...)",
          "INVALID_IMAGE",
          400,
        );
      }
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return fail(
        "OpenAI API key not configured",
        "CONFIG_ERROR",
        500,
      );
    }

    // Build vision message content
    const content = [
      {
        type: "text",
        text: "Analyze the following item image(s) and extract structured catalog metadata. Return only the JSON object.",
      },
      ...images.map((dataUrl) => ({
        type: "image_url",
        image_url: { url: dataUrl, detail: "high" },
      })),
    ];

    log("item-decoder", `Decoding ${images.length} image(s) for user ${actor.id}`);

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.DECODER_MODEL || "gpt-4o",
          messages: [
            { role: "system", content: DECODER_SYSTEM_PROMPT },
            { role: "user", content },
          ],
          max_tokens: 2000,
          temperature: 0.2,
        }),
      },
    );

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text().catch(() => "unknown error");
      log("item-decoder", `OpenAI error: ${openaiRes.status} — ${errBody}`);
      return fail(
        "AI decode service unavailable",
        "AI_ERROR",
        502,
      );
    }

    const openaiJson = await openaiRes.json();
    const rawContent =
      openaiJson?.choices?.[0]?.message?.content?.trim() || "";

    // Parse the JSON response — strip markdown fences if present
    let decoderOutput;
    try {
      const cleaned = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      decoderOutput = JSON.parse(cleaned);
    } catch {
      log("item-decoder", `Failed to parse decoder response: ${rawContent.slice(0, 200)}`);
      return fail(
        "AI returned an unparseable response. Please try again.",
        "PARSE_ERROR",
        502,
      );
    }

    // Apply defaults for any missing fields
    const result = {
      title: decoderOutput.title ?? null,
      category: decoderOutput.category ?? null,
      subcategory: decoderOutput.subcategory ?? null,
      brand: decoderOutput.brand ?? null,
      model: decoderOutput.model ?? null,
      variant: decoderOutput.variant ?? null,
      condition: decoderOutput.condition ?? null,
      description: decoderOutput.description ?? null,
      height_value: decoderOutput.height_value ?? null,
      width_value: decoderOutput.width_value ?? null,
      length_value: decoderOutput.length_value ?? null,
      dimension_unit: decoderOutput.dimension_unit ?? "in",
      dimensions_source: decoderOutput.dimensions_source ?? null,
      weight_value: decoderOutput.weight_value ?? null,
      weight_unit: decoderOutput.weight_unit ?? "lb",
      weight_source: decoderOutput.weight_source ?? null,
      estimated_low_value: decoderOutput.estimated_low_value ?? null,
      estimated_high_value: decoderOutput.estimated_high_value ?? null,
      estimated_likely_value: decoderOutput.estimated_likely_value ?? null,
      ai_confidence_score: decoderOutput.ai_confidence_score ?? 0.5,
      ai_summary: decoderOutput.ai_summary ?? null,
      field_confidence: Array.isArray(decoderOutput.field_confidence)
        ? decoderOutput.field_confidence
        : [],
      questions: Array.isArray(decoderOutput.questions)
        ? decoderOutput.questions
        : [],
      attributes: Array.isArray(decoderOutput.attributes)
        ? decoderOutput.attributes
        : [],
    };

    return ok({ decoderOutput: result });
  } catch (err) {
    log("item-decoder", `Error: ${err.message}`);
    return fail(
      err.message || "Internal error",
      "INTERNAL_ERROR",
      500,
    );
  }
}
