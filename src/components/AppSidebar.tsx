import { House, ChatCircle, Brain, Books, Target, Lightning, Lightbulb, Gear, type Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export type NavSection = 'home' | 'chat' | 'memory' | 'knowledge' | 'goals' | 'workflows' | 'insights' | 'settings';

interface AppSidebarProps {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  aiName: string;
}

const navItems: Array<{ id: NavSection; label: string; icon: Icon }> = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'chat', label: 'Chat', icon: ChatCircle },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'knowledge', label: 'Knowledge', icon: Books },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'workflows', label: 'Workflows', icon: Lightning },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'settings', label: 'Settings', icon: Gear },
];

export function AppSidebar({ activeSection, onSectionChange, aiName }: AppSidebarProps) {
  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary tracking-tight">{aiName}</h1>
        <p className="text-xs text-muted-foreground mt-1">Personal AI Companion</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all relative',
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
              <Icon size={20} weight={isActive ? 'fill' : 'regular'} className="relative z-10" />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Version 1.0.0</span>
            <span className="w-2 h-2 bg-accent rounded-full"></span>
          </div>
        </div>
      </div>
    </div>
  );
}
