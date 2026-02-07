-- Professional recipe fields: description, nutrition, substitutions
-- Backward-compatible defaults prevent existing rows from breaking.

alter table public.recipes
  add column if not exists description text,
  add column if not exists nutrition jsonb not null default '{}'::jsonb,
  add column if not exists substitutions jsonb not null default '[]'::jsonb,
  add column if not exists image_urls text[] not null default '{}';

update public.recipes
set nutrition = '{}'::jsonb
where nutrition is null;

update public.recipes
set substitutions = '[]'::jsonb
where substitutions is null;

create or replace function public.enforce_reviewer_recipe_status_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and app.current_user_role() = 'reviewer' then
    if old.status <> 'in_review' then
      raise exception 'Reviewers can only update recipes currently in_review';
    end if;

    if new.status not in ('draft', 'published') then
      raise exception 'Reviewers can only move in_review to draft or published';
    end if;

    if new.translation_group_id is distinct from old.translation_group_id
      or new.language is distinct from old.language
      or new.title is distinct from old.title
      or new.subtitle is distinct from old.subtitle
      or new.description is distinct from old.description
      or new.primary_cuisine is distinct from old.primary_cuisine
      or new.cuisines is distinct from old.cuisines
      or new.tags is distinct from old.tags
      or new.servings is distinct from old.servings
      or new.total_minutes is distinct from old.total_minutes
      or new.difficulty is distinct from old.difficulty
      or new.nutrition is distinct from old.nutrition
      or new.ingredients is distinct from old.ingredients
      or new.steps is distinct from old.steps
      or new.substitutions is distinct from old.substitutions
      or new.image_urls is distinct from old.image_urls
      or new.created_at is distinct from old.created_at
      or new.created_by is distinct from old.created_by
    then
      raise exception 'Reviewers cannot edit recipe content fields';
    end if;
  end if;

  return new;
end;
$$;
