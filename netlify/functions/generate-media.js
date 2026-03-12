export async function handler(event) {
  try {
    const { type, prompt } = JSON.parse(event.body);

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Prompt required" }),
      };
    }

    // IMAGE GENERATION (Flux via PiAPI)
    if (type === "image") {
      const response = await fetch("https://api.piapi.ai/api/v1/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.PIAPI_API_KEY,
        },
        body: JSON.stringify({
          model: "flux",
          task_type: "image_generation",
          input: {
            prompt,
          },
        }),
      });

      const data = await response.json();

      return {
        statusCode: 200,
        body: JSON.stringify(data),
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Unsupported media type" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Media generation failed",
        details: error.message,
      }),
    };
  }
}
