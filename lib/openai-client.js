import OpenAI from "openai";
import { MODEL_CONFIG } from "./model-config.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateChatCompletion(prompt, model) {

  const messages = [];

  if (prompt.system) {
    messages.push({
      role: "system",
      content: prompt.system
    });
  }

  messages.push({
    role: "user",
    content: prompt.user
  });

  const response = await client.chat.completions.create({
    model: model || MODEL_CONFIG.chat,
    messages,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

export async function generateEmbedding(text) {

  const response = await client.embeddings.create({
    model: MODEL_CONFIG.embedding,
    input: text
  });

  return response.data[0].embedding;
}
