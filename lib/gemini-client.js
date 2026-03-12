import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateChatCompletion(prompt) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

  const content = `${prompt.system}\n\nUser message: ${prompt.user}`;
  const result = await model.generateContent(content);
  const response = result.response;
  return response.text();
}
