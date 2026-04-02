import { useState } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { Bell } from '@phosphor-icons/react/Bell';
import { Check } from '@phosphor-icons/react/Check';
import { CircleDashed } from '@phosphor-icons/react/CircleDashed';
import { Eye } from '@phosphor-icons/react/Eye';
import { EyeSlash } from '@phosphor-icons/react/EyeSlash';
import { Handshake } from '@phosphor-icons/react/Handshake';
import { Lightbulb } from '@phosphor-icons/react/Lightbulb';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { Warning } from '@phosphor-icons/react/Warning';
import { X } from '@phosphor-icons/react/X';
import type { Insight } from '@/types';
import { getRelativeTime } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const INSIGHT_TYPE_CONFIG: Record<Insight['type'], { label: string; icon: typeof Lightbulb; color: string }> = {
  reminder: { label: 'Reminder', icon: Bell, color: 'text-blue-500' },
  'follow-up': { label: 'Follow-up', icon: ArrowClockwise, color: 'text-violet-500' },
  'open-loop': { label: 'Open Loop', icon: CircleDashed, color: 'text-orange-500' },
  commitment: { label: 'Commitment', icon: Handshake, color: 'text-emerald-500' },
  stalled: { label: 'Stalled', icon: Warning, color: 'text-red-500' },
  opportunity: { label: 'Opportunity', icon: Sparkle, color: 'text-amber-500' },
  pattern: { label: 'Pattern', icon: TrendUp, color: 'text-cyan-500' },
};

const PRIORITY_CONFIG: Record<Insight['priority'], { label: string; dot: string; badge: string }> = {
  high: { label: 'High', dot: 'bg-red-500', badge: 'destructive' },
  medium: { label: 'Medium', dot: 'bg-amber-500', badge: 'secondary' },
  low: { label: 'Low', dot: 'bg-slate-400', badge: 'outline' },
};

type TypeFilter = 'all' | Insight['type'];
type PriorityFilter = 'all' | Insight['priority'];

export function InsightsView() {
  const [insights, setInsights] = useLocalStorage<Insight[]>('insights', []);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showDismissed, setShowDismissed] = useState(false);

  const allInsights = insights || [];

  const filteredInsights = allInsights.filter((insight) => {
    if (!showDismissed && insight.dismissedAt) return false;
    if (showDismissed && !insight.dismissedAt) return false;
    if (typeFilter !== 'all' && insight.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && insight.priority !== priorityFilter) return false;
    return true;
  });

  const activeCount = allInsights.filter((i) => !i.dismissedAt).length;

  const handleDismiss = (id: string) => {
    setInsights((prev) => {
      const current = prev || [];
      return current.map((insight) =>
        insight.id === id ? { ...insight, dismissedAt: Date.now() } : insight
      );
    });
  };

  const handleRestore = (id: string) => {
    setInsights((prev) => {
      const current = prev || [];
      return current.map((insight) =>
        insight.id === id ? { ...insight, dismissedAt: undefined } : insight
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-6 border-b border-border/75 bg-[oklch(0.18_0.014_255/0.86)] backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb size={24} weight="fill" className="text-primary" />
            </div>
            <div>
              <p className="executive-eyebrow">Intelligence Signals</p>
              <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
              <p className="text-sm text-muted-foreground">
                {activeCount} active insight{activeCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              {showDismissed ? (
                <EyeSlash size={16} />
              ) : (
                <Eye size={16} />
              )}
              <span>{showDismissed ? 'Dismissed' : 'Active'}</span>
              <Switch
                checked={showDismissed}
                onCheckedChange={setShowDismissed}
              />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <TabsList className="flex-wrap h-auto gap-1 bg-black/20 border border-border/70">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="reminder" className="text-xs">Reminders</TabsTrigger>
              <TabsTrigger value="follow-up" className="text-xs">Follow-ups</TabsTrigger>
              <TabsTrigger value="open-loop" className="text-xs">Open Loops</TabsTrigger>
              <TabsTrigger value="commitment" className="text-xs">Commitments</TabsTrigger>
              <TabsTrigger value="stalled" className="text-xs">Stalled</TabsTrigger>
              <TabsTrigger value="opportunity" className="text-xs">Opportunities</TabsTrigger>
              <TabsTrigger value="pattern" className="text-xs">Patterns</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Priority:</span>
            {(['all', 'high', 'medium', 'low'] as const).map((p) => (
              <Button
                key={p}
                variant={priorityFilter === p ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setPriorityFilter(p)}
              >
                {p === 'all' ? 'All' : PRIORITY_CONFIG[p].label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3">
          {filteredInsights.length > 0 ? (
            filteredInsights.map((insight, index) => {
              const config = INSIGHT_TYPE_CONFIG[insight.type];
              const pConfig = PRIORITY_CONFIG[insight.priority];
              const IconComponent = config.icon;

              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Card
                    className={cn(
                      'p-4 transition-all',
                      insight.priority === 'high' && !insight.dismissedAt &&
                        'border-l-4 border-l-red-500 shadow-sm shadow-red-500/10',
                      insight.priority === 'medium' && !insight.dismissedAt &&
                        'border-l-4 border-l-amber-500',
                      insight.dismissedAt && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg bg-muted shrink-0 mt-0.5', config.color)}>
                        <IconComponent size={18} weight="fill" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className={cn('text-xs', config.color)}>
                            {config.label}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', pConfig.dot)} />
                            <span className="text-xs text-muted-foreground">{pConfig.label}</span>
                          </div>
                          {insight.actionable && (
                            <Badge variant="secondary" className="text-xs">
                              <Check size={10} className="mr-0.5" /> Actionable
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold mb-1">{insight.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {insight.description}
                        </p>

                        {insight.action && (
                          <div className="mt-2 p-2 bg-muted/50 rounded-md">
                            <p className="text-xs font-medium text-foreground">
                              Suggested action: {insight.action}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-xs text-muted-foreground">
                            {getRelativeTime(insight.createdAt)}
                          </span>
                          {insight.dismissedAt && (
                            <span className="text-xs text-muted-foreground">
                              · Dismissed {getRelativeTime(insight.dismissedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {insight.dismissedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => handleRestore(insight.id)}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => handleDismiss(insight.id)}
                          >
                            <X size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Lightbulb size={32} weight="fill" className="text-primary" />
              </div>
              <h3 className="font-semibold mb-2">
                {showDismissed ? 'No dismissed insights' : 'No insights yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {showDismissed
                  ? 'Insights you dismiss will appear here so you can restore them later.'
                  : 'Insights are generated automatically as you use Vuk OS. They surface reminders, follow-ups, stalled goals, patterns, and opportunities based on your conversations and activity.'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
