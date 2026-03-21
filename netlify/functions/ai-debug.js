import { chat } from "../../lib/ai-client.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  const message = event.queryStringParameters?.message || "hello";
  const model = event.queryStringParameters?.model;

  try {
    const prompt = {
      system: "You are a helpful assistant.",
      user: message,
    };

    const reply = await chat({ prompt, model });

    return ok({
      status: "ok",
      message: message,
      reply: reply,
    });
  } catch (error) {
    console.error("AI debug error:", error);

    return fail(error.message, "ERR_INTERNAL", 500);
  }
}
