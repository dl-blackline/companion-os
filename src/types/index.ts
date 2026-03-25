// Re-export domain type modules
export * from './async';
export * from './media';
export * from './knowledge';
export * from './memory';
export * from './emoji-orb';
export * from './companion';

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
  /** URL of a generated media asset attached to this turn */
  mediaUrl?: string;
  /** Type of the attached media asset */
  mediaType?: MediaType;
}

export interface MediaGeneration {
  id: string;
  type: 'photo' | 'video';
  prompt: string;
  style: MediaStyle;
  /** Aspect ratio used for the generation (e.g. '1:1', '16:9'). Photo only. */
  aspectRatio?: string;
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
  | 'session'
  | 'media';

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
  /** Optional link to uploaded media that originated this memory */
  mediaId?: string;
  mediaUrl?: string;
  mediaType?: MediaType;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: 'document' | 'note' | 'link' | 'snippet' | 'media';
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  summary?: string;
  sourceUrl?: string;
  /** For media-type knowledge items */
  mediaId?: string;
  mediaUrl?: string;
  mediaType?: MediaType;
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

// ─── Auth State Types ─────────────────────────────────────────────────────────

/** Discriminated union representing all possible authentication states. */
export type AuthState =
  | { status: 'initializing' }
  | { status: 'unauthenticated' }
  | { status: 'authenticating' }
  | { status: 'authenticated'; userId: string; email: string }
  | { status: 'refreshing'; userId: string; email: string }
  | { status: 'error'; error: string };

export type AuthStatus = AuthState['status'];

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
}

export interface AuthErrorInfo {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface LogoutResult {
  success: boolean;
  error?: string;
}

export interface SessionRestoreResult {
  status: 'restored' | 'no_session' | 'error';
  userId?: string;
  email?: string;
  error?: string;
}

export interface ProtectedApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export interface PersistedPreferencePayload {
  userId: string;
  prefs: Partial<UserPreferences>;
  timestamp: number;
}

export interface PersistedMemoryPayload {
  userId: string;
  memoryId?: string;
  title: string;
  content: string;
  category: MemoryCategory;
  tags: string[];
  timestamp: number;
}

export interface SaveOperationResult {
  success: boolean;
  error?: string;
  retryable: boolean;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  error?: string;
}

// ─── Settings Account View Model ──────────────────────────────────────────────

/** Computed view-model for the auth section inside the Settings Account tab. */
export type SettingsAccountViewModel =
  | { display: 'loading' }
  | { display: 'signed-out'; configured: boolean }
  | { display: 'signed-in'; email: string; userId: string }
  | { display: 'error'; error: string; configured: boolean };

// ─── RBAC / Entitlement Types ─────────────────────────────────────────────────

export type UserRole = 'admin' | 'user';

export type EntitlementPlan = 'free' | 'pro' | 'enterprise' | 'admin_override';

export type EntitlementStatus = 'active' | 'trial' | 'expired' | 'suspended' | 'none';

export interface UserEntitlement {
  id: string;
  user_id: string;
  plan: EntitlementPlan;
  status: EntitlementStatus;
  overridden_by?: string;
  trial_ends_at?: string;
  expires_at?: string;
  features: string[];
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  granted_by: string;
  granted_at: string;
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  admin_only: boolean;
  kill_switch: boolean;
  category: FeatureFlagCategory;
  created_at: string;
  updated_at: string;
}

export type FeatureFlagCategory =
  | 'ai'
  | 'media'
  | 'voice'
  | 'memory'
  | 'billing'
  | 'beta'
  | 'ops'
  | 'security';

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  actor_email?: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketCategory = 'billing' | 'technical' | 'account' | 'abuse' | 'feature_request' | 'other';

export interface SupportTicket {
  id: string;
  user_id: string;
  user_email?: string;
  assignee_id?: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  admin_notes?: string;
  resolution?: string;
  created_at: string;
  updated_at: string;
}

// ─── System Health ────────────────────────────────────────────────────────────

export type ServiceStatus = 'healthy' | 'warning' | 'degraded' | 'down' | 'not_configured' | 'unknown';

export interface ServiceHealth {
  service: string;
  label: string;
  status: ServiceStatus;
  latency_ms?: number;
  message?: string;
  checked_at: string;
}

export interface SystemHealthReport {
  overall: ServiceStatus;
  services: ServiceHealth[];
  checked_at: string;
}

// ─── Admin User ───────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  display_name?: string;
  role: UserRole;
  plan: EntitlementPlan;
  plan_status?: EntitlementStatus;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  status: 'active' | 'suspended' | 'deactivated';
  created_at: string;
  last_sign_in?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  billing_status?: string | null;
  usage?: {
    media_generation: number;
    agent_task: number;
  };
}

// ─── User Preferences ─────────────────────────────────────────────────────────

export interface UserPreferences {
  // Profile
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  avatar_style?: 'avatar' | 'emojicon';
  active_identity_id?: string;
  // AI Behavior
  ai_personality: 'professional' | 'warm' | 'direct' | 'coach' | 'analytical';
  ai_tone: 'formal' | 'conversational' | 'casual';
  response_length: 'concise' | 'balanced' | 'detailed';
  creativity_level: number; // 0-1
  empathy_level: number; // 0-1
  directness_level: number; // 0-1
  memory_enabled: boolean;
  memory_depth: 'session' | 'short_term' | 'long_term';
  // Voice
  preferred_voice: string;
  voice_speed: number; // 0.5-2.0
  voice_mode: 'push-to-talk' | 'continuous';
  // Appearance
  theme: 'dark' | 'light' | 'system';
  accent_color?: string;
  /** Orb appearance preference (emoji orb configuration). Stored as nested JSONB. */
  orb_appearance?: OrbPreferencePayload;
  // Privacy
  data_storage: boolean;
  export_enabled: boolean;
  audit_trail: boolean;
  data_retention_days?: number;
  // Notifications
  notifications_enabled: boolean;
  notification_email: boolean;
  notification_in_app: boolean;
  // Language
  preferred_language: string;
  // Media defaults
  default_image_style: string;
  default_video_quality: string;
  // Chat
  default_mode: string;
  auto_title_conversations: boolean;
  show_citations: boolean;
  // Accessibility
  reduce_motion: boolean;
  high_contrast: boolean;
  font_size: 'sm' | 'md' | 'lg';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  ai_personality: 'warm',
  ai_tone: 'conversational',
  response_length: 'balanced',
  creativity_level: 0.7,
  empathy_level: 0.7,
  directness_level: 0.6,
  memory_enabled: true,
  memory_depth: 'long_term',
  preferred_voice: 'alloy',
  voice_speed: 1.0,
  voice_mode: 'push-to-talk',
  theme: 'dark',
  data_storage: true,
  export_enabled: true,
  audit_trail: true,
  notifications_enabled: true,
  notification_email: false,
  notification_in_app: true,
  preferred_language: 'en',
  default_image_style: 'photorealistic',
  default_video_quality: '720p',
  default_mode: 'neutral',
  auto_title_conversations: true,
  show_citations: true,
  reduce_motion: false,
  high_contrast: false,
  font_size: 'md',
};

// ─── Media Memory System ──────────────────────────────────────────────────────

export type MediaProcessingState = 'pending' | 'processing' | 'done' | 'failed';
export type MemoryCandidateStatus = 'pending' | 'approved' | 'rejected';

export interface MediaEntity {
  name: string;
  type: 'person' | 'place' | 'object' | 'event' | 'brand' | 'other';
  confidence: number;
}

export interface TimestampedMoment {
  timestamp: string;
  description: string;
}

export interface MediaAnalysis {
  id: string;
  media_id: string;
  summary: string | null;
  description: string | null;
  extracted_text: string | null;
  transcript: string | null;
  tags: string[];
  entities: MediaEntity[];
  emotional_cues: string[];
  timestamped_moments: TimestampedMoment[];
  model_used: string | null;
  created_at: string;
}

export interface MemoryCandidate {
  id: string;
  user_id: string;
  media_id: string | null;
  title: string;
  content: string;
  category: MemoryCategory;
  confidence: number;
  privacy_level: PrivacyLevel;
  tags: string[];
  status: MemoryCandidateStatus;
  decided_at: string | null;
  created_at: string;
  /** Joined from uploaded_media */
  uploaded_media?: {
    id: string;
    public_url: string | null;
    filename: string;
    media_type: MediaType;
    user_title: string | null;
  };
}

export interface UploadedMedia {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string | null;
  filename: string;
  media_type: MediaType;
  mime_type: string | null;
  file_size_bytes: number | null;
  user_title: string | null;
  user_note: string | null;
  processing_state: MediaProcessingState;
  created_at: string;
  updated_at: string;
  /** Joined */
  media_analysis?: MediaAnalysis[];
  /** Joined */
  memory_candidates?: MemoryCandidate[];
}

export interface UserMemoryPreferences {
  memory_enabled: boolean;
  auto_save_memory: boolean;
  ask_before_saving: boolean;
  media_learning_enabled: boolean;
  retention_days: number | null;
}

export const DEFAULT_MEMORY_PREFERENCES: UserMemoryPreferences = {
  memory_enabled: true,
  auto_save_memory: false,
  ask_before_saving: true,
  media_learning_enabled: true,
  retention_days: null,
};

// ─── Database Row Types ───────────────────────────────────────────────────────
// Direct 1:1 mappings of database table columns from migration 011_media_memory.sql.
// Use these when working with raw database rows (no joins / no frontend enrichment).

/** Row type for the `uploaded_media` table. */
export interface UploadedMediaRow {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string | null;
  filename: string;
  media_type: 'image' | 'video';
  mime_type: string | null;
  file_size_bytes: number | null;
  user_title: string | null;
  user_note: string | null;
  processing_state: MediaProcessingState;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Row type for the `media_analysis` table. */
export interface MediaAnalysisRow {
  id: string;
  media_id: string;
  user_id: string;
  summary: string | null;
  description: string | null;
  extracted_text: string | null;
  transcript: string | null;
  tags: string[];
  entities: MediaEntity[];
  emotional_cues: string[];
  timestamped_moments: TimestampedMoment[];
  model_used: string | null;
  embedding: number[] | null;
  created_at: string;
}

/** Row type for the `memory_candidates` table. */
export interface MemoryCandidateRow {
  id: string;
  user_id: string;
  media_id: string | null;
  title: string;
  content: string;
  category: string;
  confidence: number;
  privacy_level: string;
  tags: string[];
  status: MemoryCandidateStatus;
  decided_at: string | null;
  created_at: string;
}

/** Row type for the `media_knowledge_entries` table. */
export interface MediaKnowledgeEntryRow {
  id: string;
  user_id: string;
  media_id: string;
  title: string;
  content: string;
  item_type: 'document' | 'note' | 'link' | 'snippet' | 'media';
  category: string;
  tags: string[];
  summary: string | null;
  embedding: number[] | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Row type for the `media_memory_links` table. */
export interface MediaMemoryLinkRow {
  id: string;
  user_id: string;
  media_id: string;
  memory_type: 'episodic' | 'relationship' | 'summary';
  memory_id: string;
  created_at: string;
}

/** Payload for creating a new uploaded_media record. */
export interface CreateUploadedMediaPayload {
  user_id: string;
  storage_path: string;
  public_url?: string;
  filename: string;
  media_type: 'image' | 'video';
  mime_type?: string;
  file_size_bytes?: number;
  user_title?: string;
  user_note?: string;
  processing_state?: MediaProcessingState;
}

/** Payload for updating an uploaded_media processing state. */
export interface UpdateMediaStatePayload {
  processing_state: MediaProcessingState;
  updated_at?: string;
}
