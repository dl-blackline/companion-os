-- Migration: Companion Brain — unified memory layer
--
-- Adds:
--   brain_memory          — unified short-term + long-term memory table
--   match_brain_memory()  — vector similarity search function

-- ─── brain_memory table ────────────────────────────────────────────────────

create table if not exists brain_memory (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  session_id    uuid,                             -- null for long-term entries
  memory_type   text not null check (memory_type in ('short_term', 'long_term')),
  role          text,                             -- 'user' | 'assistant' | null
  category      text default 'fact',              -- fact | instruction | preference | episodic | relationship | etc.
  content       text not null,
  embedding     vector(1536),
  importance    real default 0.5,
  metadata      jsonb default '{}',
  expires_at    timestamptz,                      -- optional TTL for short-term memories
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Indexes
create index if not exists idx_brain_memory_user      on brain_memory (user_id);
create index if not exists idx_brain_memory_session    on brain_memory (session_id) where session_id is not null;
create index if not exists idx_brain_memory_type       on brain_memory (memory_type);
create index if not exists idx_brain_memory_embedding  on brain_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ─── Vector search function ────────────────────────────────────────────────

create or replace function match_brain_memory(
  query_embedding  vector(1536),
  match_count      int default 10,
  filter_user_id   uuid default null,
  filter_type      text default null
)
returns table (
  id          uuid,
  user_id     uuid,
  session_id  uuid,
  memory_type text,
  role        text,
  category    text,
  content     text,
  importance  real,
  metadata    jsonb,
  similarity  float
)
language plpgsql
as $$
begin
  return query
    select
      bm.id,
      bm.user_id,
      bm.session_id,
      bm.memory_type,
      bm.role,
      bm.category,
      bm.content,
      bm.importance,
      bm.metadata,
      1 - (bm.embedding <=> query_embedding) as similarity
    from brain_memory bm
    where
      (filter_user_id is null or bm.user_id = filter_user_id)
      and (filter_type is null or bm.memory_type = filter_type)
      and (bm.expires_at is null or bm.expires_at > now())
    order by bm.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- ─── RLS policies ──────────────────────────────────────────────────────────

alter table brain_memory enable row level security;

drop policy if exists "Users can read own brain_memory" on brain_memory;
drop policy if exists "Users can insert own brain_memory" on brain_memory;
drop policy if exists "Users can update own brain_memory" on brain_memory;
drop policy if exists "Users can delete own brain_memory" on brain_memory;

create policy "Users can read own brain_memory"
  on brain_memory for select
  using (auth.uid() = user_id);

create policy "Users can insert own brain_memory"
  on brain_memory for insert
  with check (auth.uid() = user_id);

create policy "Users can update own brain_memory"
  on brain_memory for update
  using (auth.uid() = user_id);

create policy "Users can delete own brain_memory"
  on brain_memory for delete
  using (auth.uid() = user_id);
