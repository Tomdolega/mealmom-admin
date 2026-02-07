# MealMom Admin Panel

Next.js (App Router) + Supabase admin panel for recipe entry and workflow management.

## Features

- Email/password authentication with Supabase Auth
- Role-based access: `admin`, `editor`, `reviewer`
- Recipe workflow: `draft -> in_review -> published -> archived`
- Translation support using `translation_group_id` with separate recipe records per language
- Cuisine model: `primary_cuisine` plus `cuisines[]`
- Non-technical form UI for ingredients and steps (no raw JSON editing)
- Published pack export from dashboard filtered by language/cuisine

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Typecheck and Build

```bash
npx tsc --noEmit
npm run build
```

## Apply Supabase Schema

Schema file (includes tables, triggers, RLS policies, and seed inserts):

- `supabase/schema.sql`

In Supabase Dashboard:

1. Open SQL Editor.
2. Paste contents of `supabase/schema.sql`.
3. Run the query.

Or with Supabase CLI:

```bash
supabase db push
```

## Main Routes

- `/login` email/password sign in
- `/dashboard` recipe list with filters and export button
- `/recipes/new` create recipe form
- `/recipes/[id]` edit recipe + status controls
- `/recipes/[id]/translations` list/create translations in the same translation group
- `/users` admin-only role management for `profiles`
