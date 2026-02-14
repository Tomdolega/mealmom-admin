-- OpenFoodFacts integration cache + recipe nutrition summary

create table if not exists public.product_cache (
  barcode text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.search_cache (
  query text primary key,
  lc text not null default 'pl',
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.recipes
  add column if not exists nutrition_summary jsonb not null default '{}'::jsonb;

create index if not exists product_cache_expires_at_idx on public.product_cache(expires_at);
create index if not exists search_cache_expires_at_idx on public.search_cache(expires_at);

drop trigger if exists product_cache_set_updated_at on public.product_cache;
create trigger product_cache_set_updated_at
before update on public.product_cache
for each row
execute function public.set_updated_at();

drop trigger if exists search_cache_set_updated_at on public.search_cache;
create trigger search_cache_set_updated_at
before update on public.search_cache
for each row
execute function public.set_updated_at();

alter table public.product_cache enable row level security;
alter table public.search_cache enable row level security;

drop policy if exists "product_cache authenticated read" on public.product_cache;
create policy "product_cache authenticated read"
on public.product_cache
for select
to authenticated
using (true);

drop policy if exists "search_cache authenticated read" on public.search_cache;
create policy "search_cache authenticated read"
on public.search_cache
for select
to authenticated
using (true);

drop policy if exists "product_cache admin editor reviewer write" on public.product_cache;
create policy "product_cache admin editor reviewer write"
on public.product_cache
for all
to authenticated
using (app.current_user_role() in ('admin', 'editor', 'reviewer'))
with check (app.current_user_role() in ('admin', 'editor', 'reviewer'));

drop policy if exists "search_cache admin editor reviewer write" on public.search_cache;
create policy "search_cache admin editor reviewer write"
on public.search_cache
for all
to authenticated
using (app.current_user_role() in ('admin', 'editor', 'reviewer'))
with check (app.current_user_role() in ('admin', 'editor', 'reviewer'));
