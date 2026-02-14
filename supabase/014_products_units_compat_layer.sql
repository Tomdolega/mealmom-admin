-- Additive compatibility layer: products + units + normalized ingredient columns

create extension if not exists pg_trgm;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  barcode text,
  name_pl text,
  name_en text,
  brand text,
  categories text[],
  image_url text,
  nutriments jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists products_barcode_idx on public.products(barcode);
create index if not exists products_name_trgm_idx
  on public.products
  using gin ((coalesce(name_pl, '') || ' ' || coalesce(name_en, '') || ' ' || coalesce(brand, '')) gin_trgm_ops);
create index if not exists products_name_fts_idx
  on public.products
  using gin (to_tsvector('simple', coalesce(name_pl, '') || ' ' || coalesce(name_en, '') || ' ' || coalesce(brand, '')));

create table if not exists public.units (
  code text primary key,
  name_pl text not null,
  name_en text,
  type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.units (code, name_pl, name_en, type)
values
  ('g', 'gram', 'gram', 'mass'),
  ('kg', 'kilogram', 'kilogram', 'mass'),
  ('ml', 'mililitr', 'milliliter', 'volume'),
  ('l', 'litr', 'liter', 'volume'),
  ('pcs', 'sztuka', 'piece', 'count'),
  ('tbsp', 'łyżka', 'tablespoon', 'volume'),
  ('tsp', 'łyżeczka', 'teaspoon', 'volume'),
  ('cup', 'szklanka', 'cup', 'volume'),
  ('slice', 'plaster', 'slice', 'count'),
  ('clove', 'ząbek', 'clove', 'count'),
  ('pack', 'opakowanie', 'pack', 'count')
on conflict (code) do update
set
  name_pl = excluded.name_pl,
  name_en = excluded.name_en,
  type = excluded.type;

alter table public.recipe_ingredients
  add column if not exists name_override text,
  add column if not exists quantity numeric,
  add column if not exists unit_code text;

update public.recipe_ingredients
set
  quantity = coalesce(quantity, qty),
  unit_code = coalesce(unit_code, nullif(unit, ''))
where quantity is null
   or unit_code is null;

-- Keep old columns, but enforce new normalized columns for new writes.
alter table public.recipe_ingredients
  alter column quantity set default 0,
  alter column quantity set not null,
  alter column unit_code set default 'g',
  alter column unit_code set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recipe_ingredients_unit_code_fkey'
  ) then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_unit_code_fkey
      foreign key (unit_code) references public.units(code)
      on update cascade on delete restrict
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recipe_ingredients_product_id_products_fkey'
  ) then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_product_id_products_fkey
      foreign key (product_id) references public.products(id)
      on update cascade on delete set null
      not valid;
  end if;
end $$;

create index if not exists recipe_ingredients_unit_code_idx on public.recipe_ingredients(unit_code);

-- Backfill products from food_products if source table exists
do $$
begin
  if to_regclass('public.food_products') is not null then
    execute $q$
      insert into public.products (
        source,
        source_id,
        barcode,
        name_pl,
        name_en,
        brand,
        categories,
        image_url,
        nutriments,
        last_synced_at
      )
      select
        fp.source,
        fp.source_id,
        fp.barcode,
        fp.name_pl,
        fp.name_en,
        fp.brand,
        null,
        fp.image_url,
        fp.nutriments,
        coalesce(fp.updated_at, now())
      from public.food_products fp
      on conflict (source, source_id) do update
      set
        barcode = excluded.barcode,
        name_pl = excluded.name_pl,
        name_en = excluded.name_en,
        brand = excluded.brand,
        image_url = excluded.image_url,
        nutriments = excluded.nutriments,
        last_synced_at = excluded.last_synced_at,
        updated_at = now()
    $q$;
  end if;
end $$;

-- map existing recipe_ingredients.product_id from food_products ids to products ids when possible
do $$
begin
  if to_regclass('public.food_products') is not null then
    execute $q$
      update public.recipe_ingredients ri
      set product_id = p.id
      from public.food_products fp
      join public.products p on p.source = fp.source and p.source_id = fp.source_id
      where ri.product_id = fp.id
    $q$;
  end if;
end $$;

create index if not exists products_source_source_id_idx on public.products(source, source_id);
create index if not exists recipes_deleted_at_idx on public.recipes(deleted_at);
create index if not exists recipes_status_idx on public.recipes(status);
create index if not exists recipes_language_idx on public.recipes(language);
create index if not exists recipes_translation_group_idx on public.recipes(translation_group_id);

-- Triggers

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at
before update on public.units
for each row
execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.units enable row level security;

-- RLS for products and units

drop policy if exists "products authenticated read" on public.products;
create policy "products authenticated read"
on public.products
for select
 to authenticated
using (true);

drop policy if exists "products admin_editor write" on public.products;
create policy "products admin_editor write"
on public.products
for all
 to authenticated
using (app.current_user_role() in ('admin','editor'))
with check (app.current_user_role() in ('admin','editor'));

drop policy if exists "units authenticated read" on public.units;
create policy "units authenticated read"
on public.units
for select
 to authenticated
using (true);

drop policy if exists "units admin write" on public.units;
create policy "units admin write"
on public.units
for all
 to authenticated
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');
