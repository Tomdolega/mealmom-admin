import Link from "next/link";
import { ExportPublishedPackButton } from "@/components/export-published-pack-button";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import type { AppSettingsRecord, RecipeRecord, RecipeStatus } from "@/lib/types";

type DashboardProps = {
  searchParams: Promise<{
    status?: RecipeStatus;
    language?: string;
    cuisine?: string;
    search?: string;
    mine?: string;
  }>;
};

function buildHref(params: URLSearchParams, updates: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  const query = next.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

async function getStatusCount(supabase: Awaited<ReturnType<typeof getCurrentProfileOrRedirect>>["supabase"], status: RecipeStatus) {
  const { count } = await supabase.from("recipes").select("id", { count: "exact", head: true }).eq("status", status);
  return count || 0;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const { supabase, session, profile } = await getCurrentProfileOrRedirect();
  const params = await searchParams;

  const [appSettingsRes, draftCount, reviewCount, publishedCount, recentRes] = await Promise.all([
    supabase
      .from("app_settings")
      .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
      .eq("id", 1)
      .maybeSingle<AppSettingsRecord>(),
    getStatusCount(supabase, "draft"),
    getStatusCount(supabase, "in_review"),
    getStatusCount(supabase, "published"),
    supabase
      .from("recipes")
      .select("id, title, status, language, updated_at")
      .order("updated_at", { ascending: false })
      .limit(6)
      .returns<Array<Pick<RecipeRecord, "id" | "title" | "status" | "language" | "updated_at">>>(),
  ]);

  const normalizedSettings = normalizeAppSettings(appSettingsRes.data);
  const enabledLanguages = normalizedSettings.enabled_languages;
  const recentRecipes = recentRes.data || [];

  let query = supabase
    .from("recipes")
    .select(
      "id, translation_group_id, language, title, subtitle, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, image_urls, ingredients, steps, created_by, updated_by, created_at, updated_at, published_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (params.status) query = query.eq("status", params.status);
  if (params.language) query = query.eq("language", params.language);
  if (params.cuisine) query = query.or(`primary_cuisine.eq.${params.cuisine},cuisines.cs.{${params.cuisine}}`);
  if (params.search) query = query.ilike("title", `%${params.search}%`);
  if (params.mine === "1") query = query.eq("created_by", session.user.id).eq("status", "draft");

  const { data: recipes, error } = await query.returns<RecipeRecord[]>();
  const translationGroupIds = [...new Set((recipes || []).map((recipe) => recipe.translation_group_id))];

  const translationMap = new Map<string, string[]>();
  if (translationGroupIds.length > 0) {
    const { data: translations } = await supabase
      .from("recipes")
      .select("translation_group_id, language")
      .in("translation_group_id", translationGroupIds)
      .returns<Array<{ translation_group_id: string; language: string }>>();

    for (const item of translations || []) {
      const current = translationMap.get(item.translation_group_id) || [];
      translationMap.set(item.translation_group_id, [...new Set([...current, item.language])]);
    }
  }

  const activeParams = new URLSearchParams();
  if (params.status) activeParams.set("status", params.status);
  if (params.language) activeParams.set("language", params.language);
  if (params.cuisine) activeParams.set("cuisine", params.cuisine);
  if (params.search) activeParams.set("search", params.search);
  if (params.mine) activeParams.set("mine", params.mine);

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Control overview</h1>
            <p className="mt-1 text-sm text-slate-600">Monitor recipe flow and act quickly on pending work.</p>
          </div>
          <ExportPublishedPackButton language={params.language} cuisine={params.cuisine} />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Drafts</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{draftCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">In review</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{reviewCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Published</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{publishedCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">System</p>
            <p className="mt-1 text-sm font-medium text-slate-700">Connection ready</p>
            <p className="text-xs text-slate-500">Export + filters available</p>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold text-slate-800">Last updated recipes</h2>
          {recentRecipes.length === 0 ? (
            <p className="text-sm text-slate-500">No recipes yet. Create your first recipe to start workflow tracking.</p>
          ) : (
            <div className="space-y-1.5">
              {recentRecipes.map((item) => (
                <Link
                  key={item.id}
                  href={`/recipes/${item.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="truncate text-sm text-slate-700">
                    {item.title} <span className="text-slate-400">· {item.language}</span>
                  </span>
                  <span className="text-xs text-slate-500">{new Date(item.updated_at).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recipe management</h2>
            <p className="text-sm text-slate-600">Use quick controls to narrow results before opening a recipe.</p>
          </div>
          <Link href={buildHref(activeParams, { mine: params.mine === "1" ? null : "1" })}>
            <Button type="button" variant={params.mine === "1" ? "primary" : "secondary"} size="sm">
              My drafts
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
            {(["draft", "in_review", "published", "archived"] as RecipeStatus[]).map((status) => {
              const active = params.status === status;
              return (
                <Link key={status} href={buildHref(activeParams, { status: active ? null : status })}>
                  <Button type="button" variant={active ? "primary" : "ghost"} size="sm">
                    {status}
                  </Button>
                </Link>
              );
            })}
            <Link href={buildHref(activeParams, { status: null })}>
              <Button type="button" variant={!params.status ? "secondary" : "ghost"} size="sm">
                all
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-medium uppercase tracking-wide text-slate-500">Language</span>
            {enabledLanguages.map((language) => {
              const active = params.language === language;
              return (
                <Link key={language} href={buildHref(activeParams, { language: active ? null : language })}>
                  <Button type="button" variant={active ? "primary" : "ghost"} size="sm">
                    {language}
                  </Button>
                </Link>
              );
            })}
            <Link href={buildHref(activeParams, { language: null })}>
              <Button type="button" variant={!params.language ? "secondary" : "ghost"} size="sm">
                all
              </Button>
            </Link>
          </div>
        </div>

        <form className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4">
          <Select name="cuisine" defaultValue={params.cuisine || ""}>
            <option value="">All cuisines</option>
            {normalizedSettings.enabled_cuisines.map((cuisine) => (
              <option key={cuisine} value={cuisine}>
                {cuisine}
              </option>
            ))}
          </Select>
          <Input name="search" defaultValue={params.search || ""} placeholder="Search by recipe title" />
          <input type="hidden" name="status" value={params.status || ""} />
          <input type="hidden" name="language" value={params.language || ""} />
          <input type="hidden" name="mine" value={params.mine || ""} />
          <div className="flex items-center gap-2">
            <Button type="submit">Apply</Button>
            <Link href="/dashboard">
              <Button type="button" variant="secondary">
                Reset
              </Button>
            </Link>
          </div>
        </form>

        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load recipes. Please try again.</p> : null}

        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Recipe</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Cuisine</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Languages</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Updated</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(recipes || []).map((recipe) => (
                <tr key={recipe.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{recipe.title}</p>
                    <p className="text-xs text-slate-500">{recipe.subtitle || recipe.language}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={recipe.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{recipe.primary_cuisine || "-"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {(translationMap.get(recipe.translation_group_id) || [recipe.language]).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(recipe.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/recipes/${recipe.id}`}>
                        <Button type="button" variant="secondary" size="sm">
                          Open
                        </Button>
                      </Link>
                      {profile.role !== "reviewer" ? (
                        <Link href={`/recipes/${recipe.id}/translations`}>
                          <Button type="button" variant="ghost" size="sm">
                            Translations
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {(recipes || []).length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-slate-500" colSpan={6}>
                    No recipes match the current filters. Adjust filters or create a new recipe.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
