import { routeMediaRequest } from "../../lib/media-router.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { type, prompt } = JSON.parse(event.body);

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required field: prompt" }),
      };
    }

    const validTypes = ["image", "video", "music", "voice"];

    if (type && !validTypes.includes(type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Invalid type. Supported types: ${validTypes.join(", ")}`,
        }),
      };
    }

    const result = await routeMediaRequest({ type, prompt });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Media generation error:", err.message);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
