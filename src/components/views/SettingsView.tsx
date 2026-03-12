import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
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

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4', label: 'GPT-4' },
];

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

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  const update = (patch: Partial<CompanionSettings>) => {
    onSettingsChange({ ...settings, ...patch });
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
                label="Default Model"
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
                    {MODEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <SettingRow
                label="Fallback Model"
                description="Used when the default model is unavailable."
              >
                <Select
                  value={settings.modelSettings.fallbackModel}
                  onValueChange={(value) => updateModel({ fallbackModel: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
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
      </Tabs>
    </div>
  );
}
