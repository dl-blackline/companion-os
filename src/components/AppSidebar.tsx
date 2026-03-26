import type { Icon } from '@phosphor-icons/react';
import { Books } from '@phosphor-icons/react/Books';
import { Brain } from '@phosphor-icons/react/Brain';
import { ChatCircle } from '@phosphor-icons/react/ChatCircle';
import { Gear } from '@phosphor-icons/react/Gear';
import { House } from '@phosphor-icons/react/House';
import { Images } from '@phosphor-icons/react/Images';
import { Lightbulb } from '@phosphor-icons/react/Lightbulb';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { MoonStars } from '@phosphor-icons/react/MoonStars';
import { Robot } from '@phosphor-icons/react/Robot';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { Sliders } from '@phosphor-icons/react/Sliders';
import { Target } from '@phosphor-icons/react/Target';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CompanionOrb } from '@/components/CompanionOrb';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { triggerHaptic } from '@/utils/haptics';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useOrbAppearance } from '@/context/orb-appearance-context';
import { getUserInitials } from '@/services/user-identity-service';
import { toast } from 'sonner';
import type { CompanionState } from '@/types';
import type { RuntimeHealthState } from '@/hooks/use-runtime-health';

export type NavSection =
  | 'home'
  | 'live-talk'
  | 'chat'
  | 'media'
  | 'memory'
  | 'knowledge'
  | 'goals'
  | 'workflows'
  | 'insights'
  | 'agents'
  | 'control-center'
  | 'settings'
  | 'tarot'
  | 'admin-console';

interface AppSidebarProps {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  aiName: string;
  companionState: CompanionState;
  runtimeState: RuntimeHealthState;
  unavailableServices: string[];
}

const navItems: Array<{ id: NavSection; label: string; icon: Icon; group?: string }> = [
  { id: 'home', label: 'Home', icon: House, group: 'main' },
  { id: 'live-talk', label: 'Live Talk', icon: Microphone, group: 'main' },
  { id: 'chat', label: 'Chat', icon: ChatCircle, group: 'main' },
  { id: 'media', label: 'Create', icon: Images, group: 'main' },
  { id: 'memory', label: 'Memory', icon: Brain, group: 'tools' },
  { id: 'knowledge', label: 'Knowledge', icon: Books, group: 'tools' },
  { id: 'goals', label: 'Goals', icon: Target, group: 'tools' },
  { id: 'workflows', label: 'Workflows', icon: Lightning, group: 'tools' },
  { id: 'insights', label: 'Insights', icon: Lightbulb, group: 'tools' },
  { id: 'agents', label: 'Agents', icon: Robot, group: 'tools' },
  { id: 'control-center', label: 'Control', icon: Sliders, group: 'system' },
  { id: 'settings', label: 'Settings', icon: Gear, group: 'system' },
  { id: 'tarot', label: 'Tarot AI', icon: MoonStars, group: 'system' },
  { id: 'admin-console', label: 'Admin', icon: ShieldCheck, group: 'admin' },
];

export function AppSidebar({ activeSection, onSectionChange, aiName, companionState, runtimeState, unavailableServices }: AppSidebarProps) {
  const { isAdmin, user, logout, plan } = useAuth();
  const { prefs } = useSettings();
  const { mode: orbMode, orbColor } = useOrbAppearance();
  const userInitials = getUserInitials(prefs.display_name, user?.email);
  const mainItems = navItems.filter((i) => i.group === 'main');
  const toolItems = navItems.filter((i) => i.group === 'tools');
  const sysItems = navItems.filter((i) => i.group === 'system');
  const adminItems = navItems.filter((i) => i.group === 'admin');

  const stateLabel = companionState.replace('-', ' ');
  const stateDotClass = companionState === 'idle'
    ? 'bg-zinc-400'
    : companionState === 'listening'
      ? 'bg-sky-300'
      : companionState === 'speaking'
        ? 'bg-rose-300'
        : companionState === 'thinking'
          ? 'bg-amber-200'
          : 'bg-zinc-200';

  const runtimeHealthy = runtimeState === 'healthy';
  const runtimeLabel = runtimeState === 'checking'
    ? 'Checking'
    : runtimeState === 'down'
      ? 'Down'
      : runtimeHealthy
        ? 'Operational'
        : 'Partial';
  const runtimeDotClass = runtimeState === 'checking'
    ? 'text-zinc-500'
    : runtimeHealthy
      ? 'text-zinc-100'
      : 'text-zinc-400';

  const renderItem = (item: (typeof navItems)[number]) => {
    const IconComp = item.icon;
    const isActive = activeSection === item.id;

    return (
      <button
        key={item.id}
        onClick={() => {
          triggerHaptic('selection');
          onSectionChange(item.id);
        }}
        className={cn(
          'focus-ring-lux interactive-press w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all relative min-h-[44px] border overflow-hidden',
          isActive
            ? 'bg-primary text-primary-foreground border-primary/70 shadow-[0_14px_28px_rgba(180,190,204,0.3)]'
            : 'text-muted-foreground border-border/40 bg-black/10 hover:text-foreground hover:bg-muted/55 hover:border-border/80',
          item.group === 'admin' && !isActive && 'text-zinc-300 hover:text-zinc-100',
        )}
      >
        {isActive && (
          <motion.div
            layoutId="activeNav"
            className="absolute inset-0 bg-primary rounded-xl"
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <DynamicIcon icon={IconComp} isActive={isActive} size={19} className="relative z-10" />
        <span className="relative z-10 tracking-tight">{item.label}</span>
      </button>
    );
  };

  return (
    <aside className="w-72 sidebar-panel backdrop-blur-md flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border/85">
        <div className="flex items-center gap-3">
          <CompanionOrb state={companionState} size="sm" showRipples={false} />
          <div className="flex flex-col min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">Companion OS</p>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none truncate">{aiName}</h1>
            <p className="text-[11px] text-muted-foreground mt-1 leading-none">Strategic AI Operating Layer</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border/75 bg-black/25 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-wide uppercase text-muted-foreground">System</span>
            <span className="status-chip">
              <span className={cn('status-dot', runtimeDotClass)} />
              {runtimeLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>State</span>
            <span className="status-chip status-chip-muted capitalize">
              <span className={cn('status-dot', stateDotClass)} />
              {stateLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Orb</span>
            <span className="status-chip status-chip-muted capitalize">{orbColor} {orbMode === 'emoji' ? 'emoji' : 'default'}</span>
          </div>
          {!runtimeHealthy && unavailableServices.length > 0 && (
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Services: {unavailableServices.join(', ')}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-4 overflow-y-auto">
        <div className="space-y-1.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Core</p>
          {mainItems.map(renderItem)}
        </div>

        <div className="space-y-1.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Intelligence</p>
          {toolItems.map(renderItem)}
        </div>

        {isAdmin && (
          <div className="space-y-1.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300/70">Governance</p>
            {adminItems.map(renderItem)}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-border/80 space-y-1.5 bg-black/10">
        {sysItems.map(renderItem)}

        <div className="px-3 py-2 text-xs text-muted-foreground rounded-xl border border-border/70 bg-black/20">
          <div className="flex items-center justify-between">
            <span>Runtime</span>
            <span className="text-foreground/80">v1.0.0</span>
          </div>
        </div>

        {user && (
          <div className="border border-border/70 bg-black/25 rounded-xl p-2 mt-1">
            <div className="flex items-center gap-2 px-1 py-1">
              <Avatar className="h-8 w-8 shrink-0 border border-border/80">
                {prefs.avatar_url && <AvatarImage src={prefs.avatar_url} alt="User avatar" />}
                <AvatarFallback className="text-[10px] bg-primary/15 text-primary">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="flex-1 min-w-0 text-xs text-foreground/90 truncate">{user.email}</span>
              <button
                onClick={async () => {
                  triggerHaptic('selection');
                  try {
                    await logout();
                  } catch {
                    toast.error('Failed to sign out. Please try again.');
                  }
                }}
                title="Sign out"
                className="focus-ring-lux touch-target shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
              >
                <SignOut size={15} />
              </button>
            </div>
            <div className="mt-1 px-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Plan: {plan.replace('_', ' ')}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
