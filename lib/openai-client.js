import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

export async function generateChatCompletion(prompt) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_REALTIME_MODEL,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  });
  return response.choices[0].message.content;
}
