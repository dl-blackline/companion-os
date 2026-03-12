import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
} from '@phosphor-icons/react';
import type { CompanionSettings, ConversationMode } from '@/types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SettingsViewProps {
  settings: CompanionSettings;
  onSettingsChange: (settings: CompanionSettings) => void;
}

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

/** Maps modelSettings field names to their localStorage keys. */
const MODEL_STORAGE_KEYS: Record<string, string> = {
  defaultModel: 'chat_model',
  fallbackModel: 'fallback_model',
  imageModel: 'image_model',
  videoModel: 'video_model',
  musicModel: 'music_model',
  voiceModel: 'voice_model',
};

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description?: string;
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

type ServiceStatus = 'ok' | 'error' | 'checking' | 'idle';

interface DiagnosticsResult {
  openai: ServiceStatus;
  gemini: ServiceStatus;
  supabase: ServiceStatus;
  vector_search: ServiceStatus;
  media: ServiceStatus;
  realtime_voice: ServiceStatus;
}

const INITIAL_DIAGNOSTICS: DiagnosticsResult = {
  openai: 'idle',
  gemini: 'idle',
  supabase: 'idle',
  vector_search: 'idle',
  media: 'idle',
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
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-500">
        <XCircle size={14} weight="fill" />
        Error
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground/50">—</span>
  );
}

const SERVICE_LABELS: Record<keyof DiagnosticsResult, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  supabase: 'Supabase',
  vector_search: 'Vector Search',
  media: 'Media APIs',
  realtime_voice: 'Realtime Voice',
};

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  const update = (patch: Partial<CompanionSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  // Voice mode preference
  const [voiceMode, setVoiceMode] = useState<'continuous' | 'push-to-talk'>(() => {
    try {
      return (localStorage.getItem('voice_mode') as 'continuous' | 'push-to-talk') || 'push-to-talk';
    } catch {
      return 'push-to-talk';
    }
  });

  // Model registry loaded from backend
  const [modelRegistry, setModelRegistry] = useState<ModelRegistry | null>(null);

  useEffect(() => {
    fetch('/.netlify/functions/models')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setModelRegistry(data);
      })
      .catch((err) => {
        console.warn('Failed to load model registry:', err);
      });
  }, []);

  const handleVoiceModeChange = (mode: 'continuous' | 'push-to-talk') => {
    setVoiceMode(mode);
    localStorage.setItem('voice_mode', mode);
  };

  // System diagnostics
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult>(INITIAL_DIAGNOSTICS);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const runSystemTest = async () => {
    setIsRunningTest(true);
    setDiagnostics({
      openai: 'checking',
      gemini: 'checking',
      supabase: 'checking',
      vector_search: 'checking',
      media: 'checking',
      realtime_voice: 'checking',
    });

    try {
      const res = await fetch('/.netlify/functions/system-health');
      if (!res.ok) throw new Error('Health check request failed');
      const data = await res.json();

      // Check realtime voice availability (Web Speech API)
      const w = window as typeof window & {
        SpeechRecognition?: typeof SpeechRecognition;
        webkitSpeechRecognition?: typeof SpeechRecognition;
      };
      const hasVoice = !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);

      setDiagnostics({
        openai: data.openai === 'ok' ? 'ok' : 'error',
        gemini: data.gemini === 'ok' ? 'ok' : 'error',
        supabase: data.supabase === 'ok' ? 'ok' : 'error',
        vector_search: data.vector_search === 'ok' ? 'ok' : 'error',
        media: data.media === 'ok' ? 'ok' : 'error',
        realtime_voice: hasVoice ? 'ok' : 'error',
      });
    } catch {
      setDiagnostics({
        openai: 'error',
        gemini: 'error',
        supabase: 'error',
        vector_search: 'error',
        media: 'error',
        realtime_voice: 'error',
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const updateMemory = (patch: Partial<CompanionSettings['memorySettings']>) => {
    onSettingsChange({
      ...settings,
      memorySettings: { ...settings.memorySettings, ...patch },
    });
  };

  const updateModel = (patch: Partial<CompanionSettings['modelSettings']>) => {
    onSettingsChange({
      ...settings,
      modelSettings: { ...settings.modelSettings, ...patch },
    });

    // Persist individual model selections to localStorage for easy access
    // by the chat request layer.
    for (const [field, storageKey] of Object.entries(MODEL_STORAGE_KEYS)) {
      if (field in patch) {
        localStorage.setItem(storageKey, (patch as Record<string, string>)[field]);
      }
    }
  };

  const updatePrivacy = (patch: Partial<CompanionSettings['privacySettings']>) => {
    onSettingsChange({
      ...settings,
      privacySettings: { ...settings.privacySettings, ...patch },
    });
  };

  return (
    <div className="p-8 space-y-8 max-w-3xl mx-auto">
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

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-1.5">
            <Robot size={16} /> General
          </TabsTrigger>
          <TabsTrigger value="model" className="gap-1.5">
            <Sliders size={16} /> Model Controls
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
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-1">General Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set your companion's identity and default behavior.
              </p>
              <Separator />

              <SettingRow
                icon={Robot}
                label="AI Name"
                description="The display name for your AI companion."
              >
                <Input
                  value={settings.aiName}
                  onChange={(e) => update({ aiName: e.target.value })}
                  className="w-48"
                />
              </SettingRow>

              <Separator />

              <SettingRow
                icon={ChatCircle}
                label="Default Conversation Mode"
                description="The mode used when starting new conversations."
              >
                <Select
                  value={settings.defaultMode}
                  onValueChange={(value) =>
                    update({ defaultMode: value as ConversationMode })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONVERSATION_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Model Controls Tab */}
        <TabsContent value="model">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-1">Model Selection</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose which models power your companion.
              </p>
              <Separator />

              <SettingRow
                label="Chat Model"
                description="Primary model used for all conversations."
              >
                <Select
                  value={settings.modelSettings.defaultModel}
                  onValueChange={(value) => updateModel({ defaultModel: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelRegistry?.chat ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <SettingRow
                label="Fallback Model"
                description="Used when the chat model is unavailable."
              >
                <Select
                  value={settings.modelSettings.fallbackModel}
                  onValueChange={(value) => updateModel({ fallbackModel: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelRegistry?.chat ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <SettingRow
                label="Image Model"
                description="Model used for image generation."
              >
                <Select
                  value={settings.modelSettings.imageModel}
                  onValueChange={(value) => updateModel({ imageModel: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelRegistry?.image ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <SettingRow
                label="Video Model"
                description="Model used for video generation."
              >
                <Select
                  value={settings.modelSettings.videoModel}
                  onValueChange={(value) => updateModel({ videoModel: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelRegistry?.video ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <SettingRow
                label="Music Model"
                description="Model used for music generation."
              >
                <Select
                  value={settings.modelSettings.musicModel}
                  onValueChange={(value) => updateModel({ musicModel: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelRegistry?.music ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <SettingRow
                label="Voice Model"
                description="Model used for voice synthesis."
              >
                <Select
                  value={settings.modelSettings.voiceModel}
                  onValueChange={(value) => updateModel({ voiceModel: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelRegistry?.voice ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
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
                    updateModel({
                      citationPreference: value as 'always' | 'when-available' | 'never',
                    })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-1">Fine-Tuning</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Adjust how the model generates responses.
              </p>
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

        {/* Memory Tab */}
        <TabsContent value="memory">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-1">Memory Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Control how your companion captures and manages memories.
              </p>
              <Separator />

              <SettingRow
                icon={Brain}
                label="Auto-Capture Memories"
                description="Automatically save important context from conversations."
              >
                <Switch
                  checked={settings.memorySettings.autoCapture}
                  onCheckedChange={(checked) =>
                    updateMemory({ autoCapture: checked })
                  }
                />
              </SettingRow>

              <Separator />

              <SettingRow
                icon={Shield}
                label="Require Approval Before Saving"
                description="Ask for confirmation before storing new memories."
              >
                <Switch
                  checked={settings.memorySettings.requireApproval}
                  onCheckedChange={(checked) =>
                    updateMemory({ requireApproval: checked })
                  }
                />
              </SettingRow>

              <Separator />

              <SettingRow
                icon={Database}
                label="Enable Summarization"
                description="Condense older memories to save space while retaining key context."
              >
                <Switch
                  checked={settings.memorySettings.summarization}
                  onCheckedChange={(checked) =>
                    updateMemory({ summarization: checked })
                  }
                />
              </SettingRow>

              <Separator />

              <SettingRow
                label="Retention Period (days)"
                description="Automatically remove memories older than this. Leave empty for indefinite."
              >
                <Input
                  type="number"
                  min={1}
                  placeholder="Indefinite"
                  value={settings.memorySettings.retentionDays ?? ''}
                  onChange={(e) =>
                    updateMemory({
                      retentionDays: e.target.value
                        ? parseInt(e.target.value, 10)
                        : undefined,
                    })
                  }
                  className="w-32"
                />
              </SettingRow>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-1">Privacy Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manage how your data is stored, exported, and audited.
              </p>
              <Separator />

              <SettingRow
                icon={Database}
                label="Enable Data Storage"
                description="Allow persistent storage of conversations and preferences."
              >
                <Switch
                  checked={settings.privacySettings.dataStorage}
                  onCheckedChange={(checked) =>
                    updatePrivacy({ dataStorage: checked })
                  }
                />
              </SettingRow>

              <Separator />

              <SettingRow
                icon={Export}
                label="Enable Data Export"
                description="Allow exporting your data for backup or portability."
              >
                <Switch
                  checked={settings.privacySettings.exportEnabled}
                  onCheckedChange={(checked) =>
                    updatePrivacy({ exportEnabled: checked })
                  }
                />
              </SettingRow>

              <Separator />

              <SettingRow
                icon={Shield}
                label="Enable Audit Trail"
                description="Keep a log of all data access and modifications."
              >
                <Switch
                  checked={settings.privacySettings.auditTrail}
                  onCheckedChange={(checked) =>
                    updatePrivacy({ auditTrail: checked })
                  }
                />
              </SettingRow>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Voice Tab */}
        <TabsContent value="voice">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-1">Voice Mode</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose how the microphone behaves during Live Talk sessions.
              </p>
              <Separator />

              <SettingRow
                icon={Microphone}
                label="Continuous Conversation"
                description="Microphone stays active and automatically resumes listening after the AI responds."
              >
                <Switch
                  checked={voiceMode === 'continuous'}
                  onCheckedChange={(checked) =>
                    handleVoiceModeChange(checked ? 'continuous' : 'push-to-talk')
                  }
                />
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
          </motion.div>
        </TabsContent>

        {/* Diagnostics Tab */}
        <TabsContent value="diagnostics">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-1">System Diagnostics</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Check the status of all connected services and APIs.
              </p>
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
                <Button
                  onClick={runSystemTest}
                  disabled={isRunningTest}
                  className="gap-2"
                >
                  {isRunningTest ? (
                    <ArrowsClockwise size={16} className="animate-spin" />
                  ) : (
                    <Heartbeat size={16} />
                  )}
                  {isRunningTest ? 'Running…' : 'Run System Test'}
                </Button>
              </div>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
