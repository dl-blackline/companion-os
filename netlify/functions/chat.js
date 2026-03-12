import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../../lib/openai-client.js";
import { route } from "../../lib/ai-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    // 4. Send prompt to AI Router
    const assistantResponse = await route({
      task: "chat",
      prompt: { system: systemPrompt, user: message },
    });

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
