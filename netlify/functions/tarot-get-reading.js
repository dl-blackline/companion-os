/**
 * tarot-get-reading
 *
 * Fetches a previously persisted tarot reading session by its ID.
 * Used for session resume on page refresh or revisit.
 *
 * GET /.netlify/functions/tarot-get-reading?sessionId=<id>
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const sessionId = event.queryStringParameters?.sessionId;
  if (!sessionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing sessionId query parameter" }),
    };
  }

  try {
    const { data: session, error: sessionErr } = await supabase
      .from("reading_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Reading session not found" }),
      };
    }

    const { data: cards, error: cardsErr } = await supabase
      .from("reading_card_results")
      .select("*")
      .eq("session_id", sessionId)
      .order("position", { ascending: true });

    if (cardsErr) {
      console.error("tarot-get-reading: cards query error", cardsErr);
    }

    const { data: recommendations, error: recErr } = await supabase
      .from("tarot_product_recommendations")
      .select("*")
      .eq("session_id", sessionId)
      .order("position", { ascending: true });

    if (recErr) {
      console.error("tarot-get-reading: recommendations query error", recErr);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        session,
        cards: cards ?? [],
        recommendations: recommendations ?? [],
      }),
    };
  } catch (err) {
    console.error("tarot-get-reading: unhandled error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
