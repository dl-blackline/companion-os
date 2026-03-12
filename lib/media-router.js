import { generateImage } from "./media/image-generator.js";
import { generateVideo } from "./media/video-generator.js";
import { generateMusic } from "./media/music-generator.js";
import { generateVoice } from "./media/voice-generator.js";
import { optimizePrompt } from "./media/prompt-optimizer.js";

const MEDIA_KEYWORDS = {
  image: [
    "image", "picture", "photo", "illustration", "drawing", "sketch",
    "portrait", "artwork", "graphic", "poster", "thumbnail", "icon",
    "logo", "banner", "wallpaper", "render", "painting",
  ],
  video: [
    "video", "clip", "animation", "movie", "film", "cinematic",
    "footage", "motion", "trailer", "reel",
  ],
  music: [
    "music", "song", "track", "beat", "melody", "soundtrack",
    "audio", "tune", "instrumental", "composition", "jingle",
  ],
  voice: [
    "voice", "narration", "speech", "speak", "narrate", "voiceover",
    "read aloud", "text to speech", "tts", "announce",
  ],
};

const GENERATORS = {
  image: generateImage,
  video: generateVideo,
  music: generateMusic,
  voice: generateVoice,
};

export function detectMediaType(prompt) {
  if (!prompt) return null;

  const lower = prompt.toLowerCase();

  const scores = {};

  for (const [type, keywords] of Object.entries(MEDIA_KEYWORDS)) {
    scores[type] = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        scores[type]++;
      }
    }
  }

  let bestType = null;
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

export async function routeMediaRequest({ type, prompt }) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  const mediaType = type || detectMediaType(prompt);

  if (!mediaType || !GENERATORS[mediaType]) {
    throw new Error(
      `Could not determine media type. Supported types: ${Object.keys(GENERATORS).join(", ")}`
    );
  }

  const optimizedPrompt = await optimizePrompt(prompt, mediaType);

  const generator = GENERATORS[mediaType];
  const result = await generator(optimizedPrompt);

  return {
    type: mediaType,
    prompt: optimizedPrompt,
    ...result,
  };
}
