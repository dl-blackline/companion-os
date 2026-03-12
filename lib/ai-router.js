import * as openaiClient from "./openai-client.js";
import * as geminiClient from "./gemini-client.js";

const ROUTING_TABLE = {
  voice: "openai",
  chat: "openai",
  long_context: "gemini",
  fallback: "gemini",
};

export async function route({ task, prompt }) {
  if (!task || !prompt) {
    throw new Error("Missing required parameters: task, prompt");
  }

  const provider = ROUTING_TABLE[task] || "gemini";

  if (provider === "openai") {
    try {
      return await openaiClient.generateChatCompletion(prompt);
    } catch (err) {
      console.error("OpenAI error, falling back to Gemini:", err.message);
      return await geminiClient.generateChatCompletion(prompt);
    }
  }

  return await geminiClient.generateChatCompletion(prompt);
}
