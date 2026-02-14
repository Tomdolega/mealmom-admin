-- Ensure tags tables exist for environments that missed earlier migrations.

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_pl text not null,
  name_en text,
  type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_tags (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, tag_id)
);

alter table public.recipes
  add column if not exists translation_group_id uuid default gen_random_uuid();

create index if not exists tags_slug_idx on public.tags(slug);
create index if not exists tags_name_pl_idx on public.tags(name_pl);
create index if not exists recipe_tags_recipe_idx on public.recipe_tags(recipe_id);
create index if not exists recipe_tags_tag_idx on public.recipe_tags(tag_id);
create index if not exists recipes_translation_group_idx on public.recipes(translation_group_id);

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
before update on public.tags
for each row
execute function public.set_updated_at();

alter table public.tags enable row level security;
alter table public.recipe_tags enable row level security;

drop policy if exists "tags authenticated read" on public.tags;
create policy "tags authenticated read"
on public.tags
for select
to authenticated
using (true);

drop policy if exists "tags admin_editor write" on public.tags;
create policy "tags admin_editor write"
on public.tags
for all
to authenticated
using (app.current_user_role() in ('admin','editor'))
with check (app.current_user_role() in ('admin','editor'));

drop policy if exists "recipe_tags authenticated read" on public.recipe_tags;
create policy "recipe_tags authenticated read"
on public.recipe_tags
for select
to authenticated
using (true);

drop policy if exists "recipe_tags admin write" on public.recipe_tags;
create policy "recipe_tags admin write"
on public.recipe_tags
for all
to authenticated
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

drop policy if exists "recipe_tags editor own recipes" on public.recipe_tags;
create policy "recipe_tags editor own recipes"
on public.recipe_tags
for all
to authenticated
using (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_tags.recipe_id
      and r.created_by = auth.uid()
  )
)
with check (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_tags.recipe_id
      and r.created_by = auth.uid()
  )
);
