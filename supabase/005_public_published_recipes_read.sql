-- Public read policy for consumer app recipe feed.
-- Keeps admin/editor/reviewer policies intact.

alter table public.recipes enable row level security;

drop policy if exists "recipes anon can read published only" on public.recipes;
create policy "recipes anon can read published only"
on public.recipes
for select
to anon
using (status = 'published');
