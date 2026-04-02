// ---------------------------------------------------------------------------
// Command Registry — central definition of all palette-accessible commands
// ---------------------------------------------------------------------------

export type CommandGroup =
  | 'navigation'
  | 'create'
  | 'finance'
  | 'automotive'
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

export const GROUP_META: Record<CommandGroup, { label: string; order: number }> = {
  navigation: { label: 'Navigate', order: 0 },
  create: { label: 'Quick Create', order: 1 },
  finance: { label: 'Finance', order: 2 },
  automotive: { label: 'Automotive Finance', order: 3 },
  ai: { label: 'AI & Companion', order: 4 },
  system: { label: 'System', order: 5 },
};

export const COMMANDS: PaletteCommand[] = [
  // ── Navigation ─────────────────────────────────────────────────────────
  { id: 'nav-home', label: 'Go to Home', group: 'navigation', icon: 'house', keywords: ['home', 'dashboard', 'main', 'start'], section: 'home' },
  { id: 'nav-chat', label: 'Go to Chat', group: 'navigation', icon: 'chat', keywords: ['chat', 'message', 'conversation', 'text', 'strategic'], section: 'chat' },
  { id: 'nav-live-talk', label: 'Go to Live Talk', group: 'navigation', icon: 'microphone', keywords: ['voice', 'talk', 'live', 'speak', 'call'], section: 'live-talk' },
  { id: 'nav-media', label: 'Go to Media Studio', group: 'navigation', icon: 'images', keywords: ['media', 'image', 'video', 'create', 'studio', 'generate'], section: 'media' },
  { id: 'nav-memory', label: 'Go to Memory', group: 'navigation', icon: 'brain', keywords: ['memory', 'memories', 'remember', 'context', 'recall'], section: 'memory' },
  { id: 'nav-knowledge', label: 'Go to Knowledge', group: 'navigation', icon: 'books', keywords: ['knowledge', 'library', 'documents', 'docs', 'reference'], section: 'knowledge' },
  { id: 'nav-goals', label: 'Go to Goals', group: 'navigation', icon: 'target', keywords: ['goals', 'objectives', 'milestones', 'planning', 'life os'], section: 'goals' },
  { id: 'nav-workflows', label: 'Go to Workflows', group: 'navigation', icon: 'lightning', keywords: ['workflows', 'automation', 'ops', 'logic', 'pipeline'], section: 'workflows' },
  { id: 'nav-insights', label: 'Go to Insights', group: 'navigation', icon: 'lightbulb', keywords: ['insights', 'analytics', 'intelligence', 'analysis'], section: 'insights' },
  { id: 'nav-careers', label: 'Go to Careers', group: 'navigation', icon: 'briefcase', keywords: ['careers', 'jobs', 'resume', 'applications', 'job hunt'], section: 'careers' },
  { id: 'nav-finance', label: 'Go to Finance', group: 'navigation', icon: 'money', keywords: ['finance', 'money', 'banking', 'accounts', 'transactions', 'cashflow'], section: 'finance' },
  { id: 'nav-auto-finance', label: 'Go to Auto Finance', group: 'navigation', icon: 'car', keywords: ['automotive', 'auto', 'car', 'dealer', 'deals', 'f&i', 'lender'], section: 'automotive-finance' },
  { id: 'nav-agents', label: 'Go to Agents', group: 'navigation', icon: 'robot', keywords: ['agents', 'ai agents', 'autonomous', 'bots'], section: 'agents' },
  { id: 'nav-tarot', label: 'Go to Tarot AI', group: 'navigation', icon: 'moon', keywords: ['tarot', 'readings', 'astrology', 'zodiac', 'cards'], section: 'tarot' },
  { id: 'nav-control', label: 'Go to Control Center', group: 'navigation', icon: 'sliders', keywords: ['control', 'center', 'capabilities', 'runtime'], section: 'control-center' },
  { id: 'nav-settings', label: 'Go to Settings', group: 'navigation', icon: 'gear', keywords: ['settings', 'preferences', 'account', 'profile', 'configuration'], section: 'settings' },
  { id: 'nav-admin', label: 'Go to Admin Console', group: 'navigation', icon: 'shield', keywords: ['admin', 'administration', 'console', 'management'], section: 'admin-console' },

  // ── Quick Create ───────────────────────────────────────────────────────
  { id: 'create-goal', label: 'Create Goal', group: 'create', icon: 'target', keywords: ['new goal', 'create goal', 'add goal', 'life os', 'objective'], section: 'goals' },
  { id: 'create-savings', label: 'Create Savings Goal', group: 'create', icon: 'piggy', keywords: ['savings', 'save money', 'savings goal', 'financial goal'], section: 'finance' },
  { id: 'create-deal', label: 'Create Deal', group: 'create', icon: 'handshake', keywords: ['new deal', 'create deal', 'add deal', 'auto deal', 'desk'], section: 'automotive-finance' },
  { id: 'create-task', label: 'Create Task', group: 'create', icon: 'check', keywords: ['new task', 'create task', 'add task', 'todo', 'to-do'], section: 'goals' },
  { id: 'create-note', label: 'Add Quick Note', group: 'create', icon: 'note', keywords: ['note', 'quick note', 'capture', 'jot', 'memo'], section: 'chat' },
  { id: 'create-event', label: 'Add Calendar Event', group: 'create', icon: 'calendar', keywords: ['event', 'calendar', 'schedule', 'appointment', 'meeting'], section: 'goals' },
  { id: 'create-workflow', label: 'Create Workflow', group: 'create', icon: 'lightning', keywords: ['new workflow', 'automation', 'create workflow'], section: 'workflows' },
  { id: 'upload-doc', label: 'Upload Document', group: 'create', icon: 'upload', keywords: ['upload', 'document', 'file', 'attachment', 'scan', 'pdf'], section: 'finance' },
  { id: 'add-portal', label: 'Add Provider Portal', group: 'create', icon: 'globe', keywords: ['provider', 'portal', 'lender link', 'add portal', 'bookmark'], section: 'automotive-finance' },

  // ── Finance Actions ────────────────────────────────────────────────────
  { id: 'fin-decoder', label: 'Open Bill Decoder', group: 'finance', icon: 'magnifying', keywords: ['bill', 'decode', 'decoder', 'analyze bill', 'scan bill'], section: 'finance' },
  { id: 'fin-due', label: 'View Due Soon Bills', group: 'finance', icon: 'warning', keywords: ['due', 'bills', 'upcoming', 'due soon', 'obligations', 'overdue'], section: 'finance' },
  { id: 'fin-scorecard', label: 'Open Financial Scorecard', group: 'finance', icon: 'chart', keywords: ['scorecard', 'score', 'financial health', 'rating', 'pulse'], section: 'finance' },
  { id: 'fin-transactions', label: 'Open Transactions', group: 'finance', icon: 'list', keywords: ['transactions', 'spending', 'purchases', 'history', 'unified'], section: 'finance' },
  { id: 'fin-accounts', label: 'View Linked Accounts', group: 'finance', icon: 'bank', keywords: ['accounts', 'bank', 'linked', 'stripe', 'connections'], section: 'finance' },
  { id: 'fin-link', label: 'Link Bank Account', group: 'finance', icon: 'link', keywords: ['link', 'connect', 'bank', 'stripe', 'financial connections'], section: 'finance' },
  { id: 'fin-obligation', label: 'Add Recurring Obligation', group: 'finance', icon: 'repeat', keywords: ['recurring', 'obligation', 'subscription', 'monthly', 'auto-pay'], section: 'finance' },
  { id: 'fin-vehicle', label: 'Add Vehicle', group: 'finance', icon: 'car', keywords: ['vehicle', 'car', 'auto', 'equity', 'payoff', 'trade'], section: 'finance' },

  // ── Automotive Finance ─────────────────────────────────────────────────
  { id: 'auto-deals', label: 'Open Working Deals', group: 'automotive', icon: 'folder', keywords: ['working deals', 'active deals', 'pipeline', 'deal board'], section: 'automotive-finance' },
  { id: 'auto-lender', label: 'Open Lender Brain', group: 'automotive', icon: 'brain', keywords: ['lender', 'brain', 'intelligence', 'guidelines', 'programs', 'rates'], section: 'automotive-finance' },
  { id: 'auto-callbacks', label: 'Open Callback Workspace', group: 'automotive', icon: 'phone', keywords: ['callback', 'calls', 'follow up', 'workspace', 'outbound'], section: 'automotive-finance' },
  { id: 'auto-fi', label: 'Build F&I Menu', group: 'automotive', icon: 'receipt', keywords: ['f&i', 'menu', 'products', 'protection', 'finance insurance', 'warranty'], section: 'automotive-finance' },
  { id: 'auto-cit', label: 'Open CIT Queue', group: 'automotive', icon: 'list', keywords: ['cit', 'contracts in transit', 'queue', 'funding'], section: 'automotive-finance' },
  { id: 'auto-cancel', label: 'Open Cancellations', group: 'automotive', icon: 'x-circle', keywords: ['cancellations', 'cancel', 'chargebacks', 'refunds', 'flat cancel'], section: 'automotive-finance' },
  { id: 'auto-search', label: 'Search Deals', group: 'automotive', icon: 'magnifying', keywords: ['search deals', 'find deal', 'lookup', 'deal search'], section: 'automotive-finance' },
  { id: 'auto-portals', label: 'Open Provider Portals', group: 'automotive', icon: 'globe', keywords: ['provider', 'portal', 'lender portal', 'routeone', 'dealertrack'], section: 'automotive-finance' },
  { id: 'auto-stip', label: 'Add Stip Note', group: 'automotive', icon: 'note', keywords: ['stip', 'stipulation', 'condition', 'requirement', 'proof'], section: 'automotive-finance' },

  // ── AI & Companion ─────────────────────────────────────────────────────
  { id: 'ai-chat', label: 'Start AI Chat', group: 'ai', icon: 'chat', keywords: ['ai', 'chat', 'ask', 'question', 'prompt', 'strategic'], section: 'chat' },
  { id: 'ai-voice', label: 'Start Voice Session', group: 'ai', icon: 'microphone', keywords: ['voice', 'speak', 'live', 'conversation', 'talk'], section: 'live-talk' },
  { id: 'ai-image', label: 'Generate Image', group: 'ai', icon: 'images', keywords: ['image', 'generate', 'dall-e', 'picture', 'visual', 'render'], section: 'media' },
  { id: 'ai-video', label: 'Generate Video', group: 'ai', icon: 'video', keywords: ['video', 'generate', 'sora', 'animation', 'clip', 'footage'], section: 'media' },

  // ── System ─────────────────────────────────────────────────────────────
  { id: 'sys-settings', label: 'Open Settings', group: 'system', icon: 'gear', keywords: ['settings', 'preferences', 'configuration', 'account'], section: 'settings', shortcut: '⌘,' },
  { id: 'sys-control', label: 'Open Control Center', group: 'system', icon: 'sliders', keywords: ['control', 'capabilities', 'runtime', 'toggles'], section: 'control-center' },
  { id: 'sys-admin', label: 'Open Admin Console', group: 'system', icon: 'shield', keywords: ['admin', 'console', 'management', 'governance'], section: 'admin-console' },

  // ── Context: Goals (only visible when on Goals page) ───────────────────
  { id: 'ctx-goal-milestone', label: 'Add Milestone', group: 'create', icon: 'flag', keywords: ['milestone', 'checkpoint', 'marker'], section: 'goals', context: ['goals'] },
  { id: 'ctx-goal-finance', label: 'Connect Goal to Finance', group: 'create', icon: 'link', keywords: ['connect', 'finance', 'link goal', 'financial'], section: 'goals', context: ['goals'] },
  { id: 'ctx-goal-calendar', label: 'Add Calendar Checkpoint', group: 'create', icon: 'calendar', keywords: ['calendar', 'checkpoint', 'reminder', 'date'], section: 'goals', context: ['goals'] },
  { id: 'ctx-goal-plan', label: 'Generate Next Steps', group: 'ai', icon: 'sparkle', keywords: ['next steps', 'plan', 'generate', 'suggest', 'ai plan'], section: 'goals', context: ['goals'] },

  // ── Context: Auto Finance (only visible when on Auto Finance page) ─────
  { id: 'ctx-auto-note', label: 'Add Deal Note', group: 'automotive', icon: 'note', keywords: ['deal note', 'note', 'comment'], section: 'automotive-finance', context: ['automotive-finance'] },
  { id: 'ctx-auto-compare', label: 'Compare Structures', group: 'automotive', icon: 'sliders', keywords: ['compare', 'structure', 'side by side', 'options'], section: 'automotive-finance', context: ['automotive-finance'] },
  { id: 'ctx-auto-interpret', label: 'Open Callback Interpreter', group: 'automotive', icon: 'phone', keywords: ['callback', 'interpreter', 'analysis'], section: 'automotive-finance', context: ['automotive-finance'] },
  { id: 'ctx-auto-guidelines', label: 'Open Lender Guidelines', group: 'automotive', icon: 'books', keywords: ['lender', 'guidelines', 'requirements', 'program'], section: 'automotive-finance', context: ['automotive-finance'] },
  { id: 'ctx-auto-customer', label: 'Launch Customer View', group: 'automotive', icon: 'user', keywords: ['customer', 'view', 'presentation', 'client'], section: 'automotive-finance', context: ['automotive-finance'] },
  { id: 'ctx-auto-stip', label: 'Add Stip', group: 'automotive', icon: 'plus', keywords: ['stip', 'stipulation', 'add', 'condition'], section: 'automotive-finance', context: ['automotive-finance'] },
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
