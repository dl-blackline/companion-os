import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sliders, Robot, Brain, Lightning, FloppyDisk, ArrowsClockwise } from '@phosphor-icons/react';
import { useAIControl } from '@/context/ai-control-context';

const MODEL_OPTIONS = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
];

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

  return (
    <div className="settings-panel p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Sliders size={26} className="text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">AI Control Center</h1>
        </div>
        <p className="text-muted-foreground">
          Unified control for model, behavior, memory, capabilities, and advanced runtime parameters.
        </p>
      </div>

      <Card className="p-6">
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

      <Card className="p-6">
        <SectionHeader title="Model Selection" subtitle="Choose the primary model used by AI execution." />
        <Select value={config.model} onValueChange={(value) => setConfig({ model: value })}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((model) => (
              <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-6">
        <SectionHeader title="Behavior / Tone" subtitle="Control how the companion responds." />
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

      <Card className="p-6">
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

      <Card className="p-6">
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

      <Card className="p-6">
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

      <Card className="p-6">
        <SectionHeader title="Unified Config Object" subtitle="Prepared payload for the orchestrator." />
        <div className="rounded-md bg-muted p-4 text-xs overflow-x-auto">
          <pre>{JSON.stringify(orchestratorConfig, null, 2)}</pre>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Lightning size={14} />
          This object is ready to feed into AI request execution.
        </div>
      </Card>
    </div>
  );
}
