/**
 * tarot-email-lead
 *
 * Persists an email lead from the reading save form.
 * Deduplicates on email — repeated submissions for the same address
 * update the record rather than creating a duplicate.
 *
 * POST /.netlify/functions/tarot-email-lead
 * Body: {
 *   email: string,
 *   firstName?: string,
 *   sessionId?: string,
 *   zodiacSign?: string,
 * }
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { email, firstName, sessionId, zodiacSign } = body;

  if (!email || !EMAIL_RE.test(email)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "A valid email address is required" }),
    };
  }

  try {
    const { error } = await supabase.from("tarot_email_leads").upsert(
      {
        email: email.trim().toLowerCase(),
        first_name: firstName?.trim() || null,
        source: "reading-save",
        zodiac_sign: zodiacSign || null,
        session_id: sessionId || null,
        metadata: { app: "tarot-ai", version: 2 },
      },
      { onConflict: "email", ignoreDuplicates: false }
    );

    if (error) {
      console.error("tarot-email-lead: upsert error", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to save email" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("tarot-email-lead: unhandled error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
