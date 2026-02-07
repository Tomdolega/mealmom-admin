# MealMom Admin Panel

Next.js (App Router) + Supabase admin panel for recipe entry, review workflow, personalization settings, and bulk import.

## Features

- Email/password authentication with Supabase Auth
- Role-based access: `admin`, `editor`, `reviewer`
- Recipe workflow: `draft -> in_review -> published -> archived`
- Translation support via `translation_group_id`
- Cuisine model: `primary_cuisine` plus `cuisines[]`
- Form-based ingredients/steps editor (no raw JSON editing)
- Dashboard quick filters, status badges, and export published pack
- Settings page:
  - Global app settings (admin): default/enabled languages + enabled cuisines
  - Per-user preferences: preferred language, ordered preferred cuisines, UI density
  - Connection status widget for Supabase health check
- Admin-only import page for CSV/XLSX with validation + preview + error report

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
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

Run both SQL files in order:

1. `supabase/schema.sql`
2. `supabase/002_settings_and_import.sql`

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
- `ingredients` (JSON array string)
- `steps` (JSON array string)

Optional columns:

- `subtitle`
- `translation_group_id`

### Example row

```csv
title,language,status,primary_cuisine,cuisines,tags,servings,total_minutes,difficulty,subtitle,ingredients,steps
Tomato Soup,en,draft,Polish,"Polish,Italian","quick,vegetarian",4,35,easy,"Simple and warm","[{""name"":""Tomato"",""amount"":""6"",""unit"":""pcs"",""note"":""ripe""}]","[{""step_number"":1,""text"":""Chop tomatoes"",""timer_seconds"":120}]"
```

On import, the app validates rows, inserts valid rows, and downloads `recipe-import-errors.csv` when failures occur.

## Main Routes

- `/login` email/password sign in
- `/dashboard` recipes list + filters + export
- `/recipes/new` create recipe
- `/recipes/[id]` edit recipe
- `/recipes/[id]/translations` manage translation variants
- `/settings` personalization + app checks
- `/import` admin-only CSV/XLSX import
- `/users` admin-only role management
