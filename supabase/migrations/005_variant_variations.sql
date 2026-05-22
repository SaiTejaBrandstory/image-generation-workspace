-- Variations: child images tied to a parent layout variant
-- Run after 002_generation_rounds.sql

alter table public.layout_variants
  add column if not exists parent_variant_id uuid references public.layout_variants (id) on delete cascade,
  add column if not exists variant_kind text not null default 'layout'
    check (variant_kind in ('layout', 'variation')),
  add column if not exists variation_index int;

create index if not exists layout_variants_parent_idx
  on public.layout_variants (parent_variant_id, variation_index)
  where parent_variant_id is not null;
