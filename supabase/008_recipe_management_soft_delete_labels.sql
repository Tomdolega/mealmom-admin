-- Recipe management foundation: soft delete + labels + indexes + RLS

alter table public.recipes
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_labels (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, label_id)
);

create index if not exists recipes_deleted_at_idx on public.recipes(deleted_at);
create index if not exists recipes_updated_at_idx on public.recipes(updated_at desc);
create index if not exists recipes_status_idx on public.recipes(status);
create index if not exists recipe_labels_recipe_id_idx on public.recipe_labels(recipe_id);
create index if not exists recipe_labels_label_id_idx on public.recipe_labels(label_id);
create index if not exists labels_name_idx on public.labels(name);

alter table public.labels enable row level security;
alter table public.recipe_labels enable row level security;

drop policy if exists "labels authenticated can read" on public.labels;
create policy "labels authenticated can read"
on public.labels
for select
to authenticated
using (true);

drop policy if exists "labels admin and editor can manage" on public.labels;
create policy "labels admin and editor can manage"
on public.labels
for all
to authenticated
using (app.current_user_role() in ('admin', 'editor'))
with check (app.current_user_role() in ('admin', 'editor'));

drop policy if exists "recipe_labels authenticated can read" on public.recipe_labels;
create policy "recipe_labels authenticated can read"
on public.recipe_labels
for select
to authenticated
using (true);

drop policy if exists "recipe_labels admin manage all" on public.recipe_labels;
create policy "recipe_labels admin manage all"
on public.recipe_labels
for all
to authenticated
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

drop policy if exists "recipe_labels editor manage own recipes" on public.recipe_labels;
create policy "recipe_labels editor manage own recipes"
on public.recipe_labels
for all
to authenticated
using (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_labels.recipe_id
      and r.created_by = auth.uid()
  )
)
with check (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_labels.recipe_id
      and r.created_by = auth.uid()
  )
);

-- Ensure public feed excludes trashed recipes immediately.
drop policy if exists "recipes anon can read published only" on public.recipes;
create policy "recipes anon can read published only"
on public.recipes
for select
to anon
using (status = 'published' and deleted_at is null);
