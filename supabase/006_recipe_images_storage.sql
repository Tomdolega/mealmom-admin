-- Supabase Storage setup for recipe image uploads
-- Ensures `recipe-images` bucket exists and authenticated users can upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "recipe images authenticated read" on storage.objects;
create policy "recipe images authenticated read"
on storage.objects
for select
to authenticated
using (bucket_id = 'recipe-images');

drop policy if exists "recipe images authenticated upload" on storage.objects;
create policy "recipe images authenticated upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'recipe-images');

drop policy if exists "recipe images authenticated update own" on storage.objects;
create policy "recipe images authenticated update own"
on storage.objects
for update
to authenticated
using (bucket_id = 'recipe-images' and owner = auth.uid())
with check (bucket_id = 'recipe-images' and owner = auth.uid());

drop policy if exists "recipe images authenticated delete own" on storage.objects;
create policy "recipe images authenticated delete own"
on storage.objects
for delete
to authenticated
using (bucket_id = 'recipe-images' and owner = auth.uid());
