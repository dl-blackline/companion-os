-- Media message support
-- Migration: 009_media_messages.sql

-- Add media fields to messages table
alter table messages add column if not exists media_url text;
alter table messages add column if not exists media_type text check (media_type in ('image', 'video'));

-- Index for finding media messages
create index if not exists messages_media_type_idx
  on messages (media_type)
  where media_type is not null;
