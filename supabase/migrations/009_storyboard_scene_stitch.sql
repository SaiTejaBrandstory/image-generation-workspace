-- Stitched output from scene animation clips (separate from storyboard single video)
alter table public.storyboard_outputs
  add column if not exists scene_stitched_video_storage_path text,
  add column if not exists scene_stitched_video_duration_sec int;
