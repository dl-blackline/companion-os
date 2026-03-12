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

/**
 * Stream a chat completion, yielding tokens as they arrive.
 *
 * @param {object} prompt - Prompt with `system` and `user` fields.
 * @param {string} [model] - OpenAI model name.
 * @returns {AsyncGenerator<string>} An async generator that yields token strings.
 */
export async function* streamChatCompletion(prompt, model) {
  const messages = [];

  if (prompt.system) {
    messages.push({ role: "system", content: prompt.system });
  }

  messages.push({ role: "user", content: prompt.user });

  const stream = await client.chat.completions.create({
    model: model || MODEL_CONFIG.chat,
    messages,
    temperature: 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

export async function generateEmbedding(text) {

  const response = await client.embeddings.create({
    model: MODEL_CONFIG.embedding,
    input: text
  });

  return response.data[0].embedding;
}
