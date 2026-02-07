-- MealMom Admin Panel schema + seed + RLS

create extension if not exists pgcrypto;

-- Keep helper functions scoped under app
create schema if not exists app;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor', 'reviewer')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  translation_group_id uuid not null default gen_random_uuid(),
  language text not null,
  title text not null,
  subtitle text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  primary_cuisine text,
  cuisines text[] not null default '{}',
  tags text[] not null default '{}',
  servings int,
  total_minutes int,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  nutrition jsonb not null default '{}'::jsonb,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  substitutions jsonb not null default '[]'::jsonb,
  image_urls text[] not null default '{}',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists recipes_status_idx on public.recipes(status);
create index if not exists recipes_language_idx on public.recipes(language);
create index if not exists recipes_primary_cuisine_idx on public.recipes(primary_cuisine);
create index if not exists recipes_translation_group_idx on public.recipes(translation_group_id);
create index if not exists recipes_title_trgm_idx on public.recipes using gin (to_tsvector('simple', title));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_recipe_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by = auth.uid();
    end if;
    new.updated_by = coalesce(new.updated_by, auth.uid());
    if new.status = 'published' and new.published_at is null then
      new.published_at = now();
    end if;
  elsif tg_op = 'UPDATE' then
    new.updated_by = auth.uid();
    if old.status is distinct from new.status then
      if new.status = 'published' then
        new.published_at = now();
      elsif new.status <> 'published' then
        new.published_at = null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function app.current_user_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'editor', coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger recipes_set_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

create trigger recipes_set_audit_fields
before insert or update on public.recipes
for each row
execute function public.set_recipe_audit_fields();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.recipes enable row level security;

-- PROFILES RLS
create policy "profiles admin full access"
on public.profiles
for all
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

create policy "profiles users can read self"
on public.profiles
for select
using (auth.uid() = id);

-- RECIPES RLS
create policy "recipes admin full access"
on public.recipes
for all
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

create policy "recipes reviewer can read all"
on public.recipes
for select
using (app.current_user_role() = 'reviewer');

create policy "recipes editor can read own"
on public.recipes
for select
using (app.current_user_role() = 'editor' and created_by = auth.uid());

create policy "recipes editor can create own drafts"
on public.recipes
for insert
with check (
  app.current_user_role() = 'editor'
  and created_by = auth.uid()
  and status = 'draft'
);

create policy "recipes editor can update own drafts"
on public.recipes
for update
using (
  app.current_user_role() = 'editor'
  and created_by = auth.uid()
  and status = 'draft'
)
with check (
  app.current_user_role() = 'editor'
  and created_by = auth.uid()
  and status = 'draft'
);

create policy "recipes reviewer can update in_review or publish"
on public.recipes
for update
using (
  app.current_user_role() = 'reviewer'
  and (status = 'in_review' or status = 'draft')
)
with check (
  app.current_user_role() = 'reviewer'
  and status in ('in_review', 'published')
);

-- Optional seed data for local/dev usage
insert into public.profiles (id, role, display_name)
select u.id, 'admin', coalesce(u.email, 'Admin')
from auth.users u
order by u.created_at asc
limit 1
on conflict (id) do nothing;

insert into public.recipes (
  translation_group_id,
  language,
  title,
  subtitle,
  description,
  status,
  primary_cuisine,
  cuisines,
  tags,
  servings,
  total_minutes,
  difficulty,
  nutrition,
  ingredients,
  steps,
  substitutions,
  image_urls,
  created_by,
  updated_by
)
select
  gen_random_uuid(),
  'en',
  'Seed Tomato Pasta',
  'Simple weeknight recipe',
  'Classic tomato pasta for a fast weekday dinner.',
  'draft',
  'Italian',
  array['Italian'],
  array['quick', 'vegetarian'],
  2,
  25,
  'easy',
  '{"per_serving":{"kcal":420,"protein_g":14,"fat_g":9,"carbs_g":70}}'::jsonb,
  '[{"name":"Pasta","amount":"200","unit":"g","note":"any shape"},{"name":"Tomato Sauce","amount":"1","unit":"cup","note":""}]'::jsonb,
  '[{"step_number":1,"text":"Boil pasta until al dente.","timer_seconds":600},{"step_number":2,"text":"Heat sauce and combine.","timer_seconds":300}]'::jsonb,
  '[]'::jsonb,
  '{}'::text[],
  p.id,
  p.id
from public.profiles p
where p.role = 'admin'
limit 1;
