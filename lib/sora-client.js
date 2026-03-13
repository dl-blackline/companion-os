import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const POLL_INTERVAL_MS = 10000; // 10 seconds between status checks
const MAX_POLL_ATTEMPTS = 60;   // Up to 10 minutes total wait time (60 × 10 s)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload video bytes to Supabase storage and return a public URL.
 * Returns null if Supabase is not configured.
 */
async function uploadVideoToSupabase(videoBuffer, videoId) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const path = `sora/${videoId}.mp4`;

  const { data, error } = await supabase.storage
    .from("media_uploads")
    .upload(path, videoBuffer, {
      contentType: "video/mp4",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.warn("Supabase video upload failed:", error.message);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from("media_uploads")
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

/**
 * Generate a video using the OpenAI Sora video generation API.
 *
 * Flow:
 *   1. Submit a video generation job via client.videos.create()
 *   2. Poll for completion via client.videos.retrieve()
 *   3. Download video content and upload to Supabase storage
 *   4. Return the public video URL
 *
 * @param {string} prompt - Text prompt describing the video to generate.
 * @param {object} [options]
 * @param {string} [options.model]    - Sora model name (default: "sora-2").
 * @param {string} [options.size]     - Video dimensions (default: "1280x720").
 * @param {string} [options.seconds]  - Clip duration: "4", "8", or "12" (default: "4").
 * @returns {Promise<{url: string, taskId: string}>}
 */
export async function generateSoraVideo(prompt, options = {}) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const model = options.model || "sora-2";
  const size = options.size || "1280x720";
  const seconds = options.seconds || "4";

  // Submit the video generation job
  const job = await client.videos.create({
    prompt,
    model,
    size,
    seconds,
  });

  const videoId = job.id;

  if (!videoId) {
    throw new Error("Failed to create Sora video generation job");
  }

  // Poll for completion
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const status = await client.videos.retrieve(videoId);

    if (status.status === "completed") {
      // Download the generated video content
      let videoBuffer;
      try {
        const contentResponse = await client.videos.downloadContent(videoId);
        const arrayBuffer = await contentResponse.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuffer);
      } catch (downloadErr) {
        throw new Error(
          `Sora video generation completed but download failed: ${downloadErr.message}`
        );
      }

      // Upload to Supabase and get a public URL
      const publicUrl = await uploadVideoToSupabase(videoBuffer, videoId);

      if (!publicUrl) {
        throw new Error(
          "Sora video generation completed but could not store the video. " +
            "Ensure Supabase storage is configured with a 'media_uploads' bucket."
        );
      }

      return { url: publicUrl, taskId: videoId };
    }

    if (status.status === "failed") {
      throw new Error(
        `Sora video generation failed: ${status.error?.code || "unknown error"}`
      );
    }
  }

  throw new Error("Sora video generation timed out");
}
