// ---------------------------------------------------------------------------
// Command Registry — central definition of all palette-accessible commands
//
// v2: Only references the six core sections. Legacy navigation, automotive,
// and non-core commands have been removed from the active registry.
// ---------------------------------------------------------------------------

export type CommandGroup =
  | 'navigation'
  | 'create'
  | 'finance'
  | 'ai'
  | 'system';

export interface PaletteCommand {
  id: string;
  label: string;
  group: CommandGroup;
  /** Key into the icon map rendered by CommandPalette */
  icon: string;
  /** Extra terms the fuzzy search should match on */
  keywords: string[];
  /** Display-only keyboard shortcut hint */
  shortcut?: string;
  /** Navigation target section. Selecting the command navigates here. */
  section?: string;
  /** When set, command only appears if `activeSection` is in this list. */
  context?: string[];
}

export interface EntityResult {
  id: string;
  label: string;
  sublabel?: string;
  type: string;
  icon: string;
  section: string;
}

export interface SmartSuggestion {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  section: string;
  severity: 'info' | 'warning' | 'critical';
}

export const GROUP_META: Record<CommandGroup, { label: string; order: number }> = {
  navigation: { label: 'Navigate', order: 0 },
  create: { label: 'Quick Create', order: 1 },
  finance: { label: 'Finance', order: 2 },
  ai: { label: 'AI & Assistant', order: 3 },
  system: { label: 'System', order: 4 },
};

export const COMMANDS: PaletteCommand[] = [
  // ── Navigation — v2 core sections ──────────────────────────────────────
  { id: 'nav-today', label: 'Go to Today', group: 'navigation', icon: 'calendar', keywords: ['today', 'dashboard', 'main', 'start', 'home', 'daily'], section: 'today' },
  { id: 'nav-finance', label: 'Go to Finance', group: 'navigation', icon: 'money', keywords: ['finance', 'money', 'banking', 'accounts', 'transactions', 'cashflow'], section: 'finance' },
  { id: 'nav-tasks', label: 'Go to Tasks', group: 'navigation', icon: 'check', keywords: ['tasks', 'todo', 'to-do', 'inbox', 'projects', 'execution'], section: 'tasks' },
  { id: 'nav-investments', label: 'Go to Investments', group: 'navigation', icon: 'chart', keywords: ['investments', 'holdings', 'watchlist', 'portfolio', 'stocks', 'research'], section: 'investments' },
  { id: 'nav-assistant', label: 'Go to Assistant', group: 'navigation', icon: 'chat', keywords: ['assistant', 'ai', 'chat', 'ask', 'question', 'prompt', 'copilot'], section: 'assistant' },
  { id: 'nav-settings', label: 'Go to Settings', group: 'navigation', icon: 'gear', keywords: ['settings', 'preferences', 'account', 'profile', 'configuration'], section: 'settings' },
  { id: 'nav-admin', label: 'Go to Admin Console', group: 'navigation', icon: 'shield', keywords: ['admin', 'administration', 'console', 'management'], section: 'admin-console' },

  // ── Quick Create ───────────────────────────────────────────────────────
  { id: 'create-task', label: 'Create Task', group: 'create', icon: 'check', keywords: ['new task', 'create task', 'add task', 'todo', 'to-do'], section: 'tasks' },
  { id: 'create-savings', label: 'Create Savings Goal', group: 'create', icon: 'piggy', keywords: ['savings', 'save money', 'savings goal', 'financial goal'], section: 'finance' },
  { id: 'create-note', label: 'Add Quick Note', group: 'create', icon: 'note', keywords: ['note', 'quick note', 'capture', 'jot', 'memo'], section: 'assistant' },
  { id: 'upload-doc', label: 'Upload Document', group: 'create', icon: 'upload', keywords: ['upload', 'document', 'file', 'attachment', 'scan', 'pdf'], section: 'finance' },

  // ── Finance Actions ────────────────────────────────────────────────────
  { id: 'fin-decoder', label: 'Open Bill Decoder', group: 'finance', icon: 'magnifying', keywords: ['bill', 'decode', 'decoder', 'analyze bill', 'scan bill'], section: 'finance' },
  { id: 'fin-due', label: 'View Due Soon Bills', group: 'finance', icon: 'warning', keywords: ['due', 'bills', 'upcoming', 'due soon', 'obligations', 'overdue'], section: 'finance' },
  { id: 'fin-scorecard', label: 'Open Financial Scorecard', group: 'finance', icon: 'chart', keywords: ['scorecard', 'score', 'financial health', 'rating', 'pulse'], section: 'finance' },
  { id: 'fin-transactions', label: 'Open Transactions', group: 'finance', icon: 'list', keywords: ['transactions', 'spending', 'purchases', 'history', 'unified'], section: 'finance' },
  { id: 'fin-accounts', label: 'View Linked Accounts', group: 'finance', icon: 'bank', keywords: ['accounts', 'bank', 'linked', 'stripe', 'connections'], section: 'finance' },
  { id: 'fin-link', label: 'Link Bank Account', group: 'finance', icon: 'link', keywords: ['link', 'connect', 'bank', 'stripe', 'financial connections'], section: 'finance' },
  { id: 'fin-obligation', label: 'Add Recurring Obligation', group: 'finance', icon: 'repeat', keywords: ['recurring', 'obligation', 'subscription', 'monthly', 'auto-pay'], section: 'finance' },

  // ── AI & Assistant ─────────────────────────────────────────────────────
  { id: 'ai-chat', label: 'Ask Assistant', group: 'ai', icon: 'chat', keywords: ['ai', 'chat', 'ask', 'question', 'prompt', 'summarize'], section: 'assistant' },

  // ── System ─────────────────────────────────────────────────────────────
  { id: 'sys-settings', label: 'Open Settings', group: 'system', icon: 'gear', keywords: ['settings', 'preferences', 'configuration', 'account'], section: 'settings', shortcut: '⌘,' },
  { id: 'sys-admin', label: 'Open Admin Console', group: 'system', icon: 'shield', keywords: ['admin', 'console', 'management', 'governance'], section: 'admin-console' },
];

/**
 * Filter commands based on active section context.
 * Commands without a `context` array are always visible.
 * Commands with a `context` array only appear when activeSection matches.
 */
export function getVisibleCommands(
  commands: PaletteCommand[],
  activeSection: string,
): PaletteCommand[] {
  return commands.filter(
    (cmd) => !cmd.context || cmd.context.length === 0 || cmd.context.includes(activeSection),
  );
}
