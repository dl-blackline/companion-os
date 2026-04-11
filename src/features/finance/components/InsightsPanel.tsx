/**
 * InsightsPanel — Financial insights, warnings, and suggested actions.
 *
 * Displays AI-generated financial insights with severity badges and
 * optional action hints. Also shows the Vuk Intelligence narrative.
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface FinancialInsight {
  id: string;
  title: string;
  summary: string;
  severity: string;
  action_hint?: string;
}

export interface InsightsPanelProps {
  insights: FinancialInsight[];
  /** Pulse narrative from financial health hook */
  pulseNarrative: string;
}

export function InsightsPanel({ insights, pulseNarrative }: InsightsPanelProps) {
  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-2">
        <p className="text-sm font-semibold">Financial Insight Engine</p>
        <p className="text-xs text-muted-foreground">Insights are generated as planning support only and are not financial advice.</p>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No insights available.</p>
        ) : (
          insights.map((insight) => (
            <div key={insight.id} className="rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-semibold">{insight.title}</p>
                <Badge variant={insight.severity === 'critical' || insight.severity === 'high' ? 'destructive' : 'secondary'} className="capitalize">{insight.severity}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{insight.summary}</p>
              {insight.action_hint && <p className="text-xs mt-2 text-foreground/90">Action support: {insight.action_hint}</p>}
            </div>
          ))
        )}
      </Card>

      {/* Vuk Intelligence narrative */}
      <Card className="p-5">
        <p className="text-sm font-semibold mb-1">Vuk Intelligence</p>
        <p className="text-sm text-muted-foreground">{pulseNarrative}</p>
      </Card>
    </div>
  );
}
