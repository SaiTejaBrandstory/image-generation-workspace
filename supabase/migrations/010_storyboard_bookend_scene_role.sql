-- Optional role for opening/closing ease-in/out bookend frames
alter table public.storyboard_scenes
  add column if not exists scene_role text
  check (scene_role is null or scene_role in ('bookend-open', 'bookend-close'));
