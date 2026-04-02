import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { Brain } from '@phosphor-icons/react/Brain';
import { FloppyDisk } from '@phosphor-icons/react/FloppyDisk';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { Robot } from '@phosphor-icons/react/Robot';
import { Sliders } from '@phosphor-icons/react/Sliders';
import { motion, useReducedMotion } from 'framer-motion';
import { useAIControl } from '@/context/ai-control-context';
import { useAccentLighting, ACCENT_THEMES, type AccentThemeId } from '@/context/accent-lighting-context';
import { getCachedModels, preloadModels } from '@/utils/model-cache';

const TONE_OPTIONS = [
  { id: 'professional', name: 'Professional' },
  { id: 'warm', name: 'Warm' },
  { id: 'direct', name: 'Direct' },
  { id: 'coach', name: 'Coach' },
  { id: 'analytical', name: 'Analytical' },
] as const;

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function ControlCenterView() {
  const {
    config,
    loading,
    saving,
    error,
    setConfig,
    saveConfig,
    reloadConfig,
    orchestratorConfig,
  } = useAIControl();

  const { activeThemeId, setAccentTheme } = useAccentLighting();

  const [modelOptions, setModelOptions] = useState<{ id: string; name: string }[]>(
    () => (getCachedModels()?.chat ?? []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }))
  );
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    preloadModels().then((data) => {
      if (data?.chat && data.chat.length > 0) {
        setModelOptions(data.chat.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })));
      }
    });
  }, []);

  return (
    <div className="settings-panel p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.24 }}
        className="settings-hero flex flex-col gap-2"
      >
        <p className="executive-eyebrow">Orchestrator Runtime</p>
        <div className="flex items-center gap-3">
          <Sliders size={26} className="text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">AI Control Center</h1>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Unified control for model, behavior, memory, capabilities, and advanced runtime parameters.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.2, delay: reduceMotion ? 0 : 0.03 }}>
      <Card className="settings-surface p-6 border-border/75">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium">Status</p>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading settings…' : saving ? 'Saving settings…' : 'Ready'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={reloadConfig} disabled={loading || saving} className="gap-2">
              <ArrowsClockwise size={14} />
              Reload
            </Button>
            <Button onClick={saveConfig} disabled={loading || saving} className="gap-2">
              <FloppyDisk size={14} />
              Save
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.2, delay: reduceMotion ? 0 : 0.05 }}>
      <Card className="settings-surface p-6 border-border/75">
          <SectionHeader title="Model Selection" subtitle="Choose the primary model used by AI execution." />
        <Select value={config.model} onValueChange={(value) => setConfig({ model: value })}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {modelOptions.map((model) => (
              <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.2, delay: reduceMotion ? 0 : 0.07 }}>
      <Card className="settings-surface p-6 border-border/75">
          <SectionHeader title="Behavior / Tone" subtitle="Control how the AI responds." />
        <Select
          value={config.tone}
          onValueChange={(value) => setConfig({ tone: value as typeof config.tone })}
        >
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((tone) => (
              <SelectItem key={tone.id} value={tone.id}>{tone.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.2, delay: reduceMotion ? 0 : 0.09 }}>
      <Card className="settings-surface p-6 border-border/75">
          <SectionHeader title="Memory Settings" subtitle="Define whether AI should use memory context." />
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-muted-foreground" />
            <Label htmlFor="memory-enabled">Memory Enabled</Label>
          </div>
          <Switch
            id="memory-enabled"
            checked={config.memory_enabled}
            onCheckedChange={(checked) => setConfig({ memory_enabled: checked })}
          />
        </div>
      </Card>

      <Card className="settings-surface p-6 border-border/75">
        <SectionHeader title="Capabilities" subtitle="Toggle available AI capabilities by channel." />
        <div className="space-y-3">
          {([
            ['chat', 'Chat'],
            ['voice', 'Voice'],
            ['image', 'Image'],
            ['video', 'Video'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-4">
              <div className="flex items-center gap-2">
                <Robot size={18} className="text-muted-foreground" />
                <Label htmlFor={`cap-${key}`}>{label}</Label>
              </div>
              <Switch
                id={`cap-${key}`}
                checked={config.capabilities[key]}
                onCheckedChange={(checked) =>
                  setConfig({
                    capabilities: {
                      ...config.capabilities,
                      [key]: checked,
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.2, delay: reduceMotion ? 0 : 0.11 }}>
      <Card className="settings-surface p-6 border-border/75">
          <SectionHeader title="Advanced Settings" subtitle="Control generation behavior and token limits." />
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground">{config.temperature.toFixed(2)}</span>
            </div>
            <Slider
              value={[config.temperature]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([value]) => setConfig({ temperature: value })}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="max-tokens">Max Tokens</Label>
            <Input
              id="max-tokens"
              type="number"
              min={256}
              max={8000}
              value={config.max_tokens}
              onChange={(e) => {
                const numeric = Number(e.target.value || 0);
                const safe = Number.isFinite(numeric) ? Math.min(Math.max(numeric, 256), 8000) : 2000;
                setConfig({ max_tokens: safe });
              }}
              className="w-40"
            />
          </div>
        </div>
      </Card>
      </motion.div>

      {/* Accent Lighting */}
      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.2, delay: reduceMotion ? 0 : 0.12 }}>
      <Card className="settings-surface p-6 border-border/75">
        <SectionHeader title="Accent Lighting" subtitle="Choose the accent color that defines your Vuk OS environment." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACCENT_THEMES.map((preset) => {
            const isSelected = preset.id === activeThemeId;
            const previewColor = `oklch(${preset.lightness} ${preset.chroma} ${preset.hue})`;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAccentTheme(preset.id as AccentThemeId)}
                className="relative group rounded-xl border p-3 text-left transition-all"
                style={{
                  borderColor: isSelected ? previewColor : 'var(--border)',
                  background: isSelected ? `oklch(${preset.lightness} ${preset.chroma * 0.15} ${preset.hue} / 0.12)` : 'transparent',
                  boxShadow: isSelected ? `0 0 20px oklch(${preset.lightness} ${preset.chroma} ${preset.hue} / 0.25)` : 'none',
                }}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span
                    className="h-4 w-4 rounded-full shrink-0 border border-white/20"
                    style={{ background: previewColor, boxShadow: `0 0 8px ${previewColor}` }}
                  />
                  <span className="text-sm font-medium truncate">{preset.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {isSelected ? 'Active' : 'Select'}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.2, delay: reduceMotion ? 0 : 0.13 }}>
      <Card className="settings-surface p-6">
        <SectionHeader title="Unified Config Object" subtitle="Prepared payload for the orchestrator." />
        <div className="rounded-md bg-muted p-4 text-xs overflow-x-auto">
          <pre>{JSON.stringify(orchestratorConfig, null, 2)}</pre>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Lightning size={14} />
          This object is ready to feed into AI request execution.
        </div>
      </Card>
      </motion.div>
    </div>
  );
}
