import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import {
  loadAIControlConfig,
  saveAIControlConfig,
} from '@/services/ai-control-center-service';
import {
  DEFAULT_AI_CONTROL_CONFIG,
  type AIControlConfig,
} from '@/types/ai-control';

interface AIControlContextType {
  config: AIControlConfig;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setConfig: (patch: Partial<AIControlConfig>) => void;
  saveConfig: () => Promise<void>;
  reloadConfig: () => Promise<void>;
  orchestratorConfig: AIControlConfig;
}

const AIControlContext = createContext<AIControlContextType | undefined>(undefined);

function scheduleIdleTask(task: () => void): () => void {
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(task, { timeout: 1200 });
    return () => cancelIdleCallback(id);
  }

  const timeoutId = setTimeout(task, 180);
  return () => clearTimeout(timeoutId);
}

function mergeConfig(prev: AIControlConfig, patch: Partial<AIControlConfig>): AIControlConfig {
  return {
    ...prev,
    ...patch,
    capabilities: {
      ...prev.capabilities,
      ...(patch.capabilities || {}),
    },
  };
}

export function AIControlProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [config, setConfigState] = useState<AIControlConfig>(DEFAULT_AI_CONTROL_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadConfig = async () => {
    if (!user?.id) {
      setConfigState(DEFAULT_AI_CONTROL_CONFIG);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loaded = await loadAIControlConfig(user.id);
      setConfigState(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load AI Control Center settings';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cancelScheduledReload = scheduleIdleTask(() => {
      reloadConfig();
    });

    return () => {
      cancelScheduledReload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setConfig = (patch: Partial<AIControlConfig>) => {
    setConfigState((prev) => mergeConfig(prev, patch));
  };

  const saveConfig = async () => {
    if (!user?.id) {
      setError('Not authenticated');
      toast.error('Not authenticated');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveAIControlConfig(user.id, config);
      toast.success('Saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save AI Control Center settings';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const orchestratorConfig = useMemo(() => config, [config]);

  return (
    <AIControlContext.Provider
      value={{
        config,
        loading,
        saving,
        error,
        setConfig,
        saveConfig,
        reloadConfig,
        orchestratorConfig,
      }}
    >
      {children}
    </AIControlContext.Provider>
  );
}

export function useAIControl() {
  const ctx = useContext(AIControlContext);
  if (!ctx) {
    throw new Error('useAIControl must be used within AIControlProvider');
  }
  return ctx;
}
