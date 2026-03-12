import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

async function searchMemory(embedding) {
  const { data, error } = await supabase.rpc("match_messages", {
    query_embedding: embedding,
    match_count: 5,
  });

  if (error) {
    console.error("Memory search error:", error.message);
    return [];
  }

  return data || [];
}

async function saveMessage({ conversation_id, user_id, role, content, embedding }) {
  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const { error } = await supabase.from(table).insert({
    conversation_id,
    user_id,
    role,
    content,
    embedding,
  });

  if (error) {
    console.error("Save message error:", error.message);
  }
}

function buildMemoryContext(memories) {
  if (!memories.length) {
    return "No relevant memories found.";
  }

  return memories
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n");
}

async function callOpenAI(systemPrompt, userMessage) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_REALTIME_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return response.choices[0].message.content;
}

async function callGemini(systemPrompt, userMessage) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

  const prompt = `${systemPrompt}\n\nUser message: ${userMessage}`;
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { conversation_id, user_id, message } = JSON.parse(event.body);

    if (!conversation_id || !user_id || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields: conversation_id, user_id, message" }),
      };
    }

    // 1. Generate embedding for the user message
    const embedding = await generateEmbedding(message);

    // 2. Retrieve relevant past messages using vector search
    const memories = await searchMemory(embedding);

    // 3. Build the prompt with memory context
    const memoryContext = buildMemoryContext(memories);

    const systemPrompt = `You are a Companion AI assistant with persistent conversational memory.

MEMORY
${memoryContext}`;

    // 4. Call OpenAI, fallback to Gemini on failure
    let assistantResponse;

    try {
      assistantResponse = await callOpenAI(systemPrompt, message);
    } catch (openaiError) {
      console.error("OpenAI error, falling back to Gemini:", openaiError.message);
      assistantResponse = await callGemini(systemPrompt, message);
    }

    // 5. Save both the user message and the assistant response
    const assistantEmbedding = await generateEmbedding(assistantResponse);

    await Promise.all([
      saveMessage({
        conversation_id,
        user_id,
        role: "user",
        content: message,
        embedding,
      }),
      saveMessage({
        conversation_id,
        user_id,
        role: "assistant",
        content: assistantResponse,
        embedding: assistantEmbedding,
      }),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({ response: assistantResponse }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
