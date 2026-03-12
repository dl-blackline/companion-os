import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkle, ArrowRight, CheckCircle, Clock } from '@phosphor-icons/react';
import type { DashboardData } from '@/types';
import { formatTime } from '@/lib/helpers';
import { motion } from 'framer-motion';

interface HomeDashboardProps {
  data: DashboardData;
  onNavigate: (section: string) => void;
}

export function HomeDashboard({ data, onNavigate }: HomeDashboardProps) {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
        <p className="text-muted-foreground">Here's what's happening with your goals and projects today.</p>
      </div>

      {data.focusRecommendation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 border-l-4 border-l-accent bg-gradient-to-r from-accent/10 to-transparent">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/20">
                <Sparkle size={24} weight="fill" className="text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Focus Recommendation</h3>
                <p className="text-sm text-muted-foreground">{data.focusRecommendation}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Today's Priorities</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('goals')}>
              View all <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {data.priorities.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-start gap-3">
                <CheckCircle size={20} weight={task.completed ? 'fill' : 'regular'} 
                  className={task.completed ? 'text-accent mt-0.5' : 'text-muted-foreground mt-0.5'} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </p>
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock size={12} /> {formatTime(task.dueDate)}
                    </p>
                  )}
                </div>
                <Badge variant={task.priority === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                  {task.priority}
                </Badge>
              </div>
            ))}
            {data.priorities.length === 0 && (
              <p className="text-sm text-muted-foreground">No priorities for today</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Active Goals</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('goals')}>
              View all <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
          <div className="space-y-4">
            {data.activeGoals.slice(0, 3).map((goal) => (
              <div key={goal.id}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{goal.title}</p>
                  <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </div>
            ))}
            {data.activeGoals.length === 0 && (
              <p className="text-sm text-muted-foreground">No active goals</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Conversations</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('chat')}>
              View all <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {data.recentConversations.slice(0, 3).map((conv) => (
              <div key={conv.id} className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg -m-2 transition-colors"
                onClick={() => onNavigate('chat')}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conv.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">{conv.mode}</Badge>
              </div>
            ))}
            {data.recentConversations.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent conversations</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Insights</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('insights')}>
              View all <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {data.insights.slice(0, 4).map((insight) => (
              <div key={insight.id} className="p-3 border border-border rounded-lg">
                <div className="flex items-start gap-3">
                  <Badge variant={insight.priority === 'high' ? 'default' : 'secondary'} className="mt-1">
                    {insight.type}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
            {data.insights.length === 0 && (
              <p className="text-sm text-muted-foreground">No insights available</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Memory Highlights</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('memory')}>
              View all <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {data.memoryHighlights.slice(0, 4).map((memory) => (
              <div key={memory.id} className="p-3 border border-border rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{memory.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{memory.content}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{memory.category}</Badge>
                </div>
              </div>
            ))}
            {data.memoryHighlights.length === 0 && (
              <p className="text-sm text-muted-foreground">No memory highlights</p>
            )}
          </div>
        </Card>
      </div>

      {data.currentProjects.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Current Projects</h3>
          <div className="flex flex-wrap gap-2">
            {data.currentProjects.map((project, idx) => (
              <Badge key={idx} variant="secondary" className="px-3 py-1">
                {project}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
