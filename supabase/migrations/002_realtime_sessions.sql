-- Real-Time Session Engine
-- Migration: 002_realtime_sessions.sql

-- REALTIME SESSIONS
-- Tracks active and completed real-time sessions.
create table if not exists realtime_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_type text not null check (session_type in ('voice_call', 'live_assistant', 'creative_session', 'screen_assist')),
  status text not null default 'active' check (status in ('active', 'completed', 'error')),
  metadata jsonb default '{}'::jsonb,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- REALTIME EVENTS
-- Stores streaming events for each session.
create table if not exists realtime_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references realtime_sessions(id) on delete cascade,
  event_type text not null check (event_type in ('transcription', 'assistant_response', 'voice_output', 'media_generation_progress')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- INDEXES
create index if not exists realtime_sessions_user_id_idx
  on realtime_sessions (user_id);

create index if not exists realtime_sessions_status_idx
  on realtime_sessions (status);

create index if not exists realtime_events_session_id_idx
  on realtime_events (session_id);

create index if not exists realtime_events_event_type_idx
  on realtime_events (event_type);
