-- Storyboard history via conversations (media_type = 'storyboard')
-- Run in Supabase SQL Editor after prior migrations.

-- Extend media_type to include storyboard
alter table public.conversations
  drop constraint if exists conversations_media_type_check;

alter table public.conversations
  add constraint conversations_media_type_check
  check (media_type in ('image', 'video', 'storyboard'));

-- Per-scene rows (frames + metadata)
create table if not exists public.storyboard_scenes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scene_number int not null,
  duration_sec int not null default 5,
  voiceover text not null default '',
  visual_description text not null default '',
  camera_direction text not null default '',
  camera_angle text not null default '',
  camera_movement text not null default '',
  character_actions text not null default '',
  environment text not null default '',
  emotion text not null default 'neutral',
  transition text not null default 'cut',
  image_prompt text not null default '',
  frame_storage_path text,
  frame_status text not null default 'pending'
    check (frame_status in ('pending', 'generating', 'complete', 'error')),
  frame_error text,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, scene_number)
);

create index if not exists storyboard_scenes_conversation_idx
  on public.storyboard_scenes (conversation_id, sort_index);

-- Project outputs (videos, continuity, settings snapshot)
create table if not exists public.storyboard_outputs (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  continuity jsonb,
  settings jsonb not null default '{}'::jsonb,
  single_video_storage_path text,
  stitched_video_storage_path text,
  single_video_duration_sec int,
  stitched_video_duration_sec int,
  wizard_locked boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists storyboard_scenes_updated_at on public.storyboard_scenes;
create trigger storyboard_scenes_updated_at
  before update on public.storyboard_scenes
  for each row execute function public.set_updated_at();

drop trigger if exists storyboard_outputs_updated_at on public.storyboard_outputs;
create trigger storyboard_outputs_updated_at
  before update on public.storyboard_outputs
  for each row execute function public.set_updated_at();

-- RLS
alter table public.storyboard_scenes enable row level security;
alter table public.storyboard_outputs enable row level security;

drop policy if exists storyboard_scenes_select on public.storyboard_scenes;
create policy storyboard_scenes_select on public.storyboard_scenes
  for select using (auth.uid() = user_id);

drop policy if exists storyboard_scenes_insert on public.storyboard_scenes;
create policy storyboard_scenes_insert on public.storyboard_scenes
  for insert with check (auth.uid() = user_id);

drop policy if exists storyboard_scenes_update on public.storyboard_scenes;
create policy storyboard_scenes_update on public.storyboard_scenes
  for update using (auth.uid() = user_id);

drop policy if exists storyboard_scenes_delete on public.storyboard_scenes;
create policy storyboard_scenes_delete on public.storyboard_scenes
  for delete using (auth.uid() = user_id);

drop policy if exists storyboard_outputs_select on public.storyboard_outputs;
create policy storyboard_outputs_select on public.storyboard_outputs
  for select using (auth.uid() = user_id);

drop policy if exists storyboard_outputs_insert on public.storyboard_outputs;
create policy storyboard_outputs_insert on public.storyboard_outputs
  for insert with check (auth.uid() = user_id);

drop policy if exists storyboard_outputs_update on public.storyboard_outputs;
create policy storyboard_outputs_update on public.storyboard_outputs
  for update using (auth.uid() = user_id);

drop policy if exists storyboard_outputs_delete on public.storyboard_outputs;
create policy storyboard_outputs_delete on public.storyboard_outputs
  for delete using (auth.uid() = user_id);
