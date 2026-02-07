import Link from "next/link";
import { ExportPublishedPackButton } from "@/components/export-published-pack-button";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import type { RecipeRecord } from "@/lib/types";

type DashboardProps = {
  searchParams: Promise<{
    status?: string;
    language?: string;
    cuisine?: string;
    search?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const { supabase } = await getCurrentProfileOrRedirect();
  const params = await searchParams;

  let query = supabase
    .from("recipes")
    .select(
      "id, translation_group_id, language, title, subtitle, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, ingredients, steps, created_by, updated_by, created_at, updated_at, published_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (params.status) query = query.eq("status", params.status);
  if (params.language) query = query.eq("language", params.language);
  if (params.cuisine) query = query.or(`primary_cuisine.eq.${params.cuisine},cuisines.cs.{${params.cuisine}}`);
  if (params.search) query = query.ilike("title", `%${params.search}%`);

  const { data: recipes, error } = await query.returns<RecipeRecord[]>();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Recipes</h1>
          <p className="text-sm text-slate-600">Filter and manage recipe lifecycle.</p>
        </div>
        <ExportPublishedPackButton language={params.language} cuisine={params.cuisine} />
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select
            name="status"
            defaultValue={params.status || ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">All</option>
            <option value="draft">draft</option>
            <option value="in_review">in_review</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Language</label>
          <input
            name="language"
            defaultValue={params.language || ""}
            placeholder="en"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Cuisine</label>
          <input
            name="cuisine"
            defaultValue={params.cuisine || ""}
            placeholder="Italian"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Search title</label>
          <input
            name="search"
            defaultValue={params.search || ""}
            placeholder="pasta"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-white">
            Apply
          </button>
          <Link href="/dashboard" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Reset
          </Link>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Title</th>
              <th className="px-3 py-2 text-left font-medium">Language</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Primary Cuisine</th>
              <th className="px-3 py-2 text-left font-medium">Updated</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(recipes || []).map((recipe) => (
              <tr key={recipe.id}>
                <td className="px-3 py-2">{recipe.title}</td>
                <td className="px-3 py-2">{recipe.language}</td>
                <td className="px-3 py-2">{recipe.status}</td>
                <td className="px-3 py-2">{recipe.primary_cuisine || "-"}</td>
                <td className="px-3 py-2">{new Date(recipe.updated_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-3">
                    <Link href={`/recipes/${recipe.id}`} className="text-blue-700 underline">
                      Edit
                    </Link>
                    <Link href={`/recipes/${recipe.id}/translations`} className="text-blue-700 underline">
                      Translations
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
