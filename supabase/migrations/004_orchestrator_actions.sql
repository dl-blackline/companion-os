-- Orchestrator Actions
-- Migration: 004_orchestrator_actions.sql

-- ORCHESTRATOR ACTIONS
-- Stores every orchestration action for auditing and debugging.
create table if not exists orchestrator_actions (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  input text,
  output text,
  created_at timestamp with time zone default now()
);

-- INDEXES
create index if not exists orchestrator_actions_type_idx
  on orchestrator_actions (action_type);

create index if not exists orchestrator_actions_created_at_idx
  on orchestrator_actions (created_at);
