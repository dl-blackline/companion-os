import { useMemo, useCallback, useState, type ComponentType } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
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
  type PaletteCommand,
  type CommandGroup as CmdGroup,
} from '@/lib/command-registry';

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

type IconComponent = ComponentType<{ size?: number; className?: string }>;

const ICONS: Record<string, IconComponent> = {
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
};

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
    // localStorage full or unavailable — ignore
  }
}

// ── Sub-component: single palette item ───────────────────────────────────
function PaletteItem({
  cmd,
  onSelect,
}: {
  cmd: PaletteCommand;
  onSelect: (cmd: PaletteCommand) => void;
}) {
  const Icon = ICONS[cmd.icon];
  return (
    <CommandItem
      value={`${cmd.label} ${cmd.keywords.join(' ')}`}
      onSelect={() => onSelect(cmd)}
      className="gap-3 px-3 py-2.5 rounded-lg mx-1 cursor-pointer"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 border border-border/40">
        {Icon ? <Icon size={16} className="text-muted-foreground" /> : <span className="text-xs">•</span>}
      </span>
      <span className="flex-1 min-w-0 text-sm font-medium truncate">{cmd.label}</span>
      {cmd.shortcut && <CommandShortcut className="text-[10px]">{cmd.shortcut}</CommandShortcut>}
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

  // Filter by context
  const visibleCommands = useMemo(() => getVisibleCommands(COMMANDS, activeSection), [activeSection]);

  // Group commands
  const groupedCommands = useMemo(() => {
    const groups: Partial<Record<CmdGroup, PaletteCommand[]>> = {};
    for (const cmd of visibleCommands) {
      (groups[cmd.group] ??= []).push(cmd);
    }
    return groups;
  }, [visibleCommands]);

  const orderedGroups = useMemo(() => {
    return (Object.keys(groupedCommands) as CmdGroup[]).sort(
      (a, b) => GROUP_META[a].order - GROUP_META[b].order,
    );
  }, [groupedCommands]);

  // Recent commands (refresh list each time palette opens)
  const recentCommands = useMemo(() => {
    if (query) return [];
    return getRecents()
      .map((id) => COMMANDS.find((c) => c.id === id))
      .filter((c): c is PaletteCommand => !!c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  const handleSelect = useCallback(
    (cmd: PaletteCommand) => {
      pushRecent(cmd.id);
      onOpenChange(false);
      if (cmd.section) {
        onNavigate(cmd.section);
      }
    },
    [onNavigate, onOpenChange],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setQuery('');
      onOpenChange(next);
    },
    [onOpenChange],
  );

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
          <DialogDescription>Search commands and navigate Companion</DialogDescription>
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
          <CommandList className="max-h-[min(400px,50vh)] scroll-py-1 py-1">
            <CommandEmpty>
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No commands found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
              </div>
            </CommandEmpty>

            {/* Recent commands (shown when no search query) */}
            {recentCommands.length > 0 && (
              <CommandGroup heading="Recent">
                {recentCommands.map((cmd) => (
                  <PaletteItem key={cmd.id} cmd={cmd} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}

            {/* Grouped command list */}
            {orderedGroups.map((group) => (
              <CommandGroup key={group} heading={GROUP_META[group].label}>
                {groupedCommands[group]!.map((cmd) => (
                  <PaletteItem key={cmd.id} cmd={cmd} onSelect={handleSelect} />
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
            <span className="ml-auto text-[11px] text-muted-foreground/40">
              ⌘K to toggle
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
