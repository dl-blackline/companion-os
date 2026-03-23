export interface AICapabilities {
  chat: boolean;
  voice: boolean;
  image: boolean;
  video: boolean;
}

export interface AIControlConfig {
  model: string;
  tone: 'professional' | 'warm' | 'direct' | 'coach' | 'analytical';
  memory_enabled: boolean;
  temperature: number;
  max_tokens: number;
  capabilities: AICapabilities;
}

export const DEFAULT_AI_CONTROL_CONFIG: AIControlConfig = {
  model: 'gpt-4o',
  tone: 'direct',
  memory_enabled: true,
  temperature: 0.7,
  max_tokens: 2000,
  capabilities: {
    chat: true,
    voice: true,
    image: true,
    video: false,
  },
};
