import Link from "next/link";
import { getPublishedRecipes, getSupabaseUrlHost } from "@/lib/published-recipes";

type HomePageProps = {
  searchParams: Promise<{
    language?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const language = params.language?.trim() || undefined;
  const { rows, error } = await getPublishedRecipes({ language });
  const supabaseHost = getSupabaseUrlHost();

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Published recipes</h1>
            <p className="mt-1 text-sm text-slate-600">Public feed from the same Supabase project as the admin panel.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50">
              Admin login
            </Link>
            <Link href="/dashboard" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50">
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      {process.env.NODE_ENV !== "production" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase host (debug): {supabaseHost ?? "not configured"}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <form className="mb-4 flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700">Language (optional)</span>
            <input
              type="text"
              name="language"
              defaultValue={language ?? ""}
              placeholder="en, pl, es..."
              className="h-10 w-48 rounded-md border border-slate-300 bg-white px-3 text-slate-900"
            />
          </label>
          <button type="submit" className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
            Apply
          </button>
          <Link href="/" className="h-10 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Reset
          </Link>
        </form>

        {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        {rows.length === 0 ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">No published recipes.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {rows.map((recipe) => (
              <li key={recipe.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-4 sm:items-center">
                <p className="font-medium text-slate-900">{recipe.title}</p>
                <p className="text-slate-600">{recipe.primary_cuisine || "—"}</p>
                <p className="text-slate-600">{recipe.language}</p>
                <p className="text-slate-500">{new Date(recipe.updated_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
