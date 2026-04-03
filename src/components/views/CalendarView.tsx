import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFinancialIntelligence } from '@/hooks/use-financial-intelligence';
import { useLifeOS } from '@/hooks/use-life-os';
import { useAutomotiveFinance } from '@/hooks/use-automotive-finance';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { CaretLeft } from '@phosphor-icons/react/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { Car } from '@phosphor-icons/react/Car';
import { CurrencyDollar } from '@phosphor-icons/react/CurrencyDollar';
import { Funnel } from '@phosphor-icons/react/Funnel';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { Target } from '@phosphor-icons/react/Target';
import { Warning } from '@phosphor-icons/react/Warning';

/* ── Types ────────────────────────────────────────────────────── */

type EventDomain = 'financial' | 'life' | 'automotive';

interface UnifiedEvent {
  id: string;
  title: string;
  date: string;
  domain: EventDomain;
  type: string;
  amount: number | null;
  status: string;
  meta?: string;
}

type DomainFilter = 'all' | EventDomain;

/* ── Helpers ──────────────────────────────────────────────────── */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '';
  return n < 0
    ? `-$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function domainColor(domain: EventDomain): string {
  switch (domain) {
    case 'financial': return 'text-emerald-400';
    case 'life': return 'text-sky-400';
    case 'automotive': return 'text-amber-400';
  }
}

function domainBg(domain: EventDomain): string {
  switch (domain) {
    case 'financial': return 'bg-emerald-500/15 border-emerald-500/30';
    case 'life': return 'bg-sky-500/15 border-sky-500/30';
    case 'automotive': return 'bg-amber-500/15 border-amber-500/30';
  }
}

function domainDot(domain: EventDomain): string {
  switch (domain) {
    case 'financial': return 'bg-emerald-400';
    case 'life': return 'bg-sky-400';
    case 'automotive': return 'bg-amber-400';
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'overdue': return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'completed': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'skipped': return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

/* ── Component ────────────────────────────────────────────────── */

export function CalendarView() {
  const { dashboard: fiDashboard, saveCalendarEvent, deleteCalendarEvent } = useFinancialIntelligence();
  const { dashboard: lifeDashboard } = useLifeOS();
  const { dashboard: autoDashboard } = useAutomotiveFinance();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(new Date()));
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [search, setSearch] = useState('');

  // Quick-add state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<string>('reminder');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);

  /* ── Unify all events ──────────────────────────────────────── */

  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    const events: UnifiedEvent[] = [];

    // Financial calendar events (bill dues, paydays, etc.)
    for (const evt of fiDashboard?.calendarEvents ?? []) {
      events.push({
        id: evt.id,
        title: evt.title,
        date: evt.scheduled_date,
        domain: 'financial',
        type: evt.event_type,
        amount: evt.amount,
        status: evt.status,
        meta: evt.notes ?? undefined,
      });
    }

    // Life OS upcoming events
    for (const evt of lifeDashboard?.upcomingEvents ?? []) {
      events.push({
        id: evt.id,
        title: evt.title,
        date: evt.scheduled_date,
        domain: 'life',
        type: evt.event_type,
        amount: evt.amount,
        status: evt.status,
      });
    }

    // Automotive deals → derive callback/funding events
    for (const deal of autoDashboard?.deals ?? []) {
      if (deal.callback_status && deal.callback_status !== 'none' && deal.last_activity_at) {
        events.push({
          id: `auto-cb-${deal.id}`,
          title: `Callback: ${deal.deal_name}`,
          date: deal.last_activity_at.slice(0, 10),
          domain: 'automotive',
          type: 'callback',
          amount: null,
          status: deal.callback_status,
          meta: deal.lender_name ?? undefined,
        });
      }
      if (deal.status === 'booked' && deal.last_activity_at) {
        events.push({
          id: `auto-fund-${deal.id}`,
          title: `Funding: ${deal.deal_name}`,
          date: deal.last_activity_at.slice(0, 10),
          domain: 'automotive',
          type: 'funding',
          amount: deal.payment_estimate ?? null,
          status: deal.has_open_cit ? 'cit_hold' : 'pending',
          meta: deal.vehicle_summary ?? undefined,
        });
      }
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [fiDashboard, lifeDashboard, autoDashboard]);

  /* ── Filtered events ───────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return unifiedEvents.filter((evt) => {
      if (domainFilter !== 'all' && evt.domain !== domainFilter) return false;
      if (q && !evt.title.toLowerCase().includes(q) && !evt.type.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [unifiedEvents, domainFilter, search]);

  /* ── Event map by date ─────────────────────────────────────── */

  const eventsByDate = useMemo(() => {
    const map = new Map<string, UnifiedEvent[]>();
    for (const evt of filtered) {
      const key = evt.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(evt);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  /* ── Calendar grid ─────────────────────────────────────────── */

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ key: string; day: number; inMonth: boolean }> = [];

    // Leading blanks
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, -(startOffset - i - 1));
      days.push({ key: toDateKey(d), day: d.getDate(), inMonth: false });
    }

    // Month days
    for (let d = 1; d <= totalDays; d++) {
      days.push({ key: toDateKey(new Date(year, month, d)), day: d, inMonth: true });
    }

    // Trailing blanks to fill 6 rows
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ key: toDateKey(d), day: d.getDate(), inMonth: false });
    }

    return days;
  }, [currentMonth]);

  const today = toDateKey(new Date());

  /* ── Selected date events ──────────────────────────────────── */

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  /* ── Summary stats ─────────────────────────────────────────── */

  const monthKey = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
  const monthEvents = filtered.filter((evt) => evt.date.startsWith(monthKey));
  const overdueCount = monthEvents.filter((e) => e.status === 'overdue').length;
  const totalMonthAmount = monthEvents.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  /* ── Navigation ────────────────────────────────────────────── */

  const prevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(toDateKey(now));
  }, []);

  /* ── Quick add event ───────────────────────────────────────── */

  const handleQuickAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await saveCalendarEvent({
        title: newTitle.trim(),
        scheduledDate: newDate || selectedDate,
        eventType: newType as 'bill_due' | 'payday' | 'savings_transfer' | 'debt_payment' | 'reminder' | 'custom',
        amount: newAmount ? Number(newAmount) : undefined,
      });
      setNewTitle('');
      setNewDate('');
      setNewAmount('');
    } finally {
      setSaving(false);
    }
  }, [newTitle, newDate, newType, newAmount, selectedDate, saveCalendarEvent]);

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="executive-shell container-scroll">
      {/* Header */}
      <div className="executive-header">
        <div>
          <p className="executive-eyebrow">Unified Calendar Intelligence</p>
          <h1 className="leading-tight">Calendar</h1>
          <p className="executive-subtitle">
            Financial obligations, life milestones, and F&I deal timelines in one view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="executive-grid md:grid-cols-4 mb-4">
        <Card className="executive-kpi">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Month Events</p>
            <CalendarBlank size={16} style={{ color: 'var(--vuk-accent-dim)' }} />
          </div>
          <p className="text-2xl font-semibold tracking-tight leading-none">{monthEvents.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{MONTHS[currentMonth.month]} {currentMonth.year}</p>
        </Card>

        <Card className="executive-kpi">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Obligations</p>
            <CurrencyDollar size={16} style={{ color: 'var(--vuk-accent-dim)' }} />
          </div>
          <p className="text-2xl font-semibold tracking-tight leading-none">{formatCurrency(totalMonthAmount) || '$0'}</p>
          <p className="text-xs text-muted-foreground mt-1">Total this month</p>
        </Card>

        <Card className="executive-kpi">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Overdue</p>
            <Warning size={16} className={overdueCount > 0 ? 'text-red-400' : 'text-muted-foreground'} />
          </div>
          <p className={`text-2xl font-semibold tracking-tight leading-none ${overdueCount > 0 ? 'text-red-400' : ''}`}>{overdueCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
        </Card>

        <Card className="executive-kpi">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Selected Day</p>
            <Lightning size={16} style={{ color: 'var(--vuk-accent-dim)' }} />
          </div>
          <p className="text-2xl font-semibold tracking-tight leading-none">{selectedEvents.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{parseDateKey(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        </Card>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1">
          <Funnel size={14} className="text-muted-foreground" />
        </div>
        {(['all', 'financial', 'life', 'automotive'] as DomainFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setDomainFilter(f)}
            className={`rounded-full px-3 py-1 text-xs transition-colors border ${
              domainFilter === f
                ? 'border-cyan-300/60 bg-cyan-900/30 text-cyan-200'
                : 'border-border bg-card text-muted-foreground hover:bg-card/80'
            }`}
          >
            {f === 'all' ? 'All Domains' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events..."
          className="max-w-[200px] h-7 text-xs"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
        {/* ── Calendar Grid ── */}
        <Card className="glass-card rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="rounded-md p-1.5 hover:bg-white/5 transition-colors">
              <CaretLeft size={18} className="text-muted-foreground" />
            </button>
            <h2 className="text-lg font-semibold tracking-tight">
              {MONTHS[currentMonth.month]} {currentMonth.year}
            </h2>
            <button onClick={nextMonth} className="rounded-md p-1.5 hover:bg-white/5 transition-colors">
              <CaretRight size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px">
            {calendarDays.map(({ key, day, inMonth }) => {
              const dayEvents = eventsByDate.get(key) ?? [];
              const isToday = key === today;
              const isSelected = key === selectedDate;
              const hasOverdue = dayEvents.some((e) => e.status === 'overdue');
              const domains = new Set(dayEvents.map((e) => e.domain));

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`relative rounded-lg p-1.5 min-h-[56px] text-left transition-all ${
                    !inMonth ? 'opacity-30' : ''
                  } ${
                    isSelected
                      ? 'bg-cyan-900/30 border border-cyan-300/50'
                      : isToday
                        ? 'bg-white/5 border border-white/10'
                        : 'border border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    isToday ? 'text-cyan-300' : isSelected ? 'text-cyan-200' : 'text-foreground'
                  }`}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap">
                      {domains.has('financial') && <span className={`w-1.5 h-1.5 rounded-full ${domainDot('financial')}`} />}
                      {domains.has('life') && <span className={`w-1.5 h-1.5 rounded-full ${domainDot('life')}`} />}
                      {domains.has('automotive') && <span className={`w-1.5 h-1.5 rounded-full ${domainDot('automotive')}`} />}
                      {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                    </div>
                  )}
                  {dayEvents.length > 2 && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">+{dayEvents.length}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Domain legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${domainDot('financial')}`} />Financial
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${domainDot('life')}`} />Life OS
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${domainDot('automotive')}`} />Automotive
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-red-400" />Overdue
            </span>
          </div>
        </Card>

        {/* ── Day Detail Panel ── */}
        <div className="space-y-4">
          <Card className="glass-card rounded-2xl p-4 md:p-5">
            <h3 className="text-sm font-semibold mb-3">
              {parseDateKey(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </h3>

            {selectedEvents.length === 0 ? (
              <div className="text-center py-6">
                <CalendarBlank size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No events on this date.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {selectedEvents.map((evt) => {
                  const DomainIcon = evt.domain === 'financial' ? CurrencyDollar
                    : evt.domain === 'automotive' ? Car
                    : Target;
                  return (
                    <div
                      key={evt.id}
                      className={`rounded-xl border p-3 ${domainBg(evt.domain)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <DomainIcon size={14} className={domainColor(evt.domain)} />
                          <p className="text-sm font-medium truncate">{evt.title}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${statusBadge(evt.status)}`}
                        >
                          {evt.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span>{evt.type.replace(/_/g, ' ')}</span>
                        {evt.amount != null && <span className="font-medium">{formatCurrency(evt.amount)}</span>}
                      </div>
                      {evt.meta && (
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">{evt.meta}</p>
                      )}
                      {evt.domain === 'financial' && !evt.id.startsWith('auto-') && (
                        <button
                          onClick={() => void deleteCalendarEvent(evt.id)}
                          className="text-[10px] text-red-400/70 hover:text-red-300 mt-1 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── Quick Add ── */}
          <Card className="glass-card rounded-2xl p-4 md:p-5 space-y-2">
            <h3 className="text-sm font-semibold">Quick Add Event</h3>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Event title"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={newDate || selectedDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <select
                aria-label="Event type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
              >
                <option value="reminder">Reminder</option>
                <option value="bill_due">Bill Due</option>
                <option value="payday">Payday</option>
                <option value="savings_transfer">Savings Transfer</option>
                <option value="debt_payment">Debt Payment</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <Input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="Amount (optional)"
            />
            <Button
              onClick={() => void handleQuickAdd()}
              disabled={saving || !newTitle.trim()}
              className="w-full"
            >
              {saving ? 'Saving...' : 'Add Event'}
            </Button>
          </Card>

          {/* ── Upcoming (next 7 days) ── */}
          <Card className="glass-card rounded-2xl p-4 md:p-5">
            <h3 className="text-sm font-semibold mb-3">Next 7 Days</h3>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {(() => {
                const now = new Date();
                const weekEnd = new Date(now);
                weekEnd.setDate(weekEnd.getDate() + 7);
                const upcoming = filtered.filter((evt) => {
                  const d = new Date(evt.date);
                  return d >= now && d <= weekEnd;
                });
                if (upcoming.length === 0) {
                  return <p className="text-xs text-muted-foreground">No upcoming events this week.</p>;
                }
                return upcoming.slice(0, 10).map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => setSelectedDate(evt.date.slice(0, 10))}
                    className="w-full text-left rounded-lg border border-border/40 bg-black/10 px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${domainDot(evt.domain)}`} />
                        <span className="font-medium">{evt.title}</span>
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(evt.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </button>
                ));
              })()}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
