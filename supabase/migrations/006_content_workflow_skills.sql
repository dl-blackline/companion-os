-- Content Workflows and Skill Engine
-- Migration: 006_content_workflow_skills.sql

-- MESSAGES (short-term memory)
-- Core conversation messages table referenced by the memory system.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  user_id text not null,
  role text not null,
  content text not null,
  embedding vector(1536),
  created_at timestamp with time zone default now()
);

create index if not exists messages_conversation_id_idx
  on messages (conversation_id);

create index if not exists messages_user_id_idx
  on messages (user_id);

-- CONTENT PROJECTS
-- Top-level container for multi-step content production workflows.
create table if not exists content_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  description text default '',
  project_type text not null default 'general',
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'failed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists content_projects_user_id_idx
  on content_projects (user_id);

create index if not exists content_projects_status_idx
  on content_projects (status);

-- CONTENT ASSETS
-- Media and text assets produced by workflow steps.
create table if not exists content_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references content_projects(id) on delete cascade,
  step_id uuid,
  asset_type text not null,
  url text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists content_assets_project_id_idx
  on content_assets (project_id);

-- WORKFLOW STEPS
-- Individual ordered steps within a content project workflow.
create table if not exists workflow_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references content_projects(id) on delete cascade,
  step_order int not null,
  step_type text not null,
  config jsonb default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists workflow_steps_project_id_idx
  on workflow_steps (project_id);

-- AUTONOMOUS AGENTS
-- Registry of autonomous background agent definitions.
create table if not exists autonomous_agents (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null unique,
  description text not null,
  enabled boolean default true,
  config jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists autonomous_agents_type_idx
  on autonomous_agents (agent_type);

-- SKILLS
-- Tracked user skills and proficiency levels.
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  category text default 'general',
  proficiency float default 0 check (proficiency >= 0 and proficiency <= 1),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (user_id, name)
);

create index if not exists skills_user_id_idx
  on skills (user_id);

-- SKILL USAGE
-- Records each time a skill is exercised.
create table if not exists skill_usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  skill_name text not null,
  context text default '',
  created_at timestamp with time zone default now()
);

create index if not exists skill_usage_user_id_idx
  on skill_usage (user_id);

-- SKILL SUGGESTIONS
-- AI-generated skill improvement or learning suggestions.
create table if not exists skill_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  skill_name text not null,
  reason text not null,
  priority text default 'medium' check (priority in ('high', 'medium', 'low')),
  dismissed boolean default false,
  created_at timestamp with time zone default now()
);

create index if not exists skill_suggestions_user_id_idx
  on skill_suggestions (user_id);
