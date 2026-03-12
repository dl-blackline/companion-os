import type { ConversationMode } from '@/types';

/**
 * Prompt generation awareness instructions appended to non-prompt-studio modes.
 * This allows any chat mode to handle prompt generation requests naturally
 * without switching to a dedicated mode.
 */
const PROMPT_GENERATION_AWARENESS = `

Additional capability — Prompt Generation:
If the user asks you to create, generate, write, or refine an image prompt or video prompt, switch into prompt generation mode for that response. Interpret their idea and produce a polished, production-ready generation prompt. Label outputs as [IMAGE PROMPT] or [VIDEO PROMPT]. Include subject, composition, lighting, mood, style, and camera direction as appropriate. For video prompts, also include motion direction and shot dynamics. Return to your normal mode for non-prompt requests.`;

/**
 * Returns prompt generation awareness text for non-prompt-studio modes.
 * For the prompt-studio mode itself, the full system prompt already covers
 * prompt generation, so no additional text is needed.
 */
export function getPromptGenerationAwareness(mode: ConversationMode): string {
  if (mode === 'prompt-studio') {
    return '';
  }
  return PROMPT_GENERATION_AWARENESS;
}
