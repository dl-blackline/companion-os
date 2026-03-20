-- Core Companion Engine
-- Migration: 013_companion_engine.sql
--
-- Adds structured tables for the Unified User Model, Initiative Layer,
-- and Interaction Log that power the Core Companion Engine.

-- ─── USER GOALS ───────────────────────────────────────────────────────────────
-- Stores structured goals across life domains (business, health, personal, etc.).
-- Each goal belongs to a single user and carries domain + status metadata.
create table if not exists user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  domain text not null default 'personal',       -- business | health | personal | financial | education | creative
  title text not null,
  description text,
  status text not null default 'active',          -- active | completed | paused | archived
  priority text not null default 'medium',        -- low | medium | high | critical
  target_date timestamp with time zone,
  progress float default 0,                       -- 0.0 – 1.0
  milestones jsonb default '[]'::jsonb,           -- [{title, completed, completedAt}]
  metadata jsonb default '{}'::jsonb,             -- flexible extra data
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists user_goals_user_idx on user_goals (user_id);
create index if not exists user_goals_domain_idx on user_goals (user_id, domain);
create index if not exists user_goals_status_idx on user_goals (user_id, status);

-- ─── USER CONSTRAINTS ────────────────────────────────────────────────────────
-- Stores constraints and boundaries the user has communicated (budget limits,
-- time availability, dietary restrictions, etc.).
create table if not exists user_constraints (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  domain text not null default 'general',         -- general | financial | time | health | dietary | work
  label text not null,
  value text not null,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists user_constraints_user_idx on user_constraints (user_id);
create index if not exists user_constraints_active_idx on user_constraints (user_id, is_active);

-- ─── COMPANION INITIATIVES ───────────────────────────────────────────────────
-- Stores proactive suggestions the companion generates (daily plans, reminders,
-- optimisations, follow-ups). Each initiative tracks whether it was dismissed,
-- accepted, or still pending.
create table if not exists companion_initiatives (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null default 'suggestion',        -- suggestion | reminder | daily_plan | follow_up | optimisation
  title text not null,
  body text,
  priority text not null default 'medium',
  status text not null default 'pending',         -- pending | accepted | dismissed | completed | expired
  related_goal_id uuid references user_goals(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  scheduled_for timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists companion_initiatives_user_idx on companion_initiatives (user_id);
create index if not exists companion_initiatives_status_idx on companion_initiatives (user_id, status);
create index if not exists companion_initiatives_scheduled_idx on companion_initiatives (scheduled_for)
  where scheduled_for is not null;

-- ─── INTERACTION LOG ─────────────────────────────────────────────────────────
-- A cross-module interaction log that every part of the system can write to
-- so the memory layer has a single source of truth for what happened.
create table if not exists interaction_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  module text not null,                           -- chat | crm | email | roleplay | planning | media | companion_engine
  action text not null,                           -- e.g. 'sent_email', 'completed_goal', 'created_reminder'
  summary text,
  outcome text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists interaction_log_user_idx on interaction_log (user_id);
create index if not exists interaction_log_module_idx on interaction_log (user_id, module);
create index if not exists interaction_log_created_idx on interaction_log (created_at);
