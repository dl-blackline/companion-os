import { route } from "../ai-router.js";

const OPTIMIZATION_PROMPTS = {
  image: `You are a prompt engineer for AI image generation. 
Enhance the user's prompt to produce the best possible image. 
Add details about style, lighting, composition, color palette, and quality keywords.
Return ONLY the optimized prompt, nothing else.`,

  video: `You are a prompt engineer for AI video generation. 
Enhance the user's prompt to produce the best possible video. 
Add details about camera movement, lighting, cinematic style, pacing, and mood.
Return ONLY the optimized prompt, nothing else.`,

  music: `You are a prompt engineer for AI music generation. 
Enhance the user's prompt to produce the best possible music track. 
Add details about genre, tempo, instruments, mood, and production style.
Return ONLY the optimized prompt, nothing else.`,

  voice: `You are a prompt engineer for text-to-speech generation. 
Refine the user's text for natural, expressive speech delivery.
Add punctuation and phrasing cues for better narration quality.
Return ONLY the optimized text, nothing else.`,
};

export async function optimizePrompt(prompt, mediaType) {
  if (!prompt || !mediaType) {
    throw new Error("Missing required parameters: prompt, mediaType");
  }

  const systemPrompt = OPTIMIZATION_PROMPTS[mediaType];

  if (!systemPrompt) {
    return prompt;
  }

  try {
    const optimized = await route({
      task: "chat",
      prompt: { system: systemPrompt, user: prompt },
    });

    return optimized || prompt;
  } catch (err) {
    console.error("Prompt optimization error, using original:", err.message);
    return prompt;
  }
}
