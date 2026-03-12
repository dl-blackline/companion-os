-- Personality and Relationship Intelligence Layer
-- Migration: 005_personality_relationship.sql

-- PERSONALITY PROFILES
-- Stores personality configuration for each user's companion.
create table if not exists personality_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  tone text default 'balanced',
  verbosity text default 'moderate',
  communication_style text default 'conversational',
  response_structure text default 'flexible',
  custom_traits jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists personality_profiles_user_idx
  on personality_profiles (user_id);

-- EMOTIONAL SIGNALS
-- Stores detected emotional signals from user messages.
create table if not exists emotional_signals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id text,
  signal text not null,
  intensity float default 0.5,
  source_message text,
  created_at timestamp with time zone default now()
);

create index if not exists emotional_signals_user_idx
  on emotional_signals (user_id);

create index if not exists emotional_signals_created_at_idx
  on emotional_signals (created_at);

-- RELATIONSHIP EVENTS
-- Stores key relationship events and milestones.
create table if not exists relationship_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  event_type text not null,
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists relationship_events_user_idx
  on relationship_events (user_id);

create index if not exists relationship_events_type_idx
  on relationship_events (event_type);

create index if not exists relationship_events_created_at_idx
  on relationship_events (created_at);
