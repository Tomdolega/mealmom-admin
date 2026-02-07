-- Settings and personalization foundations for admin panel

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  default_language text not null default 'en',
  enabled_languages text[] not null default array['pl', 'en', 'es', 'de', 'fr', 'pt-PT', 'en-GB'],
  enabled_cuisines text[] not null default array['Polish', 'Italian', 'French', 'Spanish', 'Mexican', 'Indian', 'Japanese'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_language text,
  preferred_cuisines text[] not null default '{}',
  ui_density text not null default 'comfortable' check (ui_density in ('comfortable', 'compact')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_settings_preferred_language_idx on public.user_settings(preferred_language);

create or replace function public.ensure_user_settings_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_settings_created on auth.users;
create trigger on_auth_user_settings_created
after insert on auth.users
for each row
execute function public.ensure_user_settings_row();

alter table public.app_settings enable row level security;
alter table public.user_settings enable row level security;

-- app_settings: admin full control, authenticated users read-only
create policy "app_settings admin full access"
on public.app_settings
for all
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

create policy "app_settings authenticated read"
on public.app_settings
for select
using (auth.role() = 'authenticated');

-- user_settings: admin full control, user manages own row
create policy "user_settings admin full access"
on public.user_settings
for all
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

create policy "user_settings user read own"
on public.user_settings
for select
using (auth.uid() = user_id);

create policy "user_settings user insert own"
on public.user_settings
for insert
with check (auth.uid() = user_id);

create policy "user_settings user update own"
on public.user_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.app_settings (id, default_language, enabled_languages, enabled_cuisines)
values (
  1,
  'en',
  array['pl', 'en', 'es', 'de', 'fr', 'pt-PT', 'en-GB'],
  array['Polish', 'Italian', 'French', 'Spanish', 'Mexican', 'Indian', 'Japanese']
)
on conflict (id) do nothing;
