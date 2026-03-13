import type { Icon } from '@phosphor-icons/react';
import { House, ChatCircle, Brain, Books, Target, Lightning, Lightbulb, Gear, Microphone, Images, Robot, ShieldCheck } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CompanionOrb } from '@/components/CompanionOrb';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { triggerHaptic } from '@/utils/haptics';
import { useAuth } from '@/context/auth-context';
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
  | 'settings'
  | 'admin-console';

interface AppSidebarProps {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  aiName: string;
  companionState: CompanionState;
}

const navItems: Array<{ id: NavSection; label: string; icon: Icon; group?: string }> = [
  { id: 'home',          label: 'Home',      icon: House,       group: 'main' },
  { id: 'live-talk',     label: 'Live Talk', icon: Microphone,  group: 'main' },
  { id: 'chat',          label: 'Chat',      icon: ChatCircle,  group: 'main' },
  { id: 'media',         label: 'Create',    icon: Images,      group: 'main' },
  { id: 'memory',        label: 'Memory',    icon: Brain,       group: 'tools' },
  { id: 'knowledge',     label: 'Knowledge', icon: Books,       group: 'tools' },
  { id: 'goals',         label: 'Goals',     icon: Target,      group: 'tools' },
  { id: 'workflows',     label: 'Workflows', icon: Lightning,   group: 'tools' },
  { id: 'insights',      label: 'Insights',  icon: Lightbulb,   group: 'tools' },
  { id: 'agents',        label: 'Agents',    icon: Robot,       group: 'tools' },
  { id: 'settings',      label: 'Settings',  icon: Gear,        group: 'system' },
  { id: 'admin-console', label: 'Admin',     icon: ShieldCheck, group: 'admin' },
];

export function AppSidebar({ activeSection, onSectionChange, aiName, companionState }: AppSidebarProps) {
  const { isAdmin } = useAuth();
  const mainItems  = navItems.filter((i) => i.group === 'main');
  const toolItems  = navItems.filter((i) => i.group === 'tools');
  const sysItems   = navItems.filter((i) => i.group === 'system');
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
          'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all relative min-h-[44px]',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          item.group === 'admin' && !isActive && 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10'
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
        <DynamicIcon icon={IconComp} isActive={isActive} size={20} className="relative z-10" />
        <span className="relative z-10">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      {/* Brand / orb header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <CompanionOrb state={companionState} size="sm" showRipples={false} />
        <div className="flex flex-col min-w-0">
          <h1
            className="text-base font-bold text-foreground tracking-tight leading-none truncate"
            style={{ fontFamily: 'var(--font-space)' }}
          >
            {aiName}
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">AI Companion</p>
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-4 overflow-y-auto">
        {/* Main */}
        <div className="space-y-1">
          <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Companion
          </p>
          {mainItems.map(renderItem)}
        </div>

        {/* Tools */}
        <div className="space-y-1">
          <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Tools
          </p>
          {toolItems.map(renderItem)}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        {sysItems.map(renderItem)}
        {isAdmin && (
          <div className="mt-1 pt-1 border-t border-border/50">
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-violet-400/70">
              Admin
            </p>
            {adminItems.map(renderItem)}
          </div>
        )}
        <div className="px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>v1.0.0</span>
            <span className="w-2 h-2 bg-accent rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
