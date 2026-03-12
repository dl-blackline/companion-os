-- Background Job Queue
-- Migration: 007_job_queue.sql

create table if not exists job_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists job_queue_status_idx
  on job_queue (status);

create index if not exists job_queue_job_type_idx
  on job_queue (job_type);

create index if not exists job_queue_created_at_idx
  on job_queue (created_at);
