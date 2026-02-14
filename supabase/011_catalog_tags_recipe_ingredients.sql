-- Local catalog + relational recipe ingredients/tags for guided recipe editor

create extension if not exists pg_trgm;

alter table public.recipes
  add column if not exists description_short text,
  add column if not exists description_full text,
  add column if not exists nutrition_total jsonb not null default '{}'::jsonb,
  add column if not exists nutrition_per_serving jsonb not null default '{}'::jsonb,
  add column if not exists total_time_min int,
  add column if not exists deleted_at timestamptz,
  add column if not exists image_urls text[] not null default '{}';

update public.recipes
set
  description_short = coalesce(description_short, description),
  description_full = coalesce(description_full, description),
  total_time_min = coalesce(total_time_min, total_minutes)
where description_short is null
   or description_full is null
   or total_time_min is null;

create table if not exists public.food_products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  barcode text,
  name_pl text not null,
  name_en text,
  brand text,
  categories text[] default '{}',
  nutriments jsonb not null default '{}'::jsonb,
  kcal_100g numeric,
  protein_100g numeric,
  fat_100g numeric,
  carbs_100g numeric,
  sugar_100g numeric,
  fiber_100g numeric,
  salt_100g numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists food_products_barcode_idx on public.food_products(barcode);
create index if not exists food_products_name_brand_trgm_idx
  on public.food_products
  using gin ((coalesce(name_pl, '') || ' ' || coalesce(brand, '')) gin_trgm_ops);
create index if not exists food_products_name_fts_idx
  on public.food_products
  using gin (to_tsvector('simple', coalesce(name_pl, '') || ' ' || coalesce(brand, '')));

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_pl text not null,
  name_en text,
  type text not null default 'custom',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tags_type_idx on public.tags(type);
create index if not exists tags_name_pl_trgm_idx on public.tags using gin (name_pl gin_trgm_ops);

create table if not exists public.recipe_tags (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, tag_id)
);

create index if not exists recipe_tags_tag_id_idx on public.recipe_tags(tag_id);
create index if not exists recipe_tags_recipe_id_idx on public.recipe_tags(recipe_id);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  display_name text not null,
  product_id uuid references public.food_products(id) on delete set null,
  qty numeric not null,
  unit text not null,
  note text,
  sort_order int not null default 0,
  substitutions jsonb not null default '[]'::jsonb,
  computed jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);
create index if not exists recipe_ingredients_product_id_idx on public.recipe_ingredients(product_id);

create table if not exists public.off_seed_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running','done','error')),
  locale text not null default 'pl',
  terms text[] not null default '{}',
  processed_count int not null default 0,
  upserted_count int not null default 0,
  error_count int not null default 0,
  cursor jsonb not null default '{}'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists off_seed_runs_status_idx on public.off_seed_runs(status);

create or replace function public.normalize_tag_slug(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g')
$$;

create or replace function public.sync_recipe_time_fields()
returns trigger
language plpgsql
as $$
begin
  if new.total_time_min is null and new.total_minutes is not null then
    new.total_time_min = new.total_minutes;
  end if;
  if new.total_minutes is null and new.total_time_min is not null then
    new.total_minutes = new.total_time_min;
  end if;
  return new;
end;
$$;

drop trigger if exists recipes_sync_time_fields on public.recipes;
create trigger recipes_sync_time_fields
before insert or update on public.recipes
for each row
execute function public.sync_recipe_time_fields();

drop trigger if exists food_products_set_updated_at on public.food_products;
create trigger food_products_set_updated_at
before update on public.food_products
for each row
execute function public.set_updated_at();

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
before update on public.tags
for each row
execute function public.set_updated_at();

drop trigger if exists recipe_ingredients_set_updated_at on public.recipe_ingredients;
create trigger recipe_ingredients_set_updated_at
before update on public.recipe_ingredients
for each row
execute function public.set_updated_at();

drop trigger if exists off_seed_runs_set_updated_at on public.off_seed_runs;
create trigger off_seed_runs_set_updated_at
before update on public.off_seed_runs
for each row
execute function public.set_updated_at();

alter table public.food_products enable row level security;
alter table public.tags enable row level security;
alter table public.recipe_tags enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.off_seed_runs enable row level security;

-- FOOD PRODUCTS

drop policy if exists "food_products authenticated read" on public.food_products;
create policy "food_products authenticated read"
on public.food_products
for select
to authenticated
using (true);

drop policy if exists "food_products admin_editor write" on public.food_products;
create policy "food_products admin_editor write"
on public.food_products
for all
to authenticated
using (app.current_user_role() in ('admin','editor'))
with check (app.current_user_role() in ('admin','editor'));

-- TAGS

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

-- RECIPE TAGS

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
    select 1 from public.recipes r
    where r.id = recipe_tags.recipe_id and r.created_by = auth.uid()
  )
)
with check (
  app.current_user_role() = 'editor'
  and exists (
    select 1 from public.recipes r
    where r.id = recipe_tags.recipe_id and r.created_by = auth.uid()
  )
);

-- RECIPE INGREDIENTS

drop policy if exists "recipe_ingredients authenticated read" on public.recipe_ingredients;
create policy "recipe_ingredients authenticated read"
on public.recipe_ingredients
for select
to authenticated
using (true);

drop policy if exists "recipe_ingredients admin write" on public.recipe_ingredients;
create policy "recipe_ingredients admin write"
on public.recipe_ingredients
for all
to authenticated
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

drop policy if exists "recipe_ingredients editor own recipes" on public.recipe_ingredients;
create policy "recipe_ingredients editor own recipes"
on public.recipe_ingredients
for all
to authenticated
using (
  app.current_user_role() = 'editor'
  and exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and r.created_by = auth.uid()
  )
)
with check (
  app.current_user_role() = 'editor'
  and exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and r.created_by = auth.uid()
  )
);

-- OFF SEED RUNS

drop policy if exists "off_seed_runs admin_editor read" on public.off_seed_runs;
create policy "off_seed_runs admin_editor read"
on public.off_seed_runs
for select
to authenticated
using (app.current_user_role() in ('admin','editor'));

drop policy if exists "off_seed_runs admin_editor write" on public.off_seed_runs;
create policy "off_seed_runs admin_editor write"
on public.off_seed_runs
for all
to authenticated
using (app.current_user_role() in ('admin','editor'))
with check (app.current_user_role() in ('admin','editor'));

-- Seed baseline tags
insert into public.tags (slug, name_pl, name_en, type)
values
  ('quick', 'Szybkie', 'Quick', 'time'),
  ('high-protein', 'Wysokobiałkowe', 'High protein', 'goal'),
  ('vegetarian', 'Wegetariańskie', 'Vegetarian', 'diet'),
  ('family', 'Rodzinne', 'Family', 'meal_type')
on conflict (slug) do update
set
  name_pl = excluded.name_pl,
  name_en = excluded.name_en,
  type = excluded.type;
