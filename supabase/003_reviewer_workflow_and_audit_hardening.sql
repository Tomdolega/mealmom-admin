-- Reviewer workflow tightening + audit field hardening

create or replace function public.set_recipe_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = auth.uid();
    new.updated_by = auth.uid();
    if new.status = 'published' then
      new.published_at = coalesce(new.published_at, now());
    else
      new.published_at = null;
    end if;
  elsif tg_op = 'UPDATE' then
    new.created_by = old.created_by;
    new.updated_by = auth.uid();

    if old.status is distinct from new.status then
      if new.status = 'published' then
        new.published_at = now();
      else
        new.published_at = null;
      end if;
    else
      new.published_at = old.published_at;
    end if;
  end if;

  return new;
end;
$$;

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
      or new.primary_cuisine is distinct from old.primary_cuisine
      or new.cuisines is distinct from old.cuisines
      or new.tags is distinct from old.tags
      or new.servings is distinct from old.servings
      or new.total_minutes is distinct from old.total_minutes
      or new.difficulty is distinct from old.difficulty
      or new.ingredients is distinct from old.ingredients
      or new.steps is distinct from old.steps
      or new.created_at is distinct from old.created_at
      or new.created_by is distinct from old.created_by
    then
      raise exception 'Reviewers cannot edit recipe content fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists recipes_reviewer_status_guard on public.recipes;
create trigger recipes_reviewer_status_guard
before update on public.recipes
for each row
execute function public.enforce_reviewer_recipe_status_only();

drop policy if exists "recipes reviewer can update in_review or publish" on public.recipes;
create policy "recipes reviewer can transition in_review status"
on public.recipes
for update
using (
  app.current_user_role() = 'reviewer'
  and status = 'in_review'
)
with check (
  app.current_user_role() = 'reviewer'
  and status in ('draft', 'published')
);
