import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Flag,
  Ticket,
  ClipboardText,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  XCircle,
  Question,
  Gauge,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  PencilSimple,
  Spinner,
  Shield,
} from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/context/auth-context';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import type {
  UserRole,
  EntitlementPlan,
  ServiceStatus,
  ServiceHealth,
  AdminUser,
  FeatureFlag,
  AuditLogEntry,
  SupportTicket,
} from '@/types';

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function apiFetch(url: string, token: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

// ---------------------------------------------------------------------------
// Shared badge helpers
// ---------------------------------------------------------------------------
function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge
      className={cn(
        'text-xs font-medium',
        role === 'admin'
          ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
          : 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      )}
      variant="outline"
    >
      {role}
    </Badge>
  );
}

function PlanBadge({ plan }: { plan: EntitlementPlan }) {
  const styles: Record<EntitlementPlan, string> = {
    free: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    pro: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    enterprise: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    admin_override: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  };
  return (
    <Badge className={cn('text-xs font-medium', styles[plan])} variant="outline">
      {plan.replace('_', ' ')}
    </Badge>
  );
}

function StatusBadge({ status }: { status: AdminUser['status'] }) {
  const styles: Record<AdminUser['status'], string> = {
    active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    suspended: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    deactivated: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return (
    <Badge className={cn('text-xs font-medium', styles[status])} variant="outline">
      {status}
    </Badge>
  );
}

function ServiceStatusIcon({ status }: { status: ServiceStatus }) {
  if (status === 'healthy')
    return <CheckCircle className="w-4 h-4 text-emerald-400" weight="fill" />;
  if (status === 'warning')
    return <WarningCircle className="w-4 h-4 text-yellow-400" weight="fill" />;
  if (status === 'degraded')
    return <WarningCircle className="w-4 h-4 text-orange-400" weight="fill" />;
  if (status === 'down') return <XCircle className="w-4 h-4 text-red-400" weight="fill" />;
  return <Question className="w-4 h-4 text-zinc-500" weight="fill" />;
}

function serviceStatusColor(status: ServiceStatus) {
  const map: Record<ServiceStatus, string> = {
    healthy: 'text-emerald-400',
    warning: 'text-yellow-400',
    degraded: 'text-orange-400',
    down: 'text-red-400',
    unknown: 'text-zinc-500',
  };
  return map[status];
}

function ticketStatusStyle(status: string) {
  const map: Record<string, string> = {
    open: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    in_progress: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    closed: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    escalated: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return map[status] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
}

function ticketPriorityStyle(priority: string) {
  const map: Record<string, string> = {
    low: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return map[priority] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
}

function flagCategoryStyle(category: string) {
  const map: Record<string, string> = {
    ai: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    media: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    voice: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    memory: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    billing: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    beta: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    ops: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    security: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return map[category] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
}

// ---------------------------------------------------------------------------
// Shared state shapes
// ---------------------------------------------------------------------------
interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function initFetch<T>(): FetchState<T> {
  return { data: null, loading: true, error: null };
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------
function SkeletonRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 bg-white/5 rounded animate-pulse" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function LoadingRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert className="border-red-500/30 bg-red-500/10">
      <XCircle className="w-4 h-4 text-red-400" />
      <AlertDescription className="text-red-300 flex items-center gap-3">
        <span>{message}</span>
        <Button size="sm" variant="outline" onClick={onRetry} className="ml-auto border-red-500/30 text-red-300 hover:bg-red-500/10">
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
      <Question className="w-10 h-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

const tabMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 },
};

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------
interface OverviewData {
  totalUsers: number;
  activeUsers: number;
  openTickets: number;
  systemStatus: ServiceStatus;
  recentAudit: AuditLogEntry[];
}

function OverviewTab() {
  const [state, setState] = useState<FetchState<OverviewData>>(initFetch());

  const load = useCallback(async () => {
    setState(initFetch());
    try {
      const token = await getToken();
      const [usersRes, ticketsRes, healthRes, auditRes] = await Promise.allSettled([
        apiFetch('/.netlify/functions/admin-users', token),
        apiFetch('/.netlify/functions/support-tickets', token),
        apiFetch('/.netlify/functions/system-health', token),
        apiFetch('/.netlify/functions/audit-log?limit=5', token),
      ]);

      let totalUsers = 0;
      let activeUsers = 0;
      let openTickets = 0;
      let systemStatus: ServiceStatus = 'unknown';
      let recentAudit: AuditLogEntry[] = [];

      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const json = await usersRes.value.json();
        const users: AdminUser[] = json.users ?? json ?? [];
        totalUsers = users.length;
        activeUsers = users.filter((u) => u.status === 'active').length;
      }
      if (ticketsRes.status === 'fulfilled' && ticketsRes.value.ok) {
        const json = await ticketsRes.value.json();
        const tickets: SupportTicket[] = json.tickets ?? json ?? [];
        openTickets = tickets.filter((t) => t.status === 'open').length;
      }
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const json = await healthRes.value.json();
        const services: ServiceHealth[] = json.services ?? json ?? [];
        const statuses = services.map((s) => s.status);
        if (statuses.includes('down')) systemStatus = 'down';
        else if (statuses.includes('degraded')) systemStatus = 'degraded';
        else if (statuses.includes('warning')) systemStatus = 'warning';
        else if (statuses.every((s) => s === 'healthy')) systemStatus = 'healthy';
        else systemStatus = 'unknown';
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const json = await auditRes.value.json();
        recentAudit = json.logs ?? json.entries ?? json ?? [];
      }

      setState({ data: { totalUsers, activeUsers, openTickets, systemStatus, recentAudit }, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state.loading) {
    return (
      <motion.div {...tabMotion} className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-white/5 rounded-lg animate-pulse" />
      </motion.div>
    );
  }

  if (state.error) return <ErrorCard message={state.error} onRetry={load} />;
  if (!state.data) return null;

  const { totalUsers, activeUsers, openTickets, systemStatus, recentAudit } = state.data;

  const statCards = [
    { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-blue-400' },
    { label: 'Active Users', value: activeUsers, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Open Tickets', value: openTickets, icon: Ticket, color: 'text-yellow-400' },
    {
      label: 'System Health',
      value: systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1),
      icon: Gauge,
      color: serviceStatusColor(systemStatus),
    },
  ];

  return (
    <motion.div {...tabMotion} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
                <card.icon className={cn('w-4 h-4', card.color)} />
                {card.label}
              </div>
              <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ClipboardText className="w-4 h-4" />
            Recent Audit Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <EmptyState message="No recent audit log entries" />
          ) : (
            <div className="space-y-2">
              {recentAudit.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <Badge className="text-xs bg-violet-500/20 text-violet-300 border-violet-500/30 font-mono shrink-0" variant="outline">
                    {entry.action}
                  </Badge>
                  <span className="text-sm text-foreground truncate flex-1">
                    {entry.actor_email ?? entry.actor_id}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Users
// ---------------------------------------------------------------------------
function UsersTab() {
  const [state, setState] = useState<FetchState<AdminUser[]>>(initFetch());
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);

  // Create form
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('user');
  const [createPlan, setCreatePlan] = useState<EntitlementPlan>('free');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit form
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editPlan, setEditPlan] = useState<EntitlementPlan>('free');
  const [editStatus, setEditStatus] = useState<AdminUser['status']>('active');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    setState(initFetch());
    try {
      const token = await getToken();
      const res = await apiFetch('/.netlify/functions/admin-users', token);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setState({ data: json.users ?? json, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = (state.data ?? []).filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.display_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  function openEdit(user: AdminUser) {
    setEditUser(user);
    setEditRole(user.role);
    setEditPlan(user.plan);
    setEditStatus(user.status);
    setEditError('');
  }

  async function handleCreate() {
    if (!createEmail || !createPassword) { setCreateError('Email and password required'); return; }
    setCreateLoading(true);
    setCreateError('');
    try {
      const token = await getToken();
      const res = await apiFetch('/.netlify/functions/admin-users', token, {
        method: 'POST',
        body: JSON.stringify({ email: createEmail, password: createPassword, role: createRole, plan: createPlan }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed'); }
      setCreateOpen(false);
      setCreateEmail(''); setCreatePassword(''); setCreateRole('user'); setCreatePlan('free');
      load();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleEdit() {
    if (!editUser) return;
    setEditLoading(true);
    setEditError('');
    try {
      const token = await getToken();
      const res = await apiFetch(`/.netlify/functions/admin-users/${editUser.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ role: editRole, plan: editPlan, status: editStatus }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed'); }
      setEditUser(null);
      load();
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <motion.div {...tabMotion} className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <UserPlus className="w-4 h-4" />
          Create User
        </Button>
      </div>

      {state.error && <ErrorCard message={state.error} onRetry={load} />}

      <Card className="bg-card border-border overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.loading ? (
                <LoadingRows cols={8} />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState message="No users found" />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id} className="border-border hover:bg-white/[0.02]">
                    <TableCell className="font-mono text-xs text-foreground">{user.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.display_name ?? '—'}</TableCell>
                    <TableCell><RoleBadge role={user.role} /></TableCell>
                    <TableCell><PlanBadge plan={user.plan} /></TableCell>
                    <TableCell><StatusBadge status={user.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.last_sign_in ? new Date(user.last_sign_in).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(user)} className="h-7 w-7 p-0">
                        <PencilSimple className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Create User
            </DialogTitle>
            <DialogDescription>Add a new user to the system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <Alert className="border-red-500/30 bg-red-500/10">
                <AlertDescription className="text-red-300 text-sm">{createError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="user@example.com" className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="••••••••" className="bg-background border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={createRole} onValueChange={(v) => setCreateRole(v as UserRole)}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={createPlan} onValueChange={(v) => setCreatePlan(v as EntitlementPlan)}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="free">free</SelectItem>
                    <SelectItem value="pro">pro</SelectItem>
                    <SelectItem value="enterprise">enterprise</SelectItem>
                    <SelectItem value="admin_override">admin override</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLoading} className="gap-2">
              {createLoading && <Spinner className="w-3.5 h-3.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilSimple className="w-4 h-4" />
              Edit User
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editError && (
              <Alert className="border-red-500/30 bg-red-500/10">
                <AlertDescription className="text-red-300 text-sm">{editError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={editPlan} onValueChange={(v) => setEditPlan(v as EntitlementPlan)}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="free">free</SelectItem>
                    <SelectItem value="pro">pro</SelectItem>
                    <SelectItem value="enterprise">enterprise</SelectItem>
                    <SelectItem value="admin_override">admin override</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as AdminUser['status'])}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="suspended">suspended</SelectItem>
                    <SelectItem value="deactivated">deactivated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading} className="gap-2">
              {editLoading && <Spinner className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tab: System Health
// ---------------------------------------------------------------------------
const FALLBACK_SERVICES = ['auth', 'storage', 'queue'];

function SystemHealthTab() {
  const [state, setState] = useState<FetchState<ServiceHealth[]>>(initFetch());
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setState(initFetch());
    try {
      const token = await getToken();
      const res = await apiFetch('/.netlify/functions/system-health', token);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      const services: ServiceHealth[] = json.services ?? json ?? [];
      setLastChecked(new Date());
      setState({ data: services, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const services = state.data ?? [];
  const checkedKeys = new Set(services.map((s) => s.service));
  const allServices: ServiceHealth[] = [
    ...services,
    ...FALLBACK_SERVICES.filter((k) => !checkedKeys.has(k)).map((k) => ({
      service: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      status: 'unknown' as ServiceStatus,
      checked_at: new Date().toISOString(),
    })),
  ];

  const overallStatus: ServiceStatus = (() => {
    const statuses = allServices.map((s) => s.status);
    if (statuses.includes('down')) return 'down';
    if (statuses.includes('degraded')) return 'degraded';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.every((s) => s === 'healthy')) return 'healthy';
    return 'unknown';
  })();

  const overallBg: Record<ServiceStatus, string> = {
    healthy: 'bg-emerald-500/10 border-emerald-500/30',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    degraded: 'bg-orange-500/10 border-orange-500/30',
    down: 'bg-red-500/10 border-red-500/30',
    unknown: 'bg-zinc-500/10 border-zinc-500/30',
  };

  return (
    <motion.div {...tabMotion} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center gap-3 px-4 py-2.5 rounded-lg border', overallBg[overallStatus])}>
          <ServiceStatusIcon status={overallStatus} />
          <span className={cn('font-semibold text-sm', serviceStatusColor(overallStatus))}>
            System {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-muted-foreground">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={state.loading} className="gap-2 border-border">
            {state.loading
              ? <Spinner className="w-3.5 h-3.5 animate-spin" />
              : <ArrowsClockwise className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {state.error && <ErrorCard message={state.error} onRetry={load} />}

      {state.loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {allServices.map((svc) => (
            <Card key={svc.service} className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-4">
                <ServiceStatusIcon status={svc.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">{svc.label}</div>
                  {svc.message && <div className="text-xs text-muted-foreground truncate">{svc.message}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-xs font-medium capitalize', serviceStatusColor(svc.status))}>{svc.status}</div>
                  {svc.latency_ms != null && (
                    <div className="text-xs text-muted-foreground">{svc.latency_ms}ms</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Feature Flags
// ---------------------------------------------------------------------------
function FeatureFlagsTab() {
  const [state, setState] = useState<FetchState<FeatureFlag[]>>(initFetch());
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setState(initFetch());
    try {
      const token = await getToken();
      const res = await apiFetch('/.netlify/functions/feature-flags', token);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setState({ data: json.flags ?? json, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleFlag(flag: FeatureFlag) {
    setToggling((prev) => new Set(prev).add(flag.id));
    try {
      const token = await getToken();
      const res = await apiFetch(`/.netlify/functions/feature-flags`, token, {
        method: 'PATCH',
        body: JSON.stringify({ id: flag.id, enabled: !flag.enabled }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setState((prev) => ({
        ...prev,
        data: (prev.data ?? []).map((f) => f.id === flag.id ? { ...f, enabled: !f.enabled } : f),
      }));
    } catch {
      // silently fail; could add toast
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(flag.id); return s; });
    }
  }

  const flags = state.data ?? [];
  const byCategory = flags.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <motion.div {...tabMotion} className="space-y-6">
      {state.error && <ErrorCard message={state.error} onRetry={load} />}
      {state.loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <EmptyState message="No feature flags found" />
      ) : (
        Object.entries(byCategory).map(([category, categoryFlags]) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Badge className={cn('text-xs', flagCategoryStyle(category))} variant="outline">
                {category}
              </Badge>
              <Separator className="flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              {categoryFlags.map((flag) => (
                <Card key={flag.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{flag.name}</span>
                          {flag.kill_switch && (
                            <Badge className="text-xs bg-red-500/20 text-red-300 border-red-500/30" variant="outline">
                              kill switch
                            </Badge>
                          )}
                          {flag.admin_only && (
                            <Badge className="text-xs bg-violet-500/20 text-violet-300 border-violet-500/30" variant="outline">
                              admin only
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{flag.description}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${flag.rollout_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{flag.rollout_percentage}% rollout</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {toggling.has(flag.id) && <Spinner className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={() => toggleFlag(flag)}
                          disabled={toggling.has(flag.id)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Support
// ---------------------------------------------------------------------------
function SupportTab() {
  const [state, setState] = useState<FetchState<SupportTicket[]>>(initFetch());
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // Edit form state
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editResolution, setEditResolution] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    setState(initFetch());
    try {
      const token = await getToken();
      const res = await apiFetch('/.netlify/functions/support-tickets', token);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setState({ data: json.tickets ?? json, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditNotes(ticket.admin_notes ?? '');
    setEditResolution(ticket.resolution ?? '');
    setEditError('');
  }

  async function handleUpdate() {
    if (!selectedTicket) return;
    setEditLoading(true);
    setEditError('');
    try {
      const token = await getToken();
      const res = await apiFetch(`/.netlify/functions/support-tickets/${selectedTicket.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: editStatus, admin_notes: editNotes, resolution: editResolution }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed'); }
      setSelectedTicket(null);
      load();
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setEditLoading(false);
    }
  }

  const filtered = (state.data ?? []).filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <motion.div {...tabMotion} className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-background border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40 bg-background border-border">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {state.error && <ErrorCard message={state.error} onRetry={load} />}

      <Card className="bg-card border-border overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.loading ? (
                <LoadingRows cols={7} />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}><EmptyState message="No tickets found" /></TableCell>
                </TableRow>
              ) : (
                filtered.map((ticket) => (
                  <TableRow key={ticket.id} className="border-border hover:bg-white/[0.02] cursor-pointer" onClick={() => openTicket(ticket)}>
                    <TableCell className="font-medium text-sm text-foreground max-w-48 truncate">{ticket.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ticket.user_email ?? ticket.user_id}</TableCell>
                    <TableCell>
                      <Badge className="text-xs bg-zinc-500/20 text-zinc-300 border-zinc-500/30" variant="outline">
                        {ticket.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', ticketStatusStyle(ticket.status))} variant="outline">
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', ticketPriorityStyle(ticket.priority))} variant="outline">
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openTicket(ticket); }}>
                        <PencilSimple className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Ticket className="w-4 h-4" />
              {selectedTicket?.title}
            </DialogTitle>
            <DialogDescription className="text-xs font-mono">{selectedTicket?.user_email}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-2 pr-2">
              {editError && (
                <Alert className="border-red-500/30 bg-red-500/10">
                  <AlertDescription className="text-red-300 text-sm">{editError}</AlertDescription>
                </Alert>
              )}
              <div className="text-sm text-muted-foreground bg-background/50 rounded-lg p-3">
                {selectedTicket?.description}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Category</span>
                  <Badge className="text-xs bg-zinc-500/20 text-zinc-300 border-zinc-500/30" variant="outline">
                    {selectedTicket?.category}
                  </Badge>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Priority</span>
                  <Badge className={cn('text-xs', ticketPriorityStyle(selectedTicket?.priority ?? ''))} variant="outline">
                    {selectedTicket?.priority}
                  </Badge>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Admin Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Internal notes…"
                  className="bg-background border-border text-sm resize-none"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Resolution</Label>
                <Textarea
                  value={editResolution}
                  onChange={(e) => setEditResolution(e.target.value)}
                  placeholder="Describe the resolution…"
                  className="bg-background border-border text-sm resize-none"
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTicket(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={editLoading} className="gap-2">
              {editLoading && <Spinner className="w-3.5 h-3.5 animate-spin" />}
              Update Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Audit Logs
// ---------------------------------------------------------------------------
const AUDIT_PAGE_SIZE = 20;

function AuditLogsTab() {
  const [state, setState] = useState<FetchState<AuditLogEntry[]>>(initFetch());
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(async (p: number) => {
    setState(initFetch());
    try {
      const token = await getToken();
      const params = new URLSearchParams({ limit: String(AUDIT_PAGE_SIZE), page: String(p + 1) });
      const res = await apiFetch(`/.netlify/functions/audit-log?${params}`, token);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setState({ data: json.logs ?? json.entries ?? json, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const entries = state.data ?? [];
  const filtered = actionFilter
    ? entries.filter((e) => e.action.toLowerCase().includes(actionFilter.toLowerCase()))
    : entries;

  function actionBadgeColor(action: string) {
    if (action.includes('create') || action.includes('created')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (action.includes('delete') || action.includes('deleted')) return 'bg-red-500/20 text-red-300 border-red-500/30';
    if (action.includes('update') || action.includes('patch') || action.includes('edit')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (action.includes('login') || action.includes('auth')) return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
    return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
  }

  return (
    <motion.div {...tabMotion} className="space-y-4">
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter by action…"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="pl-9 bg-background border-border"
        />
      </div>

      {state.error && <ErrorCard message={state.error} onRetry={() => load(page)} />}

      <Card className="bg-card border-border overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Type</TableHead>
                <TableHead>Target ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.loading ? (
                <LoadingRows cols={5} />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}><EmptyState message="No audit log entries found" /></TableCell>
                </TableRow>
              ) : (
                filtered.map((entry) => (
                  <TableRow key={entry.id} className="border-border hover:bg-white/[0.02]">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-foreground max-w-36 truncate">
                      {entry.actor_email ?? entry.actor_id}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs font-mono', actionBadgeColor(entry.action))} variant="outline">
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.target_type}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-28 truncate">
                      {entry.target_id ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Page {page + 1}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || state.loading}
            className="gap-1 border-border"
          >
            <CaretLeft className="w-3.5 h-3.5" />
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={entries.length < AUDIT_PAGE_SIZE || state.loading}
            className="gap-1 border-border"
          >
            Next
            <CaretRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function AdminConsoleView() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ShieldCheck className="w-12 h-12 opacity-30" />
        <p className="text-sm">You do not have permission to access this page.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'health', label: 'System Health', icon: ShieldCheck },
    { id: 'flags', label: 'Feature Flags', icon: Flag },
    { id: 'support', label: 'Support', icon: Ticket },
    { id: 'audit', label: 'Audit Logs', icon: ClipboardText },
  ] as const;

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="w-5 h-5 text-primary" weight="fill" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-none">Admin Console</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Companion OS command center</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="w-full">
            <TabsList className="bg-card border border-border h-auto p-1 gap-0.5 flex w-max min-w-full">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 text-xs font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/20 rounded-md px-3 py-1.5 whitespace-nowrap"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <TabsContent value="overview" forceMount className={activeTab !== 'overview' ? 'hidden' : ''}>
                <OverviewTab />
              </TabsContent>
              <TabsContent value="users" forceMount className={activeTab !== 'users' ? 'hidden' : ''}>
                <UsersTab />
              </TabsContent>
              <TabsContent value="health" forceMount className={activeTab !== 'health' ? 'hidden' : ''}>
                <SystemHealthTab />
              </TabsContent>
              <TabsContent value="flags" forceMount className={activeTab !== 'flags' ? 'hidden' : ''}>
                <FeatureFlagsTab />
              </TabsContent>
              <TabsContent value="support" forceMount className={activeTab !== 'support' ? 'hidden' : ''}>
                <SupportTab />
              </TabsContent>
              <TabsContent value="audit" forceMount className={activeTab !== 'audit' ? 'hidden' : ''}>
                <AuditLogsTab />
              </TabsContent>
            </AnimatePresence>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
