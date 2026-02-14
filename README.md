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
- Email-like recipe management:
  - Row selection with checkboxes (single, select all on page, shift-range)
  - Bulk actions: move to Trash, restore, permanent delete (admin), set status, assign/remove label, set cuisine, set tags, export selected CSV/JSON
  - Sorting + pagination controls in URL params
  - Active filter chips + one-click reset
  - Default list view shows `draft` + `published` so imported data does not appear empty by default
  - Label organization (`labels` + `recipe_labels`)
- Trash view (`/trash`) with restore and permanent delete safeguards
- UI language switcher (EN/PL) in top navigation
- Settings page:
  - Global app settings (admin): default/enabled languages + enabled cuisines
  - Connection status widget for Supabase health check
- Admin-only import page for CSV/XLSX with validation + dry run + diff-like preview + error report CSV

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET=recipe-images
NEXT_PUBLIC_SITE_URL=https://joanka.cafe
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OFF_BASE_URL=https://world.openfoodfacts.org
OFF_USER_AGENT="MealMom/1.0 (tom@tomdolega.com)"
OPENAI_API_KEY=optional_for_translation_generation
DEEPL_API_KEY=optional_for_translation_generation
```

If these are missing, `/login` shows a friendly setup message instead of crashing.

`NEXT_PUBLIC_SITE_URL` is used by the invite flow to build `redirectTo` for Supabase invite emails (`<SITE_URL>/auth/callback`).

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

## Supabase Auth URL Configuration (Required for Invites)

In Supabase Dashboard -> Authentication -> URL Configuration:

- Site URL: set to your production domain (for example `https://joanka.cafe`)
- Redirect URLs:
  - `https://joanka.cafe/auth/callback`
  - `http://localhost:3000/auth/callback` (optional for local development)

Invite flow now uses server-side service role only:
- API route calls `auth.admin.inviteUserByEmail(email, { redirectTo: "<SITE_URL>/auth/callback" })`
- `/auth/callback` exchanges `code` for session and redirects to `/set-password`
- `/set-password` lets invited user set password, then redirects to `/dashboard`

## Supabase SQL Setup

Run SQL files in order:

1. `supabase/schema.sql`
2. `supabase/002_settings_and_import.sql`
3. `supabase/003_reviewer_workflow_and_audit_hardening.sql`
4. `supabase/004_recipe_images_and_ui_language.sql`
5. `supabase/005_public_published_recipes_read.sql`
6. `supabase/006_recipe_images_storage.sql`
7. `supabase/007_recipes_professional_fields.sql`
8. `supabase/008_recipe_management_soft_delete_labels.sql`
9. `supabase/009_recipe_translations.sql`
10. `supabase/010_openfoodfacts_cache_and_nutrition.sql`
11. `supabase/011_catalog_tags_recipe_ingredients.sql`

In Supabase Dashboard SQL Editor, paste and run each file.

## Settings Behavior

- `app_settings` (singleton row `id=1`):
  - `default_language`
  - `enabled_languages` (used by forms and dashboard chips)
  - `enabled_cuisines` (used by recipe forms and bulk recipe management)

RLS summary:

- `app_settings`: admin read/write, authenticated users read

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

Ingredient JSON supports OFF linkage and normalized units:
- `unit_code`: one of `g, kg, ml, l, pcs, tsp, tbsp, cup, pack`
- `unit`: display label (kept for backward compatibility)
- `off_barcode`, `off_product_name`, `off_nutrition_per_100g`, `off_image_url`, `off_categories`

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

- `/` redirect to `/login`
- `/login` email/password sign in
- `/auth/callback` Supabase invite callback (code exchange)
- `/set-password` invited user sets password
- `/dashboard` recipes list + filters + export
- `/trash` soft-deleted recipes (restore / permanent delete)
- `/recipes/new` create recipe (admin/editor)
- `/recipes/[id]` edit recipe
- `/recipes/[id]/translations` manage translation variants
- `/settings` personalization + app checks
- `/import` admin-only CSV/XLSX import
- `/users` admin-only role management
  - includes invite form (email + role) that creates invite and persists role in `profiles`

## Recipe Management Safety

- Soft delete fields in `recipes`:
  - `deleted_at`
  - `deleted_by`
- Default management list excludes trashed rows (`deleted_at is null`).
- Trash view includes only trashed rows (`deleted_at is not null`).
- Public anonymous read policy now requires:
  - `status = 'published'`
  - `deleted_at is null`
- Permanent delete is restricted to `admin`.

## Multilingual Recipe Model

- New table: `recipe_translations` (`recipe_id`, `locale`, translatable fields, `translation_status`).
- Admin recipe edit now includes per-language tabs:
  - title
  - short phrase
  - Joanna says
  - ingredients
  - steps
  - tips
  - substitutions
  - translation status
- Add language flow:
  - create empty translation
  - prefill by copying selected source locale (default source: `pl-PL`)
- Generate translation flow:
  - available when `OPENAI_API_KEY` or `DEEPL_API_KEY` is configured
  - server route: `/api/recipes/translations/generate`
- Backfill migration creates translation rows from existing `recipes` content.
- `recipes.language` remains in schema for backward compatibility, but admin language behavior is driven by `recipe_translations`.

Feed behavior (single config):
- `ALLOW_FEED_LOCALE_FALLBACK` and `DEFAULT_TRANSLATION_LOCALE` in `/src/lib/translation-config.ts`
- Published feed returns:
  - recipes with `deleted_at is null` and `status='published'`
  - translation for requested locale with `translation_status='published'`
- optional fallback to default locale (marked as fallback in response)

## OpenFoodFacts Integration

- Backend-only OFF proxy routes:
  - `GET /api/products/off-search?q=...&locale=pl`
  - `POST /api/products/off-seed`
  - `GET /api/off/search?q=...&lc=pl` (legacy internal route)
  - `GET /api/off/product/:barcode?lc=pl` (legacy/internal detail route)
  - `POST /api/off/seed` (legacy batch route)
- Never call OFF directly from client apps.
- Request policy:
  - sends `OFF_USER_AGENT` header
  - throttles per-IP in API (30/min baseline)
  - caches responses in Supabase:
    - `search_cache` TTL: 7 days
    - `product_cache` TTL: 30 days
- Ingredient lines now support OFF linkage fields:
  - `product_id` (local `food_products.id`)
  - `off_barcode`
  - `off_product_name`
  - `off_nutrition_per_100g`
  - `off_categories`
  - `off_image_url`
- `recipes.nutrition_summary` is computed from linked OFF products + ingredient amount/unit.

### Limits and usage notes

- OFF search has low limits: avoid search-as-you-type without debounce/cache.
- Admin uses 500ms debounce and server cache first.
- If OFF is unavailable, API returns friendly 5xx messages and keeps existing recipe editing intact.

### Debug checklist

1. Open recipe editor, add 3 ingredients, click `Link to product` for each.
2. Save recipe and verify `nutrition_summary` is populated in DB.
3. Verify `GET /api/off/search` returns `source: cache` for repeated queries.
4. Verify published feed (`getPublishedRecipes`) includes nutrition + ingredients preview and excludes trashed recipes.

## Recipe Editor (Guided Flow)

- New checklist box at top enforces readiness before publishing:
  - title
  - short description
  - servings > 0
  - at least 1 ingredient
  - at least 1 step
  - at least 1 image for `published`
- Ingredient rows now use controlled units:
  - `g`, `kg`, `ml`, `l`, `pcs`, `tsp`, `tbsp`, `cup`, `pinch`, `slice`, `clove`, `pack`
- Server nutrition endpoint:
  - `POST /api/nutrition/calc`
  - computes ingredient totals + recipe totals + per serving
  - writes to `recipes.nutrition_total` and `recipes.nutrition_per_serving`
  - cache via `nutrition_calc_cache` (stable payload hash)
- Ingredient product linking flow:
  1. local search from `food_products`
  2. optional “Search OpenFoodFacts” to sync remote results into local catalog
  3. select product and auto-fill nutrition per 100g
- Tags section uses `tags` table with autocomplete + create tag.

## New Data Model (011)

- `food_products`: local cached product catalog (OFF/manual) for fast autocomplete and normalized nutriments.
- `tags` + `recipe_tags`: normalized recipe tagging (diet/cuisine/time/etc).
- `recipe_ingredients`: relational ingredient rows (`product_id`, qty/unit, computed nutrition, substitutions).
- `off_seed_runs`: progress log for OFF seeding batches.
- `recipes` extended with:
  - `description_short`, `description_full`
  - `nutrition_total`, `nutrition_per_serving`
  - `total_time_min` (kept in sync with `total_minutes`)

## Alignment Migration (012)

- `supabase/012_professional_recipe_system_alignment.sql` adds:
  - `food_products.image_url`
  - aligns `food_products.categories` to `jsonb`
  - `nutrition_calc_cache` table + RLS + trigger/index
  - additional index/policy safety alignment

## Smoke Test Checklist

1. Apply SQL up to `011` in Supabase.
2. Apply `supabase/012_professional_recipe_system_alignment.sql`.
3. Open `/recipes/new`, fill basics, verify checklist updates live.
4. Add ingredient -> `Link to product` -> local search -> optional OFF search.
5. Save recipe and verify:
   - `recipes` updated
   - `recipe_ingredients` rows created
   - `tags`/`recipe_tags` synced
   - `nutrition_total` + `nutrition_per_serving` updated by `/api/nutrition/calc`
6. Try status `published` without image and confirm publish save is blocked.
7. Call `POST /api/products/off-seed` and verify `food_products` growth.

## Vercel Environment + Redeploy

For both admin and consumer reads to use the same Supabase project:

1. In Vercel Project Settings -> Environment Variables, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only, never exposed to client)
2. Redeploy the latest commit.
3. Verify invite flow by sending test invite from `/users`.

## Manual Invite Test (Different Device)

1. As admin, open `/users`, send invite to a fresh email.
2. On another device/browser, open invite email and click the invite link.
3. Confirm user lands on `/set-password` with message: "Invite accepted, set your password."
4. Set new password and submit.
5. Confirm redirect to `/dashboard`.
6. Log out, then log in with invited email + new password on `/login`.
