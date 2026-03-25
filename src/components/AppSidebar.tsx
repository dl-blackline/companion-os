import type { Icon } from '@phosphor-icons/react';
import {
  House,
  ChatCircle,
  Brain,
  Books,
  Target,
  Lightning,
  Lightbulb,
  Gear,
  Microphone,
  Images,
  Robot,
  ShieldCheck,
  SignOut,
  MoonStars,
  Sliders,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CompanionOrb } from '@/components/CompanionOrb';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { triggerHaptic } from '@/utils/haptics';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { getUserInitials } from '@/services/user-identity-service';
import { toast } from 'sonner';
import type { CompanionState } from '@/types';

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

export function AppSidebar({ activeSection, onSectionChange, aiName, companionState }: AppSidebarProps) {
  const { isAdmin, user, logout } = useAuth();
  const { prefs } = useSettings();
  const userInitials = getUserInitials(prefs.display_name, user?.email);
  const mainItems = navItems.filter((i) => i.group === 'main');
  const toolItems = navItems.filter((i) => i.group === 'tools');
  const sysItems = navItems.filter((i) => i.group === 'system');
  const adminItems = navItems.filter((i) => i.group === 'admin');

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
          'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all relative min-h-[42px] border',
          isActive
            ? 'bg-primary text-primary-foreground border-primary/70 shadow-[0_10px_20px_rgba(18,80,120,0.32)]'
            : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/65 hover:border-border/70',
          item.group === 'admin' && !isActive && 'text-amber-300 hover:text-amber-200',
        )}
      >
        {isActive && (
          <motion.div
            layoutId="activeNav"
            className="absolute inset-0 bg-primary rounded-lg"
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
    <aside className="w-72 border-r border-border/80 bg-[oklch(0.17_0.012_255/0.96)] backdrop-blur-md flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border/85">
        <div className="flex items-center gap-3">
          <CompanionOrb state={companionState} size="sm" showRipples={false} />
          <div className="flex flex-col min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Companion OS</p>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none truncate">{aiName}</h1>
            <p className="text-[11px] text-muted-foreground mt-1 leading-none">Private Executive Assistant</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border/80 bg-black/20 px-3 py-2.5 flex items-center justify-between">
          <span className="text-[11px] tracking-wide uppercase text-muted-foreground">System</span>
          <span className="inline-flex items-center gap-2 text-xs text-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.9)]" />
            Operational
          </span>
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
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/70">Governance</p>
            {adminItems.map(renderItem)}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-border/80 space-y-1.5">
        {sysItems.map(renderItem)}

        <div className="px-3 py-2 text-xs text-muted-foreground rounded-lg border border-border/70 bg-black/20">
          <div className="flex items-center justify-between">
            <span>Runtime</span>
            <span>v1.0.0</span>
          </div>
        </div>

        {user && (
          <div className="border border-border/70 bg-black/20 rounded-lg p-2 mt-1">
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
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
              >
                <SignOut size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
