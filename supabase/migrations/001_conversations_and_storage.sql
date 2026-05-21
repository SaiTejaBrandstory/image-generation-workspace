-- Run in Supabase SQL Editor (Dashboard → SQL) for project yeavejohvunhjwxqxxtb

-- Conversations (generation runs / history)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New generation',
  prompt text,
  style text,
  platform text,
  aspect_ratio text,
  image_model text,
  params jsonb not null default '{}'::jsonb,
  selected_layouts jsonb not null default '[]'::jsonb,
  starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_idx on public.conversations (user_id);
create index if not exists conversations_updated_at_idx on public.conversations (user_id, updated_at desc);

-- Chat messages per conversation
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  reference_ids jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx on public.chat_messages (conversation_id, position);

-- Layout variants (one row per layout image)
create table if not exists public.layout_variants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  layout_id text not null,
  user_prompt text,
  prompt text,
  storage_path text,
  rationale text,
  visual_psychology text,
  best_use text,
  suggested_platform text,
  principles jsonb not null default '[]'::jsonb,
  influence_breakdown jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'generating', 'complete', 'error')
  ),
  error_message text,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists layout_variants_conversation_idx on public.layout_variants (conversation_id, sort_index);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists layout_variants_updated_at on public.layout_variants;
create trigger layout_variants_updated_at
  before update on public.layout_variants
  for each row execute function public.set_updated_at();

-- RLS
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.layout_variants enable row level security;

create policy "Users read own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users insert own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users update own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users delete own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

create policy "Users read own messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Users insert own messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

create policy "Users delete own messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

create policy "Users read own variants"
  on public.layout_variants for select
  using (auth.uid() = user_id);

create policy "Users insert own variants"
  on public.layout_variants for insert
  with check (auth.uid() = user_id);

create policy "Users update own variants"
  on public.layout_variants for update
  using (auth.uid() = user_id);

create policy "Users delete own variants"
  on public.layout_variants for delete
  using (auth.uid() = user_id);

-- Storage bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generations',
  'generations',
  false,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Storage policies: path = {user_id}/{conversation_id}/{variant_id}.ext
create policy "Users upload own generation images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'generations'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "Users read own generation images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'generations'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "Users update own generation images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'generations'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "Users delete own generation images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'generations'
    and (storage.foldername (name))[1] = auth.uid()::text
  );
