-- Append new layout batches per conversation instead of replacing prior images.
-- Run in Supabase SQL Editor after 001_conversations_and_storage.sql

alter table public.layout_variants
  add column if not exists generation_round integer not null default 0;

create index if not exists layout_variants_round_idx
  on public.layout_variants (conversation_id, generation_round, sort_index);
