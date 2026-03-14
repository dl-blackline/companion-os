/**
 * tarot-track-event
 *
 * Records a Tarot AI funnel analytics event.
 * Fire-and-forget from the client — always returns 200 so UI is never blocked.
 *
 * POST /.netlify/functions/tarot-track-event
 * Body: {
 *   eventName: string,
 *   sessionId?: string,
 *   offerId?: string,
 *   properties?: Record<string, unknown>
 * }
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    // Always acknowledge, even on bad input
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  const { eventName, sessionId, offerId, properties } = body;

  if (!eventName) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  try {
    await supabase.from("tarot_analytics_events").insert({
      event_name: eventName,
      session_id: sessionId || null,
      offer_id: offerId || null,
      properties: properties || null,
    });
  } catch (err) {
    // Non-fatal — analytics must never block the user flow
    console.error("tarot-track-event: insert error", err);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}
