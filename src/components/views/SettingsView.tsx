import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Gear,
  Robot,
  Brain,
  Shield,
  Sliders,
  ChatCircle,
  Database,
  Export,
  Heartbeat,
  Microphone,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  User,
  Lock,
  Bell,
  Palette,
  SignOut,
  Trash,
  Warning,
  WarningCircle,
  FloppyDisk,
  Spinner,
} from '@phosphor-icons/react';
import type { ConversationMode, SettingsAccountViewModel } from '@/types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  getCachedModels,
  preloadModels,
} from '@/utils/model-cache';
import { useSettings } from '@/context/settings-context';
import { useAuth } from '@/context/auth-context';
import { useVoice } from '@/context/voice-context';
import { EmojiOrbCustomizer } from '@/components/EmojiOrbCustomizer';
import { toast } from 'sonner';

const CONVERSATION_MODES: { value: ConversationMode; label: string }[] = [
  { value: 'strategist', label: 'Strategist' },
  { value: 'operator', label: 'Operator' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'coach', label: 'Coach' },
  { value: 'creative', label: 'Creative' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'prompt-studio', label: 'Prompt Studio' },
  { value: 'custom', label: 'Custom' },
];

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  description?: string;
}

interface ModelRegistry {
  chat: ModelEntry[];
  image: ModelEntry[];
  video: ModelEntry[];
  music: ModelEntry[];
  voice: ModelEntry[];
}

const CITATION_OPTIONS = [
  { value: 'always', label: 'Always' },
  { value: 'when-available', label: 'When Available' },
  { value: 'never', label: 'Never' },
];

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {Icon && (
          <div className="mt-0.5">
            <Icon size={18} className="text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SliderSetting({
  label,
  description,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (value: number) => void;
}) {
  const display = format ? format(value) : value;

  return (
    <div className="py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <span className="text-sm font-mono text-muted-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

type ServiceStatus = 'ok' | 'error' | 'not_configured' | 'checking' | 'idle';

interface DiagnosticsResult {
  openai: ServiceStatus;
  supabase: ServiceStatus;
  vector_search: ServiceStatus;
  media: ServiceStatus;
  leonardo: ServiceStatus;
  realtime_voice: ServiceStatus;
}

const INITIAL_DIAGNOSTICS: DiagnosticsResult = {
  openai: 'idle',
  supabase: 'idle',
  vector_search: 'idle',
  media: 'idle',
  leonardo: 'idle',
  realtime_voice: 'idle',
};

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowsClockwise size={14} className="animate-spin" />
        Checking…
      </span>
    );
  }
  if (status === 'ok') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-500">
        <CheckCircle size={14} weight="fill" />
        Connected
      </span>
    );
  }
  if (status === 'not_configured') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-yellow-500">
        <WarningCircle size={14} weight="fill" />
        Not Configured
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-500">
        <XCircle size={14} weight="fill" />
        Error
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground/50">—</span>;
}

const SERVICE_LABELS: Record<keyof DiagnosticsResult, string> = {
  openai: 'OpenAI',
  supabase: 'Supabase',
  vector_search: 'Vector Search',
  media: 'Media APIs',
  leonardo: 'Leonardo AI',
  realtime_voice: 'Realtime Voice',
};

function SavingIndicator({ saving }: { saving: boolean }) {
  if (!saving) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
      <Spinner size={13} className="animate-spin" />
      Saving…
    </span>
  );
}

export function SettingsView() {
  const {
    settings,
    updateSettings,
    updateModelSettings: updateModel,
    updateMemorySettings: updateMemory,
    updatePrivacySettings: updatePrivacy,
    prefs,
    prefsSaving,
    updatePreferences: savePrefs,
    updatePreferencesDebounced: savePrefsDebounced,
  } = useSettings();
  const { user, logout, configured: authConfigured, authState, loading: authLoading } = useAuth();
  const { voice: realtimeVoice, setVoice: setRealtimeVoice } = useVoice();

  const update = (patch: Partial<typeof settings>) => {
    updateSettings(patch);
  };

  const voiceMode = prefs.voice_mode || 'push-to-talk';

  const [modelRegistry, setModelRegistry] = useState<ModelRegistry | null>(
    () => getCachedModels() as ModelRegistry | null
  );

  useEffect(() => {
    preloadModels().then((data) => {
      if (data) setModelRegistry(data as ModelRegistry);
    });
  }, []);

  const handleVoiceModeChange = (mode: 'continuous' | 'push-to-talk') => {
    savePrefs({ voice_mode: mode });
  };

  const handleRealtimeVoiceChange = (voice: string) => {
    setRealtimeVoice(voice as Parameters<typeof setRealtimeVoice>[0]);
  };

  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult>(INITIAL_DIAGNOSTICS);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const runSystemTest = async () => {
    setIsRunningTest(true);
    setDiagnostics({
      openai: 'checking',
      supabase: 'checking',
      vector_search: 'checking',
      media: 'checking',
      leonardo: 'checking',
      realtime_voice: 'checking',
    });

    try {
      const res = await fetch('/.netlify/functions/system-health');
      if (!res.ok) throw new Error('Health check request failed');
      const json = await res.json();
      const data = json.data ?? json;

      const w = window as typeof window & {
        SpeechRecognition?: typeof SpeechRecognition;
        webkitSpeechRecognition?: typeof SpeechRecognition;
      };
      const hasVoice = !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);

      setDiagnostics({
        openai: data.openai === 'ok' ? 'ok' : data.openai === 'not_configured' ? 'not_configured' : 'error',
        supabase: data.supabase === 'ok' ? 'ok' : data.supabase === 'not_configured' ? 'not_configured' : 'error',
        vector_search: data.vector_search === 'ok' ? 'ok' : data.vector_search === 'not_configured' ? 'not_configured' : 'error',
        media: data.media === 'ok' ? 'ok' : data.media === 'not_configured' ? 'not_configured' : 'error',
        leonardo: data.leonardo === 'ok' ? 'ok' : data.leonardo === 'not_configured' ? 'not_configured' : 'error',
        realtime_voice: hasVoice ? 'ok' : 'error',
      });
    } catch {
      setDiagnostics({
        openai: 'error',
        supabase: 'error',
        vector_search: 'error',
        media: 'error',
        leonardo: 'error',
        realtime_voice: 'error',
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    setDisplayName(prefs.display_name ?? '');
    setBio(prefs.bio ?? '');
  }, [prefs.display_name, prefs.bio]);

  const userInitials = (prefs.display_name || user?.email || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Compute the auth display view-model for the Account tab
  const accountVM: SettingsAccountViewModel = (() => {
    if (authLoading || authState.status === 'initializing') {
      return { display: 'loading' };
    }
    if (authState.status === 'error') {
      return { display: 'error', error: authState.error, configured: authConfigured };
    }
    if (authState.status === 'authenticated' || authState.status === 'refreshing') {
      return { display: 'signed-in', email: authState.email, userId: authState.userId };
    }
    return { display: 'signed-out', configured: authConfigured };
  })();

  return (
    <div className="settings-panel p-4 md:p-8 max-w-3xl mx-auto">
      <div className="space-y-6 md:space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Gear size={28} weight="fill" className="text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Configure your companion's behavior, model controls, and privacy preferences.
          </p>
        </motion.div>

        <Tabs defaultValue="account" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="settings-tabs-list min-w-max">
              <TabsTrigger value="account" className="gap-1.5">
                <User size={16} /> Account
              </TabsTrigger>
              <TabsTrigger value="ai-controls" className="gap-1.5">
                <Robot size={16} /> AI Controls
              </TabsTrigger>
              <TabsTrigger value="model" className="gap-1.5">
                <Sliders size={16} /> Models
              </TabsTrigger>
              <TabsTrigger value="memory" className="gap-1.5">
                <Brain size={16} /> Memory
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-1.5">
                <Shield size={16} /> Privacy
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5">
                <Microphone size={16} /> Voice
              </TabsTrigger>
              <TabsTrigger value="diagnostics" className="gap-1.5">
                <Heartbeat size={16} /> Diagnostics
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-1.5">
                <Palette size={16} /> Appearance
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1.5">
                <Bell size={16} /> Notifications
              </TabsTrigger>
              {authConfigured && (
                <TabsTrigger value="security" className="gap-1.5">
                  <Lock size={16} /> Security
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="account">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <Card className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Profile</h3>
                  <SavingIndicator saving={prefsSaving} />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage your public profile information.
                </p>
                <Separator />
                <div className="py-6 flex items-center gap-4">
                  <Avatar className="size-16">
                    <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{prefs.display_name || 'No name set'}</p>
                    <p className="text-sm text-muted-foreground">{user?.email ?? 'Not signed in'}</p>
                  </div>
                </div>
                <Separator />
                <SettingRow icon={User} label="Display Name" description="The name shown across the app.">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={() => {
                      if (displayName !== (prefs.display_name ?? '')) {
                        savePrefs({ display_name: displayName });
                      }
                    }}
                    className="w-48"
                    placeholder="Your name"
                  />
                </SettingRow>
                <Separator />
                <div className="py-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <FloppyDisk size={18} className="text-muted-foreground" />
                    <Label className="text-sm font-medium">Bio</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">A short description about yourself.</p>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    onBlur={() => {
                      if (bio !== (prefs.bio ?? '')) {
                        savePrefs({ bio });
                      }
                    }}
                    placeholder="Tell your companion a bit about you…"
                    className="min-h-[80px] resize-none"
                  />
                </div>
                {authConfigured && (
                <>
                <Separator />
                <SettingRow icon={Lock} label="Email" description="Linked account email. Managed by your auth provider.">
                  <Input value={user?.email ?? '—'} readOnly className="w-56 opacity-60 cursor-default" />
                </SettingRow>
                </>
                )}
              </Card>
              {authConfigured && (
              <Card className="p-6">
                <h3 className="font-semibold mb-1">Password</h3>
                <p className="text-sm text-muted-foreground">
                  Password changes are handled via email. Use the &quot;Forgot password&quot; flow on the login screen to receive a reset link.
                </p>
              </Card>
              )}

              {/* ── Auth / Account Status — always visible ── */}
              <Card className="p-6">
                <h3 className="font-semibold mb-1">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-4">Your current sign-in status and account controls.</p>
                <Separator />

                {accountVM.display === 'loading' && (
                  <div className="flex items-center gap-3 py-4">
                    <Spinner size={18} className="animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Restoring session…</span>
                  </div>
                )}

                {accountVM.display === 'signed-in' && (
                  <>
                    <SettingRow icon={User} label="Signed in as" description="The account currently logged in.">
                      <span className="text-sm text-muted-foreground">{accountVM.email}</span>
                    </SettingRow>
                    <Separator />
                    <div className="py-4">
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={async () => {
                          try {
                            await logout();
                          } catch {
                            toast.error('Failed to sign out. Please try again.');
                          }
                        }}
                      >
                        <SignOut size={16} />
                        Sign Out
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">You will be returned to the login screen.</p>
                    </div>
                  </>
                )}

                {accountVM.display === 'signed-out' && (
                  <div className="py-4 space-y-2">
                    <p className="text-sm text-muted-foreground">You are not signed in.</p>
                    {accountVM.configured ? (
                      <p className="text-xs text-muted-foreground">Sign out and back in from the login screen, or reload the app to re-authenticate.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Supabase is not configured. Set <code className="text-xs">VITE_SUPABASE_URL</code> and <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> to enable authentication.</p>
                    )}
                  </div>
                )}

                {accountVM.display === 'error' && (
                  <div className="py-4 space-y-3">
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {accountVM.error}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                      Retry
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="ai-controls">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <Card className="p-6">
                <h3 className="font-semibold mb-1">General</h3>
                <p className="text-sm text-muted-foreground mb-4">Set your companion's identity and default behavior.</p>
                <Separator />
                <SettingRow icon={Robot} label="AI Name" description="The display name for your AI companion.">
                  <Input value={settings.aiName} onChange={(e) => update({ aiName: e.target.value })} className="w-48" />
                </SettingRow>
                <Separator />
                <SettingRow icon={ChatCircle} label="Default Conversation Mode" description="The mode used when starting new conversations.">
                  <Select value={settings.defaultMode} onValueChange={(value) => update({ defaultMode: value as ConversationMode })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONVERSATION_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Personality &amp; Style</h3>
                  <SavingIndicator saving={prefsSaving} />
                </div>
                <p className="text-sm text-muted-foreground mb-4">Shape how your companion communicates and responds.</p>
                <Separator />
                <SettingRow label="Personality Style" description="Overall character of your companion.">
                  <Select value={prefs.ai_personality} onValueChange={(value) => savePrefs({ ai_personality: value as typeof prefs.ai_personality })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="analytical">Analytical</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Tone" description="How formal or casual the companion sounds.">
                  <Select value={prefs.ai_tone} onValueChange={(value) => savePrefs({ ai_tone: value as typeof prefs.ai_tone })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Response Length" description="How long the companion's replies tend to be.">
                  <Select value={prefs.response_length} onValueChange={(value) => savePrefs({ response_length: value as typeof prefs.response_length })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Memory Depth" description="How far back the companion draws from memory.">
                  <Select value={prefs.memory_depth} onValueChange={(value) => savePrefs({ memory_depth: value as typeof prefs.memory_depth })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="session">Session only</SelectItem>
                      <SelectItem value="short_term">Short-term</SelectItem>
                      <SelectItem value="long_term">Long-term</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Behavioral Sliders</h3>
                  <SavingIndicator saving={prefsSaving} />
                </div>
                <p className="text-sm text-muted-foreground mb-4">Fine-tune the emotional and stylistic qualities of responses.</p>
                <Separator />
                <SliderSetting
                  label="Creativity"
                  description="Higher values produce more imaginative, varied responses."
                  value={Math.round(prefs.creativity_level * 100)}
                  min={0} max={100} step={5}
                  format={(v) => `${v}%`}
                  onChange={(v) => savePrefsDebounced({ creativity_level: v / 100 })}
                />
                <Separator />
                <SliderSetting
                  label="Empathy"
                  description="Higher values make the companion more emotionally attuned."
                  value={Math.round(prefs.empathy_level * 100)}
                  min={0} max={100} step={5}
                  format={(v) => `${v}%`}
                  onChange={(v) => savePrefsDebounced({ empathy_level: v / 100 })}
                />
                <Separator />
                <SliderSetting
                  label="Directness"
                  description="Higher values produce more concise, to-the-point answers."
                  value={Math.round(prefs.directness_level * 100)}
                  min={0} max={100} step={5}
                  format={(v) => `${v}%`}
                  onChange={(v) => savePrefsDebounced({ directness_level: v / 100 })}
                />
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="model">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <Card className="p-6">
                <h3 className="font-semibold mb-1">Model Selection</h3>
                <p className="text-sm text-muted-foreground mb-4">Choose which models power your companion.</p>
                <Separator />
                <SettingRow label="Chat Model" description="Primary model used for all conversations.">
                  <Select
                    value={settings.modelSettings.defaultModel}
                    onValueChange={(value) => updateModel({ defaultModel: value })}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(modelRegistry?.chat ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Fallback Model" description="Used when the chat model is unavailable.">
                  <Select
                    value={settings.modelSettings.fallbackModel}
                    onValueChange={(value) => updateModel({ fallbackModel: value })}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(modelRegistry?.chat ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Image Model" description="Model used for image generation.">
                  <Select
                    value={settings.modelSettings.imageModel}
                    onValueChange={(value) => updateModel({ imageModel: value })}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(modelRegistry?.image ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Video Model" description="Model used for video generation.">
                  <Select
                    value={settings.modelSettings.videoModel}
                    onValueChange={(value) => updateModel({ videoModel: value })}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(modelRegistry?.video ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Music Model" description="Model used for music generation.">
                  <Select
                    value={settings.modelSettings.musicModel}
                    onValueChange={(value) => updateModel({ musicModel: value })}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(modelRegistry?.music ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Voice Model" description="Model used for voice synthesis.">
                  <Select
                    value={settings.modelSettings.voiceModel}
                    onValueChange={(value) => updateModel({ voiceModel: value })}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(modelRegistry?.voice ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow
                  label="Citation Preference"
                  description="When to include source citations in responses."
                >
                  <Select
                    value={settings.modelSettings.citationPreference}
                    onValueChange={(value) =>
                      updateModel({ citationPreference: value as 'always' | 'when-available' | 'never' })
                    }
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CITATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-1">Fine-Tuning</h3>
                <p className="text-sm text-muted-foreground mb-4">Adjust how the model generates responses.</p>
                <Separator />
                <SliderSetting
                  label="Temperature"
                  description="Higher values make output more creative, lower values more deterministic."
                  value={settings.modelSettings.temperature}
                  min={0}
                  max={1}
                  step={0.1}
                  format={(v) => v.toFixed(1)}
                  onChange={(value) => updateModel({ temperature: value })}
                />
                <Separator />
                <SliderSetting
                  label="Max Response Length"
                  description="Maximum number of tokens in each response."
                  value={settings.modelSettings.maxLength}
                  min={500}
                  max={4000}
                  step={100}
                  onChange={(value) => updateModel({ maxLength: value })}
                />
                <Separator />
                <SliderSetting
                  label="Tool Use Aggressiveness"
                  description="How readily the model invokes external tools and functions."
                  value={settings.modelSettings.toolUseAggressiveness}
                  min={0}
                  max={1}
                  step={0.1}
                  format={(v) => v.toFixed(1)}
                  onChange={(value) => updateModel({ toolUseAggressiveness: value })}
                />
                <Separator />
                <SliderSetting
                  label="Memory Retrieval Intensity"
                  description="How aggressively past memories are pulled into context."
                  value={settings.modelSettings.memoryRetrievalIntensity}
                  min={0}
                  max={1}
                  step={0.1}
                  format={(v) => v.toFixed(1)}
                  onChange={(value) => updateModel({ memoryRetrievalIntensity: value })}
                />
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="memory">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Card className="p-6">
                <h3 className="font-semibold mb-1">Memory Settings</h3>
                <p className="text-sm text-muted-foreground mb-4">Control how your companion captures and manages memories.</p>
                <Separator />
                <SettingRow icon={Brain} label="Auto-Capture Memories" description="Automatically save important context from conversations.">
                  <Switch checked={settings.memorySettings.autoCapture} onCheckedChange={(checked) => updateMemory({ autoCapture: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow icon={Shield} label="Require Approval Before Saving" description="Ask for confirmation before storing new memories.">
                  <Switch checked={settings.memorySettings.requireApproval} onCheckedChange={(checked) => updateMemory({ requireApproval: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow icon={Database} label="Enable Summarization" description="Condense older memories to save space while retaining key context.">
                  <Switch checked={settings.memorySettings.summarization} onCheckedChange={(checked) => updateMemory({ summarization: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow label="Retention Period (days)" description="Automatically remove memories older than this. Leave empty for indefinite.">
                  <Input type="number" min={1} placeholder="Indefinite" value={settings.memorySettings.retentionDays ?? ''} onChange={(e) => updateMemory({ retentionDays: e.target.value ? parseInt(e.target.value, 10) : undefined })} className="w-32" />
                </SettingRow>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="privacy">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Card className="p-6">
                <h3 className="font-semibold mb-1">Privacy Settings</h3>
                <p className="text-sm text-muted-foreground mb-4">Manage how your data is stored, exported, and audited.</p>
                <Separator />
                <SettingRow icon={Database} label="Enable Data Storage" description="Allow persistent storage of conversations and preferences.">
                  <Switch checked={settings.privacySettings.dataStorage} onCheckedChange={(checked) => updatePrivacy({ dataStorage: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow icon={Export} label="Enable Data Export" description="Allow exporting your data for backup or portability.">
                  <Switch checked={settings.privacySettings.exportEnabled} onCheckedChange={(checked) => updatePrivacy({ exportEnabled: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow icon={Shield} label="Enable Audit Trail" description="Keep a log of all data access and modifications.">
                  <Switch checked={settings.privacySettings.auditTrail} onCheckedChange={(checked) => updatePrivacy({ auditTrail: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow label="Data Retention (days)" description="Automatically purge conversation data older than this. Leave empty for indefinite.">
                  <Input type="number" min={1} placeholder="Indefinite" value={prefs.data_retention_days ?? ''} onChange={(e) => savePrefs({ data_retention_days: e.target.value ? parseInt(e.target.value, 10) : undefined })} className="w-32" />
                </SettingRow>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="voice">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-1">Voice Mode</h3>
                <p className="text-sm text-muted-foreground mb-4">Choose how the microphone behaves during Live Talk sessions.</p>
                <Separator />
                <SettingRow icon={Microphone} label="Continuous Conversation" description="Microphone stays active and automatically resumes listening after the AI responds.">
                  <Switch checked={voiceMode === 'continuous'} onCheckedChange={(checked) => handleVoiceModeChange(checked ? 'continuous' : 'push-to-talk')} />
                </SettingRow>
                <Separator />
                <div className="py-4">
                  <p className="text-xs text-muted-foreground">
                    {voiceMode === 'continuous'
                      ? 'Live Talk will automatically start listening and resume after each AI response. Click the mic once to begin.'
                      : 'Live Talk requires clicking the microphone each time you want to speak (default behavior).'}
                  </p>
                </div>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-1">Realtime Voice</h3>
                <p className="text-sm text-muted-foreground mb-4">Select the AI voice used for realtime conversations. Live Talk uses OpenAI Realtime API for low-latency speech-to-speech.</p>
                <Separator />
                <SettingRow label="Voice" description="OpenAI realtime voice for Live Talk.">
                  <Select value={realtimeVoice} onValueChange={handleRealtimeVoiceChange}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marin">Marin</SelectItem>
                      <SelectItem value="cedar">Cedar</SelectItem>
                      <SelectItem value="alloy">Alloy</SelectItem>
                      <SelectItem value="echo">Echo</SelectItem>
                      <SelectItem value="shimmer">Shimmer</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <div className="py-4">
                  <p className="text-xs text-muted-foreground">Realtime voice uses WebRTC for true streaming audio. If unavailable, Live Talk falls back to speech-to-text with TTS playback.</p>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="diagnostics">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Card className="p-6">
                <h3 className="font-semibold mb-1">System Diagnostics</h3>
                <p className="text-sm text-muted-foreground mb-4">Check the status of all connected services and APIs.</p>
                <Separator />
                <div className="space-y-0">
                  {(Object.keys(SERVICE_LABELS) as (keyof DiagnosticsResult)[]).map((key) => (
                    <div key={key}>
                      <div className="flex items-center justify-between py-3">
                        <Label className="text-sm font-medium">{SERVICE_LABELS[key]}</Label>
                        <StatusBadge status={diagnostics[key]} />
                      </div>
                      <Separator />
                    </div>
                  ))}
                </div>
                <div className="pt-5">
                  <Button onClick={runSystemTest} disabled={isRunningTest} className="gap-2">
                    {isRunningTest ? <ArrowsClockwise size={16} className="animate-spin" /> : <Heartbeat size={16} />}
                    {isRunningTest ? 'Running…' : 'Run System Test'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="appearance">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Appearance</h3>
                  <SavingIndicator saving={prefsSaving} />
                </div>
                <p className="text-sm text-muted-foreground mb-4">Customize the look and feel of the app.</p>
                <Separator />
                <SettingRow icon={Palette} label="Theme" description="Choose between dark, light, or follow system preference.">
                  <Select value={prefs.theme} onValueChange={(value) => { savePrefs({ theme: value as typeof prefs.theme }); try { localStorage.setItem('theme', value); } catch {} }}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Font Size" description="Adjust the base text size across the interface.">
                  <Select value={prefs.font_size} onValueChange={(value) => savePrefs({ font_size: value as typeof prefs.font_size })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Small</SelectItem>
                      <SelectItem value="md">Medium</SelectItem>
                      <SelectItem value="lg">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow label="Reduce Motion" description="Minimize animations for a more static experience.">
                  <Switch checked={prefs.reduce_motion} onCheckedChange={(checked) => savePrefs({ reduce_motion: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow label="High Contrast" description="Increase color contrast to improve readability.">
                  <Switch checked={prefs.high_contrast} onCheckedChange={(checked) => savePrefs({ high_contrast: checked })} />
                </SettingRow>
              </Card>

              {/* Emoji Orb Customizer */}
              <Card className="p-6 mt-6">
                <h3 className="font-semibold mb-1">Orb Appearance</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload an image to generate a personalized emoji-style orb. Your image is analyzed locally to create a custom orb skin.
                </p>
                <Separator className="mb-4" />
                <EmojiOrbCustomizer />
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="notifications">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Notifications</h3>
                  <SavingIndicator saving={prefsSaving} />
                </div>
                <p className="text-sm text-muted-foreground mb-4">Control when and how you receive notifications.</p>
                <Separator />
                <SettingRow icon={Bell} label="Enable Notifications" description="Master toggle for all notification types.">
                  <Switch checked={prefs.notifications_enabled} onCheckedChange={(checked) => savePrefs({ notifications_enabled: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow label="In-App Notifications" description="Show alerts and toasts within the application.">
                  <Switch checked={prefs.notification_in_app} disabled={!prefs.notifications_enabled} onCheckedChange={(checked) => savePrefs({ notification_in_app: checked })} />
                </SettingRow>
                <Separator />
                <SettingRow label="Email Notifications" description={<>Receive updates via email. <span className="italic opacity-60">Coming soon</span></>}>
                  <Switch checked={prefs.notification_email} disabled onCheckedChange={(checked) => savePrefs({ notification_email: checked })} />
                </SettingRow>
              </Card>
            </motion.div>
          </TabsContent>

          {authConfigured && (
          <TabsContent value="security">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold mb-1">Current Session</h3>
                <p className="text-sm text-muted-foreground mb-4">Information about your active login.</p>
                <Separator />
                <SettingRow icon={User} label="Signed in as" description="The account currently logged in.">
                  <span className="text-sm text-muted-foreground">{user?.email ?? '—'}</span>
                </SettingRow>
                <Separator />
                <div className="py-4">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={async () => {
                      try {
                        await logout();
                      } catch {
                        toast.error('Failed to sign out. Please try again.');
                      }
                    }}
                  >
                    <SignOut size={16} />
                    Sign Out
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">You will be returned to the login screen.</p>
                </div>
              </Card>
              <Card className="p-6 border-destructive/40">
                <div className="flex items-center gap-2 mb-1">
                  <Warning size={18} className="text-destructive" />
                  <h3 className="font-semibold text-destructive">Danger Zone</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Irreversible actions. Proceed with caution.</p>
                <Separator />
                <div className="py-4 space-y-3">
                  <p className="text-sm">Deleting your account permanently removes all your data, memories, and settings. This action cannot be undone.</p>
                  <Button variant="destructive" className="gap-2" onClick={() => toast.error('Account deletion is not yet available. Please contact support.')}>
                    <Trash size={16} />
                    Delete My Account
                  </Button>
                </div>
              </Card>
            </motion.div>
          </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
