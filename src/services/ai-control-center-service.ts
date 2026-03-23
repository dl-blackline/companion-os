import { supabase } from '@/lib/supabase-client';
import { DEFAULT_AI_CONTROL_CONFIG, type AIControlConfig } from '@/types/ai-control';

interface UserSettingsRow {
  user_id: string;
  tone: AIControlConfig['tone'];
  memory_enabled: boolean;
  capabilities: AIControlConfig['capabilities'];
}

interface AISettingsRow {
  user_id: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function mergeConfig(userSettings?: Partial<UserSettingsRow>, aiSettings?: Partial<AISettingsRow>): AIControlConfig {
  return {
    model: aiSettings?.model || DEFAULT_AI_CONTROL_CONFIG.model,
    tone: userSettings?.tone || DEFAULT_AI_CONTROL_CONFIG.tone,
    memory_enabled: userSettings?.memory_enabled ?? DEFAULT_AI_CONTROL_CONFIG.memory_enabled,
    temperature: clamp(aiSettings?.temperature ?? DEFAULT_AI_CONTROL_CONFIG.temperature, 0, 1),
    max_tokens: clamp(aiSettings?.max_tokens ?? DEFAULT_AI_CONTROL_CONFIG.max_tokens, 256, 8000),
    capabilities: {
      ...DEFAULT_AI_CONTROL_CONFIG.capabilities,
      ...(userSettings?.capabilities || {}),
    },
  };
}

export async function loadAIControlConfig(userId: string): Promise<AIControlConfig> {
  const [userRes, aiRes] = await Promise.all([
    supabase
      .from('user_settings')
      .select('user_id, tone, memory_enabled, capabilities')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('ai_settings')
      .select('user_id, model, temperature, max_tokens')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (userRes.error && userRes.error.code !== 'PGRST116') {
    throw new Error(userRes.error.message || 'Failed to load user settings');
  }

  if (aiRes.error && aiRes.error.code !== 'PGRST116') {
    throw new Error(aiRes.error.message || 'Failed to load AI settings');
  }

  return mergeConfig(userRes.data ?? undefined, aiRes.data ?? undefined);
}

export async function saveAIControlConfig(userId: string, config: AIControlConfig): Promise<void> {
  const userPayload: UserSettingsRow = {
    user_id: userId,
    tone: config.tone,
    memory_enabled: config.memory_enabled,
    capabilities: config.capabilities,
  };

  const aiPayload: AISettingsRow = {
    user_id: userId,
    model: config.model,
    temperature: clamp(config.temperature, 0, 1),
    max_tokens: clamp(config.max_tokens, 256, 8000),
  };

  const [userUpsert, aiUpsert] = await Promise.all([
    supabase.from('user_settings').upsert(userPayload, { onConflict: 'user_id' }),
    supabase.from('ai_settings').upsert(aiPayload, { onConflict: 'user_id' }),
  ]);

  if (userUpsert.error) {
    throw new Error(userUpsert.error.message || 'Failed to save user settings');
  }

  if (aiUpsert.error) {
    throw new Error(aiUpsert.error.message || 'Failed to save AI settings');
  }
}
