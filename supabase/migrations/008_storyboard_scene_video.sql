-- Per-scene animated clips (independent of stitched storyboard video)
alter table public.storyboard_scenes
  add column if not exists scene_video_storage_path text,
  add column if not exists scene_video_duration_sec int,
  add column if not exists scene_video_status text
    check (scene_video_status in ('pending', 'generating', 'complete', 'error')),
  add column if not exists scene_video_error text,
  add column if not exists scene_video_model text;
