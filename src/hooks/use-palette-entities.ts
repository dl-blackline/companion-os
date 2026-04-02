import { useMemo } from 'react';
import { useLifeOS } from '@/hooks/use-life-os';
import type { EntityResult, SmartSuggestion } from '@/lib/command-registry';

/**
 * Provides entity search results and AI smart suggestions from live app data.
 * Only queries data that's already cached in the Life OS dashboard —
 * no additional network requests on every keystroke.
 */
export function usePaletteEntities(query: string, activeSection: string) {
  const { dashboard } = useLifeOS();

  // ── Build flat entity list from dashboard data ───────────────────────
  const allEntities = useMemo<EntityResult[]>(() => {
    if (!dashboard) return [];
    const results: EntityResult[] = [];

    // Goals
    for (const g of dashboard.goals ?? []) {
      results.push({
        id: `goal-${g.id}`,
        label: g.title,
        sublabel: `${g.life_category} · ${g.status}${g.is_financial && g.target_amount ? ` · $${Number(g.target_amount).toLocaleString()}` : ''}`,
        type: 'goal',
        icon: 'target',
        section: 'goals',
      });
    }

    // Savings goals
    for (const sg of dashboard.savingsGoals ?? []) {
      results.push({
        id: `sg-${sg.id}`,
        label: sg.name,
        sublabel: `$${Number(sg.current_amount).toLocaleString()} / $${Number(sg.target_amount).toLocaleString()}`,
        type: 'savings_goal',
        icon: 'piggy',
        section: 'finance',
      });
    }

    // Obligations
    for (const ob of dashboard.activeObligations ?? []) {
      const name = ob.institution_name || ob.account_label || ob.category;
      results.push({
        id: `ob-${ob.id}`,
        label: name,
        sublabel: `${ob.category}${ob.amount_due ? ` · $${Number(ob.amount_due).toLocaleString()}` : ''}${ob.due_date ? ` · due ${ob.due_date}` : ''}`,
        type: 'obligation',
        icon: 'repeat',
        section: 'finance',
      });
    }

    // Upcoming events
    for (const ev of dashboard.upcomingEvents ?? []) {
      results.push({
        id: `ev-${ev.id}`,
        label: ev.title,
        sublabel: `${ev.event_type} · ${ev.scheduled_date}`,
        type: 'event',
        icon: 'calendar',
        section: 'goals',
      });
    }

    // Signals (active only)
    for (const sig of dashboard.signals ?? []) {
      if (sig.status !== 'active') continue;
      results.push({
        id: `sig-${sig.id}`,
        label: sig.title,
        sublabel: sig.action_hint ?? sig.summary ?? undefined,
        type: 'signal',
        icon: 'warning',
        section: sig.source_system === 'finance' || sig.target_system === 'finance' ? 'finance' : 'goals',
      });
    }

    return results;
  }, [dashboard]);

  // ── Filter entities by search query ──────────────────────────────────
  const entityResults = useMemo<EntityResult[]>(() => {
    if (!query || query.length < 2) return [];
    const lower = query.toLowerCase();
    return allEntities
      .filter(
        (e) =>
          e.label.toLowerCase().includes(lower) ||
          (e.sublabel?.toLowerCase().includes(lower) ?? false),
      )
      .slice(0, 8);
  }, [query, allEntities]);

  // ── AI Smart suggestions (context-aware, no query needed) ────────────
  const smartSuggestions = useMemo<SmartSuggestion[]>(() => {
    if (!dashboard) return [];
    const suggestions: SmartSuggestion[] = [];

    // High/critical signals → suggest reviewing them
    const urgentSignals = (dashboard.signals ?? []).filter(
      (s) => s.status === 'active' && (s.severity === 'high' || s.severity === 'critical'),
    );
    for (const sig of urgentSignals.slice(0, 2)) {
      suggestions.push({
        id: `smart-sig-${sig.id}`,
        label: sig.title,
        sublabel: sig.action_hint ?? 'Review this signal',
        icon: 'warning',
        section: sig.source_system === 'finance' || sig.target_system === 'finance' ? 'finance' : 'goals',
        severity: sig.severity === 'critical' ? 'critical' : 'warning',
      });
    }

    // At-risk goals (feasibility < 50)
    const atRisk = (dashboard.goals ?? []).filter(
      (g) => g.status === 'active' && g.feasibility_score != null && g.feasibility_score < 50,
    );
    for (const g of atRisk.slice(0, 2)) {
      suggestions.push({
        id: `smart-risk-${g.id}`,
        label: `${g.title} is at risk`,
        sublabel: `Feasibility ${g.feasibility_score}% — review or adjust`,
        icon: 'target',
        section: 'goals',
        severity: 'warning',
      });
    }

    // Off-pace savings goals
    const offPace = (dashboard.savingsGoals ?? []).filter(
      (sg) => sg.pace_status === 'at_risk',
    );
    for (const sg of offPace.slice(0, 2)) {
      suggestions.push({
        id: `smart-pace-${sg.id}`,
        label: `${sg.name} is off pace`,
        sublabel: `$${Number(sg.current_amount).toLocaleString()} of $${Number(sg.target_amount).toLocaleString()} saved`,
        icon: 'piggy',
        section: 'finance',
        severity: 'warning',
      });
    }

    // Context-aware: suggest relevant actions based on section
    if (activeSection === 'finance' && suggestions.length < 4) {
      const dueSoon = (dashboard.activeObligations ?? []).filter((ob) => {
        if (!ob.due_date) return false;
        const days = (new Date(ob.due_date).getTime() - Date.now()) / 86400000;
        return days >= 0 && days <= 7;
      });
      for (const ob of dueSoon.slice(0, 2)) {
        suggestions.push({
          id: `smart-due-${ob.id}`,
          label: `${ob.institution_name || ob.category} due soon`,
          sublabel: `$${Number(ob.amount_due).toLocaleString()} due ${ob.due_date}`,
          icon: 'calendar',
          section: 'finance',
          severity: 'info',
        });
      }
    }

    if (activeSection === 'goals' && suggestions.length < 4) {
      const upcoming = (dashboard.upcomingEvents ?? []).slice(0, 2);
      for (const ev of upcoming) {
        suggestions.push({
          id: `smart-ev-${ev.id}`,
          label: ev.title,
          sublabel: `${ev.event_type} on ${ev.scheduled_date}`,
          icon: 'calendar',
          section: 'goals',
          severity: 'info',
        });
      }
    }

    return suggestions.slice(0, 5);
  }, [dashboard, activeSection]);

  return { entityResults, smartSuggestions, allEntities };
}
