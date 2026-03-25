import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { Brain } from '@phosphor-icons/react/Brain';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Clock } from '@phosphor-icons/react/Clock';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Notepad } from '@phosphor-icons/react/Notepad';
import { Plus } from '@phosphor-icons/react/Plus';
import { Robot } from '@phosphor-icons/react/Robot';
import { Spinner } from '@phosphor-icons/react/Spinner';
import { XCircle } from '@phosphor-icons/react/XCircle';
import { useAuth } from '@/context/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { isPaidPlan } from '@/lib/subscription-plans';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// ---- Agent definitions (mirrors lib/agent-registry.js for the UI) --------

const AGENT_DEFINITIONS: Record<string, { label: string; description: string; icon: typeof Robot }> = {
  research_agent: {
    label: 'Research Agent',
    description: 'Performs research tasks — web search, summarization, analysis',
    icon: MagnifyingGlass,
  },
  content_agent: {
    label: 'Content Agent',
    description: 'Generates creative briefs for images, video, and music',
    icon: ImageSquare,
  },
  planner_agent: {
    label: 'Planner Agent',
    description: 'Breaks goals into clear, actionable plans',
    icon: ListChecks,
  },
  memory_agent: {
    label: 'Memory Agent',
    description: 'Summarizes conversations and maintains long-term memory',
    icon: Brain,
  },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending:    { label: 'Pending',    icon: Clock,       color: 'text-amber-500' },
  processing: { label: 'Running',    icon: Spinner,     color: 'text-blue-500' },
  completed:  { label: 'Completed',  icon: CheckCircle, color: 'text-green-500' },
  failed:     { label: 'Failed',     icon: XCircle,     color: 'text-red-500' },
};

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

interface AgentTask {
  id: string;
  agent_type: string;
  task_description: string;
  status: string;
  result: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export function AgentsView() {
  const { getAccessToken, plan } = useAuth();
  const { usage } = useSubscription();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('research_agent');
  const [taskDescription, setTaskDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch tasks from API -------------------------------------------------

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/.netlify/functions/agent-task?list=true', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to load tasks');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ---- Create a new task ----------------------------------------------------

  const handleCreate = async () => {
    if (!taskDescription.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/.netlify/functions/agent-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ agent_type: selectedAgent, task: taskDescription.trim() }),
      });
      if (res.ok) {
        setTaskDescription('');
        setShowCreate(false);
        await fetchTasks();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to create task');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setSubmitting(false);
    }
  };

  const agentUsage = usage.agent_task;

  // ---- Filtering ------------------------------------------------------------

  const filteredTasks = tasks.filter((t) =>
    statusFilter === 'all' ? true : t.status === statusFilter
  );

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    processing: tasks.filter((t) => t.status === 'processing').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Robot size={24} weight="fill" className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
              <p className="text-sm text-muted-foreground">
                Autonomous AI agents running background tasks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchTasks} disabled={loading}>
              <ArrowClockwise size={16} className={cn('mr-1', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button onClick={() => setShowCreate((v) => !v)}>
              <Plus size={16} className="mr-1" /> New Task
            </Button>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border/70 bg-black/20 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {isPaidPlan(plan)
              ? 'Paid plan active: agent tasks are available without the free-tier cap.'
              : `Free plan: ${agentUsage?.remaining ?? 0} of ${agentUsage?.limit ?? 0} agent tasks remaining this month.`}
          </p>
          {!isPaidPlan(plan) && (
            <p className="text-xs text-muted-foreground mt-1">
              Upgrade in Settings to unlock higher automation capacity and ongoing agent workflows.
            </p>
          )}
        </div>

        {/* Agent cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {Object.entries(AGENT_DEFINITIONS).map(([key, def]) => {
            const IconComp = def.icon;
            return (
              <Card key={key} className="p-3 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted shrink-0">
                  <IconComp size={18} weight="fill" className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{def.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{def.description}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Status filter tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            {(['all', 'pending', 'processing', 'completed', 'failed'] as const).map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs capitalize">
                {s === 'all' ? 'All' : STATUS_CONFIG[s].label} ({counts[s]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Create task panel */}
      {showCreate && (
        <div className="px-6 pt-4">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Card className="p-5 border-primary/30">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Notepad size={18} className="text-primary" />
                Create Agent Task
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Agent Type</label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AGENT_DEFINITIONS).map(([key, def]) => (
                        <SelectItem key={key} value={key}>
                          {def.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Task Description</label>
                  <Textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Describe what the agent should do…"
                    className="resize-none min-h-[80px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreate} disabled={submitting || !taskDescription.trim()}>
                    {submitting ? 'Creating…' : 'Create Task'}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Task list */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task, index) => {
              const agentDef = AGENT_DEFINITIONS[task.agent_type];
              const statusDef = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
              const AgentIcon = agentDef?.icon || Robot;
              const StatusIcon = statusDef.icon;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted shrink-0 mt-0.5">
                        <AgentIcon size={18} weight="fill" className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {agentDef?.label || task.agent_type}
                          </Badge>
                          <div className={cn('flex items-center gap-1 text-xs', statusDef.color)}>
                            <StatusIcon size={14} weight="fill" />
                            <span>{statusDef.label}</span>
                          </div>
                        </div>
                        <p className="text-sm mb-1">{task.task_description}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(task.created_at).toLocaleString()}
                          {task.completed_at && ` · Completed ${new Date(task.completed_at).toLocaleString()}`}
                        </p>

                        {task.status === 'completed' && task.result && (
                          <details className="mt-2">
                            <summary className="text-xs font-medium cursor-pointer text-primary">
                              View Result
                            </summary>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                              {JSON.stringify(task.result, null, 2)}
                            </pre>
                          </details>
                        )}

                        {task.status === 'failed' && task.result && (
                          <p className="mt-1 text-xs text-red-500">
                            Error: {(task.result as Record<string, string>).error || 'Unknown error'}
                          </p>
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
                <Robot size={32} weight="fill" className="text-primary" />
              </div>
              <h3 className="font-semibold mb-2">
                {statusFilter !== 'all' ? `No ${statusFilter} tasks` : 'No agent tasks yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Create a new task to dispatch an autonomous AI agent. Agents run in the background and produce structured results.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
