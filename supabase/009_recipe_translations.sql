-- Proper multilingual model: per-recipe translations

create table if not exists public.recipe_translations (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  locale text not null,
  title text,
  short_phrase text,
  joanna_says text,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  tips text,
  substitutions jsonb not null default '[]'::jsonb,
  translation_status text not null default 'draft' check (translation_status in ('draft', 'in_review', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, locale)
);

create index if not exists recipe_translations_recipe_id_idx on public.recipe_translations(recipe_id);
create index if not exists recipe_translations_locale_idx on public.recipe_translations(locale);
create index if not exists recipe_translations_status_idx on public.recipe_translations(translation_status);
create index if not exists recipe_translations_recipe_locale_idx on public.recipe_translations(recipe_id, locale);

drop trigger if exists recipe_translations_set_updated_at on public.recipe_translations;
create trigger recipe_translations_set_updated_at
before update on public.recipe_translations
for each row
execute function public.set_updated_at();

alter table public.recipe_translations enable row level security;

drop policy if exists "recipe_translations admin full access" on public.recipe_translations;
create policy "recipe_translations admin full access"
on public.recipe_translations
for all
to authenticated
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

drop policy if exists "recipe_translations reviewer can read all" on public.recipe_translations;
create policy "recipe_translations reviewer can read all"
on public.recipe_translations
for select
to authenticated
using (app.current_user_role() = 'reviewer');

drop policy if exists "recipe_translations editor can read own recipes" on public.recipe_translations;
create policy "recipe_translations editor can read own recipes"
on public.recipe_translations
for select
to authenticated
using (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_translations.recipe_id
      and r.created_by = auth.uid()
  )
);

drop policy if exists "recipe_translations editor can insert own recipes" on public.recipe_translations;
create policy "recipe_translations editor can insert own recipes"
on public.recipe_translations
for insert
to authenticated
with check (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_translations.recipe_id
      and r.created_by = auth.uid()
  )
);

drop policy if exists "recipe_translations editor can update own recipes" on public.recipe_translations;
create policy "recipe_translations editor can update own recipes"
on public.recipe_translations
for update
to authenticated
using (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_translations.recipe_id
      and r.created_by = auth.uid()
  )
)
with check (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_translations.recipe_id
      and r.created_by = auth.uid()
  )
);

drop policy if exists "recipe_translations editor can delete own recipes" on public.recipe_translations;
create policy "recipe_translations editor can delete own recipes"
on public.recipe_translations
for delete
to authenticated
using (
  app.current_user_role() = 'editor'
  and exists (
    select 1
    from public.recipes r
    where r.id = recipe_translations.recipe_id
      and r.created_by = auth.uid()
  )
);

drop policy if exists "recipe_translations reviewer can update status only" on public.recipe_translations;
create policy "recipe_translations reviewer can update status only"
on public.recipe_translations
for update
to authenticated
using (app.current_user_role() = 'reviewer')
with check (app.current_user_role() = 'reviewer');

create or replace function public.enforce_reviewer_translation_status_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and app.current_user_role() = 'reviewer' then
    if new.recipe_id is distinct from old.recipe_id
      or new.locale is distinct from old.locale
      or new.title is distinct from old.title
      or new.short_phrase is distinct from old.short_phrase
      or new.joanna_says is distinct from old.joanna_says
      or new.ingredients is distinct from old.ingredients
      or new.steps is distinct from old.steps
      or new.tips is distinct from old.tips
      or new.substitutions is distinct from old.substitutions
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Reviewers cannot edit translation content fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists recipe_translations_reviewer_guard on public.recipe_translations;
create trigger recipe_translations_reviewer_guard
before update on public.recipe_translations
for each row
execute function public.enforce_reviewer_translation_status_only();

-- Backfill from existing recipes content. Keep data safe and non-destructive.
insert into public.recipe_translations (
  recipe_id,
  locale,
  title,
  short_phrase,
  joanna_says,
  ingredients,
  steps,
  tips,
  substitutions,
  translation_status,
  created_at,
  updated_at
)
select
  r.id,
  case
    when r.language = 'pl' then 'pl-PL'
    when r.language = 'en' then 'en-GB'
    when r.language = 'de' then 'de-DE'
    when r.language = 'fr' then 'fr-FR'
    when r.language = 'es' then 'es-ES'
    when r.language = 'pt' then 'pt-PT'
    when r.language like '__-__' then split_part(r.language, '-', 1) || '-' || upper(split_part(r.language, '-', 2))
    when r.language like '__-___' then split_part(r.language, '-', 1) || '-' || upper(split_part(r.language, '-', 2))
    when r.language is null or btrim(r.language) = '' then 'pl-PL'
    else r.language
  end as locale,
  r.title,
  r.subtitle,
  r.description,
  coalesce(r.ingredients, '[]'::jsonb),
  coalesce(r.steps, '[]'::jsonb),
  null::text,
  coalesce(r.substitutions, '[]'::jsonb),
  case
    when r.status = 'published' then 'published'
    when r.status = 'in_review' then 'in_review'
    else 'draft'
  end as translation_status,
  r.created_at,
  r.updated_at
from public.recipes r
on conflict (recipe_id, locale) do nothing;
