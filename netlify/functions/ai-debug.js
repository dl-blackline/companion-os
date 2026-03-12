import { runAI } from "../../lib/ai-router.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const message = event.queryStringParameters?.message || "hello";
  const model = event.queryStringParameters?.model;

  try {
    const messages = {
      system: "You are a helpful assistant.",
      user: message,
    };

    const reply = await runAI(messages, model);

    return response(200, {
      status: "ok",
      message: message,
      reply: reply,
    });
  } catch (error) {
    console.error("AI debug error:", error);

    return response(500, {
      status: "error",
      error: error.message,
    });
  }
}
