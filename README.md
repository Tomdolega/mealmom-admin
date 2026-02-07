# MealMom Admin Panel

Next.js (App Router) + Supabase admin panel for recipe entry, review workflow, personalization settings, and bulk import.

## Features

- Email/password authentication with Supabase Auth
- Role-based access: `admin`, `editor`, `reviewer`
- Recipe workflow: `draft -> in_review -> published -> archived`
- Translation support via `translation_group_id`
- Cuisine model: `primary_cuisine` plus `cuisines[]`
- Form-based ingredients/steps editor (no raw JSON editing)
- Recipe editor quality of life:
  - Auto-save draft toggle (default on for admin/editor)
  - Debounced draft auto-save (1200ms)
  - Explicit Save button
  - Unsaved changes + last saved timestamp indicator
  - Product image support (`image_urls`) with URL input and optional upload to Supabase Storage
  - Description field (multi-line) with fallback to subtitle
  - Nutrition editor (`per_serving` + `per_100g`)
  - Ingredient substitutions editor with inline alternatives per ingredient
  - Live recipe preview panel in admin
- Reviewer restrictions:
  - Reviewers can open recipes
  - Reviewers can only change status from `in_review -> published` or `in_review -> draft`
  - Recipe content fields are read-only for reviewers
  - Enforced in both UI and DB policies/triggers
- Dashboard quick filters, status badges, and export published pack
- UI language switcher (EN/PL) in top navigation
- Settings page:
  - Global app settings (admin): default/enabled languages + enabled cuisines
  - Per-user preferences: preferred language, ordered preferred cuisines, UI density
  - Connection status widget for Supabase health check
- Admin-only import page for CSV/XLSX with validation + dry run + diff-like preview + error report CSV

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET=recipe-images
```

If these are missing, `/login` shows a friendly setup message instead of crashing.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation Commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Supabase SQL Setup

Run SQL files in order:

1. `supabase/schema.sql`
2. `supabase/002_settings_and_import.sql`
3. `supabase/003_reviewer_workflow_and_audit_hardening.sql`
4. `supabase/004_recipe_images_and_ui_language.sql`
5. `supabase/005_public_published_recipes_read.sql`
6. `supabase/006_recipe_images_storage.sql`
7. `supabase/007_recipes_professional_fields.sql`

In Supabase Dashboard SQL Editor, paste and run each file.

## Settings Behavior

- `app_settings` (singleton row `id=1`):
  - `default_language`
  - `enabled_languages` (used by forms and dashboard chips)
  - `enabled_cuisines` (used by recipe forms and preferences)
- `user_settings`:
  - `preferred_language`
  - `preferred_cuisines` (ordered array)
  - `ui_density`

RLS summary:

- `app_settings`: admin read/write, authenticated users read
- `user_settings`: user read/write own row, admin read/write all rows

## Import Format (CSV/XLSX)

Minimum supported columns:

- `title`
- `language`
- `status`
- `primary_cuisine`
- `cuisines` (comma-separated list)
- `tags` (comma-separated list)
- `servings`
- `total_minutes`
- `difficulty`
- `description`
- `nutrition_per_serving` (JSON object string)
- `nutrition_per_100g` (JSON object string)
- `substitutions` (JSON array string)
- `image_urls` (comma-separated URLs)
- `ingredients` (JSON array string)
- `steps` (JSON array string)

Optional columns:

- `id` (if provided, upsert by `id`)
- `subtitle`
- `translation_group_id`

### Example row

```csv
title,language,status,primary_cuisine,cuisines,tags,servings,total_minutes,difficulty,subtitle,description,nutrition_per_serving,nutrition_per_100g,substitutions,image_urls,ingredients,steps
Tomato Soup,en,draft,Polish,"Polish,Italian","quick,vegetarian",4,35,easy,"Simple and warm","Rich tomato soup with basil.","{""kcal"":220,""protein_g"":6}","{""kcal"":80,""protein_g"":2}","[{""ingredient_key"":""tomato"",""alternatives"":[{""alt_name"":""passata"",""ratio"":""1:1"",""note"":""smooth texture"",""dietary_tags"":[""vegan""]}]}]","https://cdn.example.com/soup.jpg,https://cdn.example.com/soup-2.jpg","[{""ingredient_key"":""tomato"",""name"":""Tomato"",""amount"":""6"",""unit"":""pcs"",""note"":""ripe""}]","[{""step_number"":1,""text"":""Chop tomatoes"",""timer_seconds"":120}]"
```

Import notes:

- Dry run validates and reports errors without inserting rows.
- For real import, valid rows are upserted in chunks for better performance.
- If any rows fail, `recipe-import-errors.csv` is downloaded.

## Product Images

- Recipes now store `image_urls` (array of image links).
- In recipe editor you can:
  - add image URL manually
  - upload image files to Supabase Storage bucket (`NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET`)
- Run `supabase/006_recipe_images_storage.sql` to create/configure the `recipe-images` bucket and storage policies.
- If your SQL role cannot modify `storage.*`, create bucket/policies manually in Supabase UI:
  - Bucket: `recipe-images`
  - Read: authenticated users
  - Upload: authenticated users
  - Update/Delete: owner only
- If upload fails, the UI now shows Supabase error code/message to speed up diagnostics.

## Main Routes

- `/` public list of published recipes (optional `?language=en` filter)
- `/login` email/password sign in
- `/dashboard` recipes list + filters + export
- `/recipes/new` create recipe (admin/editor)
- `/recipes/[id]` edit recipe
- `/recipes/[id]/translations` manage translation variants
- `/settings` personalization + app checks
- `/import` admin-only CSV/XLSX import
- `/users` admin-only role management

## Vercel Environment + Redeploy

For both admin and consumer reads to use the same Supabase project:

1. In Vercel Project Settings -> Environment Variables, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Redeploy the latest commit.
3. Open `/` in non-production or local dev and verify the debug banner host matches your Supabase project host.
