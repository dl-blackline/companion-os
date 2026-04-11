import type { Icon } from '@phosphor-icons/react';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { ChatCircle } from '@phosphor-icons/react/ChatCircle';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { Gear } from '@phosphor-icons/react/Gear';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { Money } from '@phosphor-icons/react/Money';
import { Package } from '@phosphor-icons/react/Package';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CompanionStatusIcon } from '@/components/CompanionStatusIcon';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { triggerHaptic } from '@/utils/haptics';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { getUserInitials } from '@/services/user-identity-service';
import { toast } from 'sonner';
import type { CompanionState } from '@/types';
import type { RuntimeHealthState } from '@/hooks/use-runtime-health';

/* ── v2 NavSection type — core product surfaces only ─────────────────────── */

export type NavSection =
  | 'today'
  | 'finance'
  | 'tasks'
  | 'investments'
  | 'catalog'
  | 'assistant'
  | 'settings'
  | 'stripe-return'
  | 'admin-console';

interface AppSidebarProps {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  aiName: string;
  companionState: CompanionState;
  runtimeState: RuntimeHealthState;
  unavailableServices: string[];
}

/* ── v2 navigation items — six core sections ─────────────────────────────── */

const navItems: Array<{ id: NavSection; label: string; icon: Icon; group?: string }> = [
  { id: 'today', label: 'Today', icon: CalendarBlank, group: 'main' },
  { id: 'finance', label: 'Finance', icon: Money, group: 'main' },
  { id: 'tasks', label: 'Tasks', icon: ListChecks, group: 'main' },
  { id: 'investments', label: 'Investments', icon: ChartLineUp, group: 'main' },
  { id: 'catalog', label: 'Catalog', icon: Package, group: 'main' },
  { id: 'assistant', label: 'Assistant', icon: ChatCircle, group: 'main' },
  { id: 'settings', label: 'Settings', icon: Gear, group: 'system' },
  { id: 'admin-console', label: 'Admin', icon: ShieldCheck, group: 'admin' },
];

export function AppSidebar({ activeSection, onSectionChange, aiName, companionState, runtimeState, unavailableServices }: AppSidebarProps) {
  const { isAdmin, user, logout, plan } = useAuth();
  const { prefs } = useSettings();
  const userInitials = getUserInitials(prefs.display_name, user?.email);
  const mainItems = navItems.filter((i) => i.group === 'main');
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
          'focus-ring-lux interactive-press w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all relative min-h-[44px] border overflow-hidden',
          isActive
            ? 'text-foreground border-(--vuk-active-border) shadow-[0_0_18px_var(--vuk-shadow-glow)]'
            : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-white/4 hover:border-border/40',
          item.group === 'admin' && !isActive && 'text-muted-foreground/70 hover:text-foreground',
        )}
        style={isActive ? { background: 'var(--vuk-active-bg)' } : undefined}
      >
        {isActive && (
          <motion.div
            layoutId="activeNav"
            className="absolute inset-0 rounded-xl"
            style={{ background: 'var(--vuk-active-bg)', borderColor: 'var(--vuk-active-border)' }}
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full z-20" style={{ background: 'var(--vuk-accent)' }} />
        )}
        <DynamicIcon icon={IconComp} isActive={isActive} size={19} className="relative z-10" glowColor={isActive ? 'var(--vuk-accent)' : undefined} />
        <span className="relative z-10 tracking-tight">{item.label}</span>
      </button>
    );
  };

  return (
    <aside className="w-72 sidebar-panel backdrop-blur-md flex flex-col h-full border-r border-border/50">
      <div className="px-5 py-5 border-b border-border/85">
        <div className="flex items-center gap-3">
          <CompanionStatusIcon state={companionState} size="sm" />
          <div className="flex flex-col min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1" style={{ color: 'var(--vuk-accent-dim)' }}>Companion OS</p>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none truncate">{aiName}</h1>
            <p className="text-[11px] text-muted-foreground mt-1 leading-none">Private AI Operating System</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border/75 bg-muted/50 px-3 py-2.5 space-y-2">
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
          {!runtimeHealthy && unavailableServices.length > 0 && (
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Services: {unavailableServices.join(', ')}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-4 overflow-y-auto">
        <div className="space-y-1.5">
          {mainItems.map(renderItem)}
        </div>

        {isAdmin && (
          <div className="space-y-1.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Admin</p>
            {adminItems.map(renderItem)}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-border/80 space-y-1.5 bg-muted/30">
        {sysItems.map(renderItem)}

        <div className="px-3 py-2 text-xs text-muted-foreground rounded-xl border border-border/70 bg-muted/40">
          <div className="flex items-center justify-between">
            <span>Runtime</span>
            <span className="text-foreground/80">v1.0.0</span>
          </div>
        </div>

        {user && (
          <div className="border border-border/70 bg-muted/50 rounded-xl p-2 mt-1">
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
