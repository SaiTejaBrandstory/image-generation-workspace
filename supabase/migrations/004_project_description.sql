-- Optional project description (for create-project modal)
alter table public.projects
  add column if not exists description text;
