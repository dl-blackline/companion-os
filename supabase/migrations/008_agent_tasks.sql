-- Agent Tasks
-- Migration: 008_agent_tasks.sql
-- Stores tasks dispatched to background AI agents.

create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null,
  task_description text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  created_at timestamp with time zone default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

create index if not exists agent_tasks_status_idx
  on agent_tasks (status);

create index if not exists agent_tasks_agent_type_idx
  on agent_tasks (agent_type);

create index if not exists agent_tasks_created_at_idx
  on agent_tasks (created_at);
