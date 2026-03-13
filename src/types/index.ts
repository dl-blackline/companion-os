export type ConversationMode = 
  | 'strategist' 
  | 'operator' 
  | 'researcher' 
  | 'coach' 
  | 'creative' 
  | 'neutral'
  | 'prompt-studio'
  | 'custom';

export type PromptGenerationType = 'image' | 'video' | 'both';

export type CompanionState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'generating-image'
  | 'generating-video'
  | 'writing'
  | 'analyzing';

export interface TalkSession {
  id: string;
  transcript: TalkTurn[];
  startedAt: number;
  endedAt?: number;
  mode: ConversationMode;
}

export interface TalkTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  audioUrl?: string;
}

export interface MediaGeneration {
  id: string;
  type: 'photo' | 'video';
  prompt: string;
  style: MediaStyle;
  status: 'pending' | 'generating' | 'complete' | 'error';
  resultUrl?: string;
  resultDescription?: string;
  createdAt: number;
  completedAt?: number;
}

export type MediaStyle =
  | 'photorealistic'
  | 'cinematic'
  | 'artistic'
  | 'portrait'
  | 'lifestyle'
  | 'editorial';

export type MessageRole = 'user' | 'assistant' | 'system';

export type MemoryCategory = 
  | 'identity' 
  | 'relationship' 
  | 'project' 
  | 'knowledge' 
  | 'episodic' 
  | 'session';

export type PrivacyLevel = 'public' | 'private' | 'sensitive';

export type ToolCategory = 
  | 'research' 
  | 'creation' 
  | 'planning' 
  | 'communication' 
  | 'analysis' 
  | 'workflow';

export type MediaType = 'image' | 'video';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  citations?: Citation[];
  toolUse?: ToolUse;
  media_url?: string;
  media_type?: MediaType;
}

export interface Citation {
  id: string;
  source: string;
  title: string;
  excerpt: string;
}

export interface ToolUse {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  mode: ConversationMode;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  isArchived: boolean;
  folder?: string;
  tags: string[];
}

export interface ModeConfig {
  id: ConversationMode;
  name: string;
  description: string;
  systemPrompt: string;
  icon: string;
  color: string;
  tone: string;
  behaviorRules: string[];
  preferredOutputs: string[];
}

export interface Memory {
  id: string;
  title: string;
  content: string;
  category: MemoryCategory;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  source: string;
  privacyLevel: PrivacyLevel;
  isPinned: boolean;
  tags: string[];
  relatedMemories: string[];
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: 'document' | 'note' | 'link' | 'snippet';
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  summary?: string;
  sourceUrl?: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'completed' | 'paused' | 'archived';
  progress: number;
  createdAt: number;
  updatedAt: number;
  deadline?: number;
  milestones: Milestone[];
  tasks: Task[];
  parentGoalId?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: number;
  deadline?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  urgency: number;
  impact: number;
  effort: number;
  dueDate?: number;
  goalId?: string;
}

export interface Insight {
  id: string;
  type: 'reminder' | 'follow-up' | 'open-loop' | 'commitment' | 'stalled' | 'opportunity' | 'pattern';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  action?: string;
  relatedGoalId?: string;
  relatedMemoryId?: string;
  createdAt: number;
  dismissedAt?: number;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  style: 'professional' | 'warm' | 'direct' | 'coach-like' | 'analytical' | 'high-agency';
  tone: string;
  communicationStyle: string;
  verbosity: 'concise' | 'balanced' | 'detailed';
  responseFormat: string;
  values: string[];
  planningFramework?: string;
  writingStyle?: string;
  systemPromptAdditions: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  enabled: boolean;
  requiresApproval: boolean;
  config: Record<string, unknown>;
}

export interface CompanionSettings {
  aiName: string;
  defaultMode: ConversationMode;
  aiMood?: string;
  activePersonaId?: string;
  memorySettings: {
    autoCapture: boolean;
    requireApproval: boolean;
    summarization: boolean;
    retentionDays?: number;
  };
  modelSettings: {
    defaultModel: string;
    fallbackModel: string;
    imageModel: string;
    videoModel: string;
    musicModel: string;
    voiceModel: string;
    temperature: number;
    maxLength: number;
    citationPreference: 'always' | 'when-available' | 'never';
    toolUseAggressiveness: number;
    memoryRetrievalIntensity: number;
  };
  privacySettings: {
    dataStorage: boolean;
    exportEnabled: boolean;
    auditTrail: boolean;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  bio: string;
  goals: string[];
  preferences: Record<string, unknown>;
  onboardingCompleted: boolean;
  createdAt: number;
}

export interface DashboardData {
  priorities: Task[];
  activeGoals: Goal[];
  recentConversations: Conversation[];
  memoryHighlights: Memory[];
  insights: Insight[];
  focusRecommendation?: string;
  currentProjects: string[];
}
