-- Image vs video generations
alter table public.conversations
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video'));

alter table public.conversations
  add column if not exists video_model text;

alter table public.layout_variants
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video'));

alter table public.layout_variants
  add column if not exists video_meta jsonb;

-- Allow MP4 in generations bucket
update storage.buckets
set allowed_mime_types = array[
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm'
]
where id = 'generations';
