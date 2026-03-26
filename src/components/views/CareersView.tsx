import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/auth-context';
import { useAIControl } from '@/context/ai-control-context';
import { runAI } from '@/services/ai-orchestrator';
import { useCareerWorkspace } from '@/hooks/use-career-workspace';
import { toast } from 'sonner';
import { Briefcase } from '@phosphor-icons/react/Briefcase';
import { FileText } from '@phosphor-icons/react/FileText';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Robot } from '@phosphor-icons/react/Robot';

type CareerMode = 'resume' | 'hunt' | 'agent';

export function CareersView() {
  const { user, getAccessToken } = useAuth();
  const { orchestratorConfig } = useAIControl();
  const {
    workspace,
    loading: workspaceLoading,
    saving: workspaceSaving,
    error: workspaceError,
    saveResumeVersion,
    saveJobTarget,
    deleteResumeVersion,
    deleteJobTarget,
  } = useCareerWorkspace();

  const [mode, setMode] = useState<CareerMode>('resume');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [resumeTitle, setResumeTitle] = useState('');
  const [resumeNotes, setResumeNotes] = useState('');

  const [resumeText, setResumeText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [huntRole, setHuntRole] = useState('');
  const [huntLocation, setHuntLocation] = useState('');
  const [huntLevel, setHuntLevel] = useState('');
  const [huntCompany, setHuntCompany] = useState('');
  const [huntStatus, setHuntStatus] = useState('prospect');
  const [huntPriority, setHuntPriority] = useState('3');
  const [huntUrl, setHuntUrl] = useState('');
  const [huntNotes, setHuntNotes] = useState('');

  const [agentGoal, setAgentGoal] = useState('');

  const sortedResumeVersions = useMemo(
    () => [...workspace.resumeVersions].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
    [workspace.resumeVersions]
  );

  const loadResumeVersion = (resumeId: string) => {
    const item = workspace.resumeVersions.find((resume) => resume.id === resumeId);
    if (!item) return;
    setSelectedResumeId(item.id);
    setResumeTitle(item.title || '');
    setResumeNotes(item.notes || '');
    setTargetRole(item.target_role || '');
    setJobDescription(item.job_description || '');
    setResumeText(item.resume_text || '');
    toast.success('Loaded saved resume version.');
  };

  const loadJobTarget = (targetId: string) => {
    const item = workspace.jobTargets.find((target) => target.id === targetId);
    if (!item) return;
    setSelectedTargetId(item.id);
    setHuntCompany(item.company || '');
    setHuntRole(item.role || '');
    setHuntLocation(item.location || '');
    setHuntLevel(item.seniority || '');
    setHuntStatus(item.status || 'prospect');
    setHuntPriority(String(item.priority || 3));
    setHuntUrl(item.job_url || '');
    setHuntNotes(item.notes || '');
    toast.success('Loaded saved job target.');
  };

  const persistResumeVersion = async (isPrimary = false) => {
    if (!resumeText.trim()) {
      toast.error('Paste a resume before saving a version.');
      return;
    }

    try {
      await saveResumeVersion({
        id: selectedResumeId || undefined,
        title: resumeTitle.trim() || undefined,
        targetRole: targetRole.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        resumeText: resumeText.trim(),
        notes: resumeNotes.trim() || undefined,
        isPrimary,
      });
      toast.success(isPrimary ? 'Primary resume version saved.' : 'Resume version saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save resume version.');
    }
  };

  const persistJobTarget = async () => {
    if (!huntRole.trim()) {
      toast.error('Enter a target role before saving.');
      return;
    }

    try {
      await saveJobTarget({
        id: selectedTargetId || undefined,
        company: huntCompany.trim() || undefined,
        role: huntRole.trim(),
        location: huntLocation.trim() || undefined,
        seniority: huntLevel.trim() || undefined,
        status: huntStatus as 'prospect' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'paused',
        priority: Number(huntPriority) || 3,
        jobUrl: huntUrl.trim() || undefined,
        notes: huntNotes.trim() || undefined,
      });
      toast.success('Job target saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save job target.');
    }
  };

  const runResumeReview = async () => {
    if (!resumeText.trim()) {
      toast.error('Paste a resume first.');
      return;
    }

    setLoading(true);
    try {
      const prompt = `You are an elite career coach and recruiter.

Goal:
- Review and optimize this resume for ${targetRole || 'the target role'}.
- Compare it against the target job description if provided.

Output format:
1) Resume score out of 100 with short rationale
2) Top 10 improvements ordered by impact
3) ATS risks and keyword gaps
4) Rewritten professional summary (ready to paste)
5) 3 rewritten bullet examples using strong achievement language
6) Final 7-day improvement sprint plan

Resume:
${resumeText}

Target job description:
${jobDescription || 'Not provided.'}`;

      const result = await runAI<{ data?: { response?: string }; response?: string }>({
        type: 'chat',
        input: {
          user_id: user?.id || 'anonymous',
          message: prompt,
          conversation_id: `careers-resume-${Date.now()}`,
          model: orchestratorConfig.model,
        },
        config: orchestratorConfig,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Resume review failed.');
      }

      const payload = result.data.data ?? result.data;
      setOutput((payload as { response?: string }).response || 'No response returned.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Resume review failed.');
    } finally {
      setLoading(false);
    }
  };

  const runJobHuntPlan = async () => {
    if (!huntRole.trim()) {
      toast.error('Enter your target role.');
      return;
    }

    setLoading(true);
    try {
      const prompt = `Create a precision job hunt plan.

Candidate target:
- Role: ${huntRole}
- Location: ${huntLocation || 'Flexible / remote'}
- Seniority: ${huntLevel || 'Not specified'}

Output format:
1) Ideal company profile (size, domain, stage)
2) Search query pack (Boolean strings for LinkedIn/Indeed/Google)
3) Weekly execution system with daily KPIs
4) Outreach strategy for recruiters + hiring managers
5) Interview prep track and portfolio proof checklist
6) Common failure points and prevention plan

Make this practical and execution-focused.`;

      const result = await runAI<{ data?: { response?: string }; response?: string }>({
        type: 'chat',
        input: {
          user_id: user?.id || 'anonymous',
          message: prompt,
          conversation_id: `careers-hunt-${Date.now()}`,
          model: orchestratorConfig.model,
        },
        config: orchestratorConfig,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Job hunt planning failed.');
      }

      const payload = result.data.data ?? result.data;
      setOutput((payload as { response?: string }).response || 'No response returned.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Job hunt planning failed.');
    } finally {
      setLoading(false);
    }
  };

  const runAgentMode = async () => {
    if (!agentGoal.trim()) {
      toast.error('Describe your job search objective for agent mode.');
      return;
    }

    setLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch('/.netlify/functions/agent-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agent_type: 'career_agent',
          task: agentGoal.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Unable to start career agent task.');
      }

      setOutput(`Career agent task queued.\n\nTask ID: ${data.data?.task_id || 'n/a'}\nStatus: ${data.data?.status || 'queued'}`);
      toast.success('Career agent task created.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Agent mode failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-panel p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Briefcase size={28} className="text-primary" />
        <div>
          <p className="executive-eyebrow">Career OS</p>
          <h1 className="text-3xl font-bold tracking-tight">Job & Employment Accelerator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI resume optimization, precision job hunt planning, and agent-mode execution support.
          </p>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as CareerMode)}>
        <TabsList className="bg-black/20 border border-border/70">
          <TabsTrigger value="resume" className="gap-1.5"><FileText size={14} /> Resume Review</TabsTrigger>
          <TabsTrigger value="hunt" className="gap-1.5"><MagnifyingGlass size={14} /> Job Hunt</TabsTrigger>
          <TabsTrigger value="agent" className="gap-1.5"><Robot size={14} /> Agent Mode</TabsTrigger>
        </TabsList>
      </Tabs>

      {workspaceError && (
        <Card className="p-4 border-destructive/60">
          <p className="text-sm text-destructive">{workspaceError}</p>
        </Card>
      )}

      {mode === 'resume' && (
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              value={resumeTitle}
              onChange={(e) => setResumeTitle(e.target.value)}
              placeholder="Resume version title (e.g., PM - Fintech v2)"
            />
            <Input
              value={resumeNotes}
              onChange={(e) => setResumeNotes(e.target.value)}
              placeholder="Optional notes for this version"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Target role (e.g., Senior Product Manager)"
            />
            <Input
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Optional: paste key job description points"
            />
          </div>
          <Textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your current resume text here..."
            className="min-h-56"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={runResumeReview} disabled={loading || workspaceSaving}>
              {loading ? 'Reviewing…' : 'Run AI Resume Review'}
            </Button>
            <Button variant="outline" onClick={() => void persistResumeVersion(false)} disabled={workspaceSaving}>
              Save Version
            </Button>
            <Button variant="outline" onClick={() => void persistResumeVersion(true)} disabled={workspaceSaving}>
              Save As Primary
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Saved Resume Versions ({workspace.resumeVersions.length})
            </p>
            {workspaceLoading ? (
              <p className="text-sm text-muted-foreground">Loading saved versions...</p>
            ) : sortedResumeVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved versions yet.</p>
            ) : (
              <div className="space-y-2">
                {sortedResumeVersions.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-md border border-border/70 p-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-left flex-1"
                      onClick={() => loadResumeVersion(item.id)}
                    >
                      <p className="text-sm font-medium">
                        {item.title || item.target_role || 'Untitled resume version'}
                        {item.is_primary ? ' (Primary)' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">Updated {new Date(item.updated_at).toLocaleString()}</p>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void deleteResumeVersion(item.id)}
                      disabled={workspaceSaving}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {mode === 'hunt' && (
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              value={huntCompany}
              onChange={(e) => setHuntCompany(e.target.value)}
              placeholder="Company"
            />
            <Input
              value={huntRole}
              onChange={(e) => setHuntRole(e.target.value)}
              placeholder="Target role"
            />
            <Input
              value={huntLocation}
              onChange={(e) => setHuntLocation(e.target.value)}
              placeholder="Location / Remote"
            />
            <Input
              value={huntLevel}
              onChange={(e) => setHuntLevel(e.target.value)}
              placeholder="Level (e.g., Mid, Senior)"
            />
            <Input
              value={huntUrl}
              onChange={(e) => setHuntUrl(e.target.value)}
              placeholder="Job posting URL (optional)"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm text-muted-foreground">
              Status
              <select
                value={huntStatus}
                onChange={(e) => setHuntStatus(e.target.value)}
                className="mt-1 w-full bg-background border border-border rounded-md h-10 px-3"
              >
                <option value="prospect">Prospect</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
                <option value="paused">Paused</option>
              </select>
            </label>
            <Input
              value={huntPriority}
              onChange={(e) => setHuntPriority(e.target.value)}
              placeholder="Priority (1-5)"
            />
          </div>
          <Textarea
            value={huntNotes}
            onChange={(e) => setHuntNotes(e.target.value)}
            placeholder="Notes for this target (optional)"
            className="min-h-28"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={runJobHuntPlan} disabled={loading || workspaceSaving}>
              {loading ? 'Planning…' : 'Generate Job Hunt Blueprint'}
            </Button>
            <Button variant="outline" onClick={() => void persistJobTarget()} disabled={workspaceSaving}>
              Save Job Target
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Saved Job Targets ({workspace.jobTargets.length})
            </p>
            {workspaceLoading ? (
              <p className="text-sm text-muted-foreground">Loading saved targets...</p>
            ) : workspace.jobTargets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved targets yet.</p>
            ) : (
              <div className="space-y-2">
                {workspace.jobTargets.slice(0, 10).map((target) => (
                  <div key={target.id} className="rounded-md border border-border/70 p-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-left flex-1"
                      onClick={() => loadJobTarget(target.id)}
                    >
                      <p className="text-sm font-medium">
                        {(target.company ? `${target.company} - ` : '') + target.role}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {target.status} | priority {target.priority} | updated {new Date(target.updated_at).toLocaleDateString()}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void deleteJobTarget(target.id)}
                      disabled={workspaceSaving}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {mode === 'agent' && (
        <Card className="p-5 space-y-4">
          <Textarea
            value={agentGoal}
            onChange={(e) => setAgentGoal(e.target.value)}
            placeholder="Describe the mission for agent mode (e.g., build a 30-day search plan, identify company targets, and draft outreach scripts)."
            className="min-h-40"
          />
          <Button onClick={runAgentMode} disabled={loading}>
            {loading ? 'Launching…' : 'Launch Career Agent Task'}
          </Button>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm font-semibold mb-2">Output</p>
        <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{output || 'Run a mode to generate output.'}</pre>
      </Card>
    </div>
  );
}