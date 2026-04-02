import { useMemo, useCallback, useState, useEffect, type ComponentType } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  COMMANDS,
  GROUP_META,
  getVisibleCommands,
  getPinnedIds,
  togglePinned,
  ENTITY_TYPE_META,
  type PaletteCommand,
  type CommandGroup as CmdGroup,
  type EntityResult,
  type SmartSuggestion,
} from '@/lib/command-registry';
import { usePaletteEntities } from '@/hooks/use-palette-entities';

// ── Phosphor icon imports (tree-shaken per-icon) ─────────────────────────
import { House } from '@phosphor-icons/react/House';
import { ChatCircle } from '@phosphor-icons/react/ChatCircle';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { Images } from '@phosphor-icons/react/Images';
import { Brain } from '@phosphor-icons/react/Brain';
import { Books } from '@phosphor-icons/react/Books';
import { Target } from '@phosphor-icons/react/Target';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { Lightbulb } from '@phosphor-icons/react/Lightbulb';
import { Briefcase } from '@phosphor-icons/react/Briefcase';
import { Money } from '@phosphor-icons/react/Money';
import { Car } from '@phosphor-icons/react/Car';
import { Robot } from '@phosphor-icons/react/Robot';
import { MoonStars } from '@phosphor-icons/react/MoonStars';
import { Sliders } from '@phosphor-icons/react/Sliders';
import { Gear } from '@phosphor-icons/react/Gear';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { PiggyBank } from '@phosphor-icons/react/PiggyBank';
import { Handshake } from '@phosphor-icons/react/Handshake';
import { CheckSquare } from '@phosphor-icons/react/CheckSquare';
import { NotePencil } from '@phosphor-icons/react/NotePencil';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { Globe } from '@phosphor-icons/react/Globe';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Warning } from '@phosphor-icons/react/Warning';
import { ChartBar } from '@phosphor-icons/react/ChartBar';
import { ListBullets } from '@phosphor-icons/react/ListBullets';
import { Bank } from '@phosphor-icons/react/Bank';
import { Link as LinkIcon } from '@phosphor-icons/react/Link';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { FolderOpen } from '@phosphor-icons/react/FolderOpen';
import { Phone } from '@phosphor-icons/react/Phone';
import { Receipt } from '@phosphor-icons/react/Receipt';
import { XCircle } from '@phosphor-icons/react/XCircle';
import { VideoCamera } from '@phosphor-icons/react/VideoCamera';
import { Flag } from '@phosphor-icons/react/Flag';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { User } from '@phosphor-icons/react/User';
import { Plus } from '@phosphor-icons/react/Plus';
import { Star } from '@phosphor-icons/react/Star';
import { PushPin } from '@phosphor-icons/react/PushPin';

import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react';

const ICONS: Record<string, PhosphorIcon> = {
  house: House,
  chat: ChatCircle,
  microphone: Microphone,
  images: Images,
  brain: Brain,
  books: Books,
  target: Target,
  lightning: Lightning,
  lightbulb: Lightbulb,
  briefcase: Briefcase,
  money: Money,
  car: Car,
  robot: Robot,
  moon: MoonStars,
  sliders: Sliders,
  gear: Gear,
  shield: ShieldCheck,
  piggy: PiggyBank,
  handshake: Handshake,
  check: CheckSquare,
  note: NotePencil,
  calendar: CalendarBlank,
  upload: UploadSimple,
  globe: Globe,
  magnifying: MagnifyingGlass,
  warning: Warning,
  chart: ChartBar,
  list: ListBullets,
  bank: Bank,
  link: LinkIcon,
  repeat: ArrowsClockwise,
  folder: FolderOpen,
  phone: Phone,
  receipt: Receipt,
  'x-circle': XCircle,
  video: VideoCamera,
  flag: Flag,
  sparkle: Sparkle,
  user: User,
  plus: Plus,
  star: Star,
  pin: PushPin,
};

function IconFor({ name, size = 16, className, weight }: { name: string; size?: number; className?: string; weight?: IconWeight }) {
  const Comp = ICONS[name];
  if (!Comp) return <span className="text-xs">•</span>;
  return <Comp size={size} className={className} weight={weight} />;
}

// ── Recent commands (localStorage) ───────────────────────────────────────
const RECENTS_KEY = 'companion-cmd-recents';
const MAX_RECENTS = 5;

function getRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  const recents = getRecents().filter((r) => r !== id);
  recents.unshift(id);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  } catch {
    // ignore
  }
}

// ── Severity color map ───────────────────────────────────────────────────
const SEVERITY_CLASSES: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/8 text-red-300',
  warning: 'border-amber-500/40 bg-amber-500/8 text-amber-300',
  info: 'border-sky-500/30 bg-sky-500/6 text-sky-300',
};

// ── Sub-components ───────────────────────────────────────────────────────
function PaletteItem({
  cmd,
  isPinned,
  onSelect,
  onTogglePin,
}: {
  cmd: PaletteCommand;
  isPinned: boolean;
  onSelect: (cmd: PaletteCommand) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <CommandItem
      value={`${cmd.label} ${cmd.keywords.join(' ')}`}
      onSelect={() => onSelect(cmd)}
      className="group gap-3 px-3 py-2.5 rounded-lg mx-1 cursor-pointer"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 border border-border/40">
        <IconFor name={cmd.icon} className="text-muted-foreground" />
      </span>
      <span className="flex-1 min-w-0 text-sm font-medium truncate">{cmd.label}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onTogglePin(cmd.id); }}
        className={cn(
          'shrink-0 p-1 rounded transition-opacity',
          isPinned ? 'opacity-70 hover:opacity-100 text-primary' : 'opacity-0 group-hover:opacity-40 hover:opacity-80! text-muted-foreground',
        )}
        aria-label={isPinned ? 'Unpin command' : 'Pin command'}
      >
        <PushPin size={12} weight={isPinned ? 'fill' : 'regular'} />
      </button>
      {cmd.shortcut && <CommandShortcut className="text-[10px]">{cmd.shortcut}</CommandShortcut>}
    </CommandItem>
  );
}

function EntityItem({
  entity,
  onSelect,
}: {
  entity: EntityResult;
  onSelect: (entity: EntityResult) => void;
}) {
  const meta = ENTITY_TYPE_META[entity.type];
  return (
    <CommandItem
      value={`${entity.label} ${entity.sublabel ?? ''} ${meta.label}`}
      onSelect={() => onSelect(entity)}
      className="gap-3 px-3 py-2.5 rounded-lg mx-1 cursor-pointer"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 border border-border/40">
        <IconFor name={entity.icon} className="text-muted-foreground" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entity.label}</p>
        {entity.sublabel && (
          <p className="text-[11px] text-muted-foreground/70 truncate">{entity.sublabel}</p>
        )}
      </div>
      <span className="shrink-0 rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/50">
        {meta.label}
      </span>
    </CommandItem>
  );
}

function SuggestionItem({
  suggestion,
  onSelect,
}: {
  suggestion: SmartSuggestion;
  onSelect: (suggestion: SmartSuggestion) => void;
}) {
  return (
    <CommandItem
      value={`${suggestion.label} ${suggestion.sublabel ?? ''}`}
      onSelect={() => onSelect(suggestion)}
      className={cn(
        'gap-3 px-3 py-2.5 rounded-lg mx-1 cursor-pointer border',
        SEVERITY_CLASSES[suggestion.severity ?? 'info'] ?? SEVERITY_CLASSES.info,
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/20 border border-current/20">
        <IconFor name={suggestion.icon} className="text-current" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{suggestion.label}</p>
        {suggestion.sublabel && (
          <p className="text-[11px] opacity-70 truncate">{suggestion.sublabel}</p>
        )}
      </div>
      <Sparkle size={14} className="shrink-0 opacity-50" />
    </CommandItem>
  );
}

// ── Main component ───────────────────────────────────────────────────────
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSection: string;
  onNavigate: (section: string) => void;
}

export function CommandPalette({ open, onOpenChange, activeSection, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Refresh pinned list when palette opens
  useEffect(() => {
    if (open) setPinnedIds(getPinnedIds());
  }, [open]);

  // Entity search + AI suggestions
  const { entityResults, smartSuggestions } = usePaletteEntities(query, activeSection);

  // Filter commands by context
  const visibleCommands = useMemo(() => getVisibleCommands(COMMANDS, activeSection), [activeSection]);

  // Pinned commands
  const pinnedCommands = useMemo(() => {
    if (query) return [];
    return pinnedIds
      .map((id) => COMMANDS.find((c) => c.id === id))
      .filter((c): c is PaletteCommand => !!c);
  }, [query, pinnedIds]);

  // Group remaining commands (exclude pinned from their groups when no query)
  const groupedCommands = useMemo(() => {
    const groups: Partial<Record<CmdGroup, PaletteCommand[]>> = {};
    const pinnedSet = new Set(pinnedIds);
    for (const cmd of visibleCommands) {
      // When no query, skip pinned items from their normal group (they appear in Pinned group)
      if (!query && pinnedSet.has(cmd.id)) continue;
      (groups[cmd.group] ??= []).push(cmd);
    }
    return groups;
  }, [visibleCommands, pinnedIds, query]);

  const orderedGroups = useMemo(() => {
    return (Object.keys(groupedCommands) as CmdGroup[]).sort(
      (a, b) => GROUP_META[a].order - GROUP_META[b].order,
    );
  }, [groupedCommands]);

  // Recent commands (exclude pinned to avoid duplication)
  const recentCommands = useMemo(() => {
    if (query) return [];
    const pinnedSet = new Set(pinnedIds);
    return getRecents()
      .filter((id) => !pinnedSet.has(id))
      .map((id) => COMMANDS.find((c) => c.id === id))
      .filter((c): c is PaletteCommand => !!c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, pinnedIds]);

  const handleSelect = useCallback(
    (cmd: PaletteCommand) => {
      pushRecent(cmd.id);
      onOpenChange(false);
      if (cmd.section) onNavigate(cmd.section);
    },
    [onNavigate, onOpenChange],
  );

  const handleEntitySelect = useCallback(
    (entity: EntityResult) => {
      onOpenChange(false);
      onNavigate(entity.section);
    },
    [onNavigate, onOpenChange],
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: SmartSuggestion) => {
      onOpenChange(false);
      onNavigate(suggestion.section);
    },
    [onNavigate, onOpenChange],
  );

  const handleTogglePin = useCallback((id: string) => {
    const next = togglePinned(id);
    setPinnedIds(next);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setQuery('');
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  const hasEntityResults = entityResults.length > 0;
  const hasSuggestions = smartSuggestions.length > 0 && !query;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'overflow-hidden p-0 gap-0 rounded-xl',
          'max-w-[640px] top-[20%] translate-y-0',
          'border-border/50 bg-popover/95 backdrop-blur-2xl',
          'shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)]',
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>Search commands, entities, and actions across Companion</DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter
          loop
          className={cn(
            '**:[[cmdk-input-wrapper]]:h-14 **:[[cmdk-input-wrapper]]:px-4',
            '**:[[cmdk-input]]:h-14 **:[[cmdk-input]]:text-base',
            '**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2',
            '**:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:uppercase',
            '**:[[cmdk-group-heading]]:tracking-[0.15em] **:[[cmdk-group-heading]]:font-semibold',
            '**:[[cmdk-group-heading]]:text-muted-foreground/60',
          )}
        >
          <CommandInput
            placeholder="Type a command or search…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(460px,55vh)] scroll-py-1 py-1">
            <CommandEmpty>
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
              </div>
            </CommandEmpty>

            {/* AI Smart Suggestions (shown when no query, if available) */}
            {hasSuggestions && (
              <>
                <CommandGroup heading="Suggested for you">
                  {smartSuggestions.map((s) => (
                    <SuggestionItem key={s.id} suggestion={s} onSelect={handleSuggestionSelect} />
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Pinned commands (shown when no query) */}
            {pinnedCommands.length > 0 && (
              <CommandGroup heading="Pinned">
                {pinnedCommands.map((cmd) => (
                  <PaletteItem key={cmd.id} cmd={cmd} isPinned onSelect={handleSelect} onTogglePin={handleTogglePin} />
                ))}
              </CommandGroup>
            )}

            {/* Recent commands (shown when no query, excluding pinned) */}
            {recentCommands.length > 0 && (
              <CommandGroup heading="Recent">
                {recentCommands.map((cmd) => (
                  <PaletteItem key={cmd.id} cmd={cmd} isPinned={false} onSelect={handleSelect} onTogglePin={handleTogglePin} />
                ))}
              </CommandGroup>
            )}

            {/* Entity search results (shown when query matches entities) */}
            {hasEntityResults && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Results">
                  {entityResults.map((entity) => (
                    <EntityItem key={entity.id} entity={entity} onSelect={handleEntitySelect} />
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Grouped command list */}
            {orderedGroups.map((group) => (
              <CommandGroup key={group} heading={GROUP_META[group].label}>
                {groupedCommands[group]!.map((cmd) => (
                  <PaletteItem key={cmd.id} cmd={cmd} isPinned={isPinned(cmd.id)} onSelect={handleSelect} onTogglePin={handleTogglePin} />
                ))}
              </CommandGroup>
            ))}
          </CommandList>

          {/* Footer keyboard hints */}
          <div className="flex items-center gap-4 border-t border-border/40 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <kbd className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <kbd className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-mono">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <kbd className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-mono">Esc</kbd>
              Close
            </span>
            <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground/40">
              <PushPin size={10} />
              Pin favorites
              <span className="mx-1">·</span>
              ⌘K to toggle
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
