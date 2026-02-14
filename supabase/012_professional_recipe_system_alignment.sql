-- Align schema with professional recipe system contract

create extension if not exists pg_trgm;

alter table public.food_products
  add column if not exists image_url text;

-- Align categories to jsonb for flexible payload compatibility.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'food_products'
      and column_name = 'categories'
      and data_type <> 'jsonb'
  ) then
    alter table public.food_products
      alter column categories type jsonb using
        case
          when categories is null then null
          else to_jsonb(categories)
        end;
  end if;
end;
$$;

alter table public.recipe_ingredients
  alter column computed drop not null,
  alter column computed drop default;

create table if not exists public.nutrition_calc_cache (
  hash text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nutrition_calc_cache_updated_idx on public.nutrition_calc_cache(updated_at desc);

create index if not exists food_products_name_brand_trgm_idx
  on public.food_products
  using gin ((coalesce(name_pl, '') || ' ' || coalesce(brand, '')) gin_trgm_ops);

create index if not exists food_products_name_fts_idx
  on public.food_products
  using gin (to_tsvector('simple', coalesce(name_pl, '') || ' ' || coalesce(brand, '')));

create index if not exists recipes_status_idx on public.recipes(status);
create index if not exists recipes_language_idx on public.recipes(language);
create index if not exists recipes_translation_group_idx on public.recipes(translation_group_id);

-- updated_at trigger for cache

drop trigger if exists nutrition_calc_cache_set_updated_at on public.nutrition_calc_cache;
create trigger nutrition_calc_cache_set_updated_at
before update on public.nutrition_calc_cache
for each row
execute function public.set_updated_at();

alter table public.nutrition_calc_cache enable row level security;

-- authenticated read for operational visibility

drop policy if exists "nutrition_cache authenticated read" on public.nutrition_calc_cache;
create policy "nutrition_cache authenticated read"
on public.nutrition_calc_cache
for select
to authenticated
using (true);

-- write access only for admin/editor from server-side routes

drop policy if exists "nutrition_cache admin_editor write" on public.nutrition_calc_cache;
create policy "nutrition_cache admin_editor write"
on public.nutrition_calc_cache
for all
to authenticated
using (app.current_user_role() in ('admin','editor'))
with check (app.current_user_role() in ('admin','editor'));
