-- Hierarchical Memory Architecture
-- Migration: 001_hierarchical_memory.sql

-- Required extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- SHORT-TERM MEMORY (messages table already exists, ensure schema matches)
-- The existing "messages" table stores conversation messages:
--   id, conversation_id, user_id, role, content, embedding vector(1536), created_at

-- EPISODIC MEMORY
-- Stores important events in the user's life or work.
create table if not exists episodic_memory (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  event text not null,
  embedding vector(1536),
  importance_score float default 0.5,
  created_at timestamp with time zone default now()
);

-- RELATIONSHIP MEMORY
-- Stores meaningful insights about the user.
create table if not exists relationship_memory (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  memory text not null,
  embedding vector(1536),
  importance_score float default 0.5,
  created_at timestamp with time zone default now()
);

-- MEMORY SUMMARIES
-- Stores compressed long-term memory summaries.
create table if not exists memory_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  summary text not null,
  embedding vector(1536),
  source_conversation_id text,
  created_at timestamp with time zone default now()
);

-- USER PROFILES
-- Stores structured user information.
create table if not exists user_profiles (
  user_id text primary key,
  name text,
  preferences jsonb default '{}'::jsonb,
  goals jsonb default '[]'::jsonb,
  interests jsonb default '[]'::jsonb,
  personality_traits jsonb default '[]'::jsonb,
  communication_style text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- KNOWLEDGE GRAPH MEMORY
-- Stores structured knowledge extracted from conversations.
create table if not exists knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  entity text not null,
  entity_type text not null,
  created_at timestamp default now()
);

create table if not exists knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_entity text not null,
  target_entity text not null,
  relationship text not null,
  created_at timestamp default now()
);

-- VECTOR INDEXES
create index if not exists messages_embedding_index
  on messages
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists episodic_embedding_index
  on episodic_memory
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists relationship_embedding_index
  on relationship_memory
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists memory_summaries_embedding_index
  on memory_summaries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC FUNCTIONS FOR VECTOR SEARCH

-- Search episodic memory by embedding similarity
create or replace function match_episodic_memory(
  query_embedding vector(1536),
  match_count int default 5,
  filter_user_id text default null
)
returns table (
  id uuid,
  user_id text,
  event text,
  importance_score float,
  similarity float,
  created_at timestamp with time zone
)
language plpgsql
as $$
begin
  return query
  select
    em.id,
    em.user_id,
    em.event,
    em.importance_score,
    1 - (em.embedding <=> query_embedding) as similarity,
    em.created_at
  from episodic_memory em
  where (filter_user_id is null or em.user_id = filter_user_id)
  order by em.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Search relationship memory by embedding similarity
create or replace function match_relationship_memory(
  query_embedding vector(1536),
  match_count int default 5,
  filter_user_id text default null
)
returns table (
  id uuid,
  user_id text,
  memory text,
  importance_score float,
  similarity float,
  created_at timestamp with time zone
)
language plpgsql
as $$
begin
  return query
  select
    rm.id,
    rm.user_id,
    rm.memory,
    rm.importance_score,
    1 - (rm.embedding <=> query_embedding) as similarity,
    rm.created_at
  from relationship_memory rm
  where (filter_user_id is null or rm.user_id = filter_user_id)
  order by rm.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Search memory summaries by embedding similarity
create or replace function match_memory_summaries(
  query_embedding vector(1536),
  match_count int default 5,
  filter_user_id text default null
)
returns table (
  id uuid,
  user_id text,
  summary text,
  source_conversation_id text,
  similarity float,
  created_at timestamp with time zone
)
language plpgsql
as $$
begin
  return query
  select
    ms.id,
    ms.user_id,
    ms.summary,
    ms.source_conversation_id,
    1 - (ms.embedding <=> query_embedding) as similarity,
    ms.created_at
  from memory_summaries ms
  where (filter_user_id is null or ms.user_id = filter_user_id)
  order by ms.embedding <=> query_embedding
  limit match_count;
end;
$$;
