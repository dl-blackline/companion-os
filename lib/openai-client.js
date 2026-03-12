import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateChatCompletion(prompt) {

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
    model: "gpt-4o",
    messages,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

export async function generateEmbedding(text) {

  const response = await client.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    input: text
  });

  return response.data[0].embedding;
}
