/**
 * Capability Router — decides which provider handles each task type.
 *
 * Maps task types to the appropriate engine:
 *   chat     → AI router
 *   voice    → Voice engine
 *   image    → Media engine (image)
 *   video    → Video engine
 *   music    → Media engine (music)
 *   workflow → Workflow engine
 */

import { runAI } from "./ai-router.js";
import { generateMedia } from "./media-engine.js";
import { generateVideoFromEngine } from "./video-engine.js";
import { processVoiceTurn } from "./voice-engine.js";
import {
  createProject,
  addWorkflowStep,
  runWorkflow,
} from "./workflow-engine.js";

/**
 * Route a task to the appropriate capability provider.
 *
 * @param {object} params
 * @param {string} params.type     - Task type: "chat" | "voice" | "image" | "video" | "music" | "workflow"
 * @param {string} params.prompt   - The user prompt / input text.
 * @param {string} [params.model]  - Optional model id to use.
 * @param {object} [params.options] - Additional provider-specific options.
 * @returns {Promise<object>} Result from the resolved provider.
 */
export async function routeCapability({ type, prompt, model, options = {} }) {
  if (!type) {
    throw new Error("Missing required parameter: type");
  }

  switch (type) {
    case "chat":
      return handleChat(prompt, model);

    case "voice":
      return handleVoice(prompt, model, options);

    case "image":
      return handleImage(prompt, model, options);

    case "video":
      return handleVideo(prompt, model, options);

    case "music":
      return handleMusic(prompt, model, options);

    case "workflow":
      return handleWorkflow(prompt, options);

    default:
      throw new Error(
        `Unsupported task type: "${type}". Supported: chat, voice, image, video, music, workflow`
      );
  }
}

/* ---------------------- Individual capability handlers --------------------- */

async function handleChat(prompt, model) {
  const response = await runAI(prompt, model);
  return { type: "chat", response };
}

async function handleVoice(prompt, model, options) {
  const result = await processVoiceTurn({
    text: typeof prompt === "string" ? prompt : prompt?.user || "",
    systemPrompt: typeof prompt === "object" ? prompt?.system || "" : "",
    model,
    voiceId: options.voiceId,
    useElevenLabs: options.useElevenLabs || false,
    useRealtime: options.useRealtime || false,
  });
  return { type: "voice", ...result };
}

async function handleImage(prompt, model, options) {
  const result = await generateMedia({
    type: "image",
    model,
    prompt,
    options,
  });
  return { type: "image", ...result };
}

async function handleVideo(prompt, model, options) {
  const result = await generateVideoFromEngine(prompt, model, options);
  return { type: "video", ...result };
}

async function handleMusic(prompt, model, options) {
  const result = await generateMedia({
    type: "music",
    model,
    prompt,
    options,
  });
  return { type: "music", ...result };
}

async function handleWorkflow(prompt, options) {
  if (options.action === "create_project") {
    const project = await createProject(options);
    if (options.steps) {
      await Promise.all(
        options.steps.map((step, i) =>
          addWorkflowStep({
            project_id: project.id,
            step_order: i + 1,
            step_type: step.step_type,
            config: step.config || {},
          })
        )
      );
    }
    return { type: "workflow", action: "create_project", project };
  }

  if (options.action === "run") {
    const result = await runWorkflow(options.project_id);
    return { type: "workflow", action: "run", ...result };
  }

  throw new Error(
    "Workflow requires options.action: 'create_project' or 'run'"
  );
}
