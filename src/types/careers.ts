export type CareerTargetStatus =
  | 'prospect'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'paused';

export interface ResumeVersion {
  id: string;
  title: string | null;
  target_role: string | null;
  job_description: string | null;
  resume_text: string;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobTarget {
  id: string;
  company: string | null;
  role: string;
  location: string | null;
  seniority: string | null;
  job_url: string | null;
  status: CareerTargetStatus;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareerWorkspace {
  resumeVersions: ResumeVersion[];
  jobTargets: JobTarget[];
}
