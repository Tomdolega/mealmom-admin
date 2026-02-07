import Link from "next/link";
import { ExportPublishedPackButton } from "@/components/export-published-pack-button";
import { RecipeThumbnail } from "@/components/recipe-thumbnail";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import {
  applyDashboardRecipeListFilters,
  DASHBOARD_RECIPE_LIST_COLUMNS,
  type DashboardRecipeListRow,
} from "@/lib/dashboard-recipe-list";
import { getRecipeStatusLabel } from "@/lib/recipe-status";
import { normalizeAppSettings } from "@/lib/settings";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { AppSettingsRecord, RecipeRecord, RecipeStatus } from "@/lib/types";

type DashboardProps = {
  searchParams: Promise<{
    status?: RecipeStatus;
    language?: string;
    cuisine?: string;
    search?: string;
    mine?: string;
    hasImage?: string;
    missingNutrition?: string;
    missingSubstitutions?: string;
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
  const [{ supabase, session, profile }, params, lang] = await Promise.all([
    getCurrentProfileOrRedirect(),
    searchParams,
    getServerUILang(),
  ]);

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

  const listDebugId = `dash-list-${session.user.id.slice(0, 8)}-${params.status || "all"}-${params.language || "all"}`;
  const baseListQuery = supabase
    .from("recipes")
    .select(DASHBOARD_RECIPE_LIST_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(100);
  const listQuery = applyDashboardRecipeListFilters(baseListQuery, params, session.user.id);
  const { data: recipes, error } = await listQuery.returns<DashboardRecipeListRow[]>();
  if (error) {
    console.error(`[${listDebugId}] Dashboard recipe list query failed`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      filters: params,
    });
    if (process.env.NODE_ENV !== "production" && draftCount + reviewCount + publishedCount > 0) {
      console.warn(
        `[${listDebugId}] Dashboard invariant: summary counters are non-zero, but list query failed.`,
      );
    }
  }
  const translationGroupIds = [...new Set((recipes || []).map((recipe) => recipe.translation_group_id))];
  const recipeIdsForMeta = [...new Set([...(recipes || []).map((item) => item.id), ...recentRecipes.map((item) => item.id)])];
  const recipeMetaMap = new Map<
    string,
    {
      image_urls: string[];
      nutrition: { per_serving?: { kcal?: number | null } };
      substitutions: unknown[];
    }
  >();
  if (recipeIdsForMeta.length > 0) {
    const { data: metaRows, error: metaError } = await supabase
      .from("recipes")
      .select("id, image_urls, nutrition, substitutions")
      .in("id", recipeIdsForMeta)
      .returns<
        Array<{
          id: string;
          image_urls?: string[] | null;
          nutrition?: { per_serving?: { kcal?: number | null } } | null;
          substitutions?: unknown[] | null;
        }>
      >();

    if (metaError) {
      // Keep dashboard usable even when optional migrations are missing in an environment.
      console.warn(`[${listDebugId}] Optional recipe metadata query failed`, {
        message: metaError.message,
        code: metaError.code,
        details: metaError.details,
        hint: metaError.hint,
      });
    } else {
      for (const row of metaRows || []) {
        recipeMetaMap.set(row.id, {
          image_urls: row.image_urls || [],
          nutrition: row.nutrition || {},
          substitutions: row.substitutions || [],
        });
      }
    }
  }

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
  if (params.hasImage) activeParams.set("hasImage", params.hasImage);
  if (params.missingNutrition) activeParams.set("missingNutrition", params.missingNutrition);
  if (params.missingSubstitutions) activeParams.set("missingSubstitutions", params.missingSubstitutions);

  const recipesWithMeta = (recipes || []).map((item) => {
    const meta = recipeMetaMap.get(item.id);
    return {
      ...item,
      image_urls: meta?.image_urls || [],
      nutrition: meta?.nutrition || { per_serving: {}, per_100g: {} },
      substitutions: meta?.substitutions || [],
    };
  });
  const filteredRecipes = recipesWithMeta.filter((item) => {
    if (params.hasImage === "1" && item.image_urls.length === 0) return false;
    if (params.missingNutrition === "1" && Object.keys(item.nutrition?.per_serving || {}).length > 0) return false;
    if (params.missingSubstitutions === "1" && Array.isArray(item.substitutions) && item.substitutions.length > 0) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {tr(lang, "Control overview", "Przegląd panelu")}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {tr(lang, "Monitor recipe flow and act quickly on pending work.", "Monitoruj przepływ przepisów i szybko reaguj na zadania.")}
            </p>
          </div>
          <ExportPublishedPackButton language={params.language} cuisine={params.cuisine} />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200/70 bg-white/60 p-3 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tr(lang, "Drafts", "Szkice")}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{draftCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-white/60 p-3 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tr(lang, "In review", "W recenzji")}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{reviewCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-white/60 p-3 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tr(lang, "Published", "Opublikowane")}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{publishedCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-white/60 p-3 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tr(lang, "System", "System")}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{tr(lang, "Connection ready", "Połączenie gotowe")}</p>
            <p className="text-xs text-slate-500">{tr(lang, "Export + filters available", "Eksport i filtry dostępne")}</p>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold text-slate-800">{tr(lang, "Last updated recipes", "Ostatnio aktualizowane przepisy")}</h2>
          {recentRecipes.length === 0 ? (
            <p className="text-sm text-slate-500">{tr(lang, "No recipes yet. Create your first recipe to start workflow tracking.", "Brak przepisów. Dodaj pierwszy przepis, aby rozpocząć pracę.")}</p>
          ) : (
            <div className="space-y-1.5">
              {recentRecipes.map((item) => (
                <Link
                  key={item.id}
                  href={`/recipes/${item.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <RecipeThumbnail imageUrl={recipeMetaMap.get(item.id)?.image_urls?.[0] || null} title={item.title} size="sm" />
                    <span className="truncate text-sm text-slate-700">
                      {item.title} <span className="text-slate-400">· {item.language}</span>
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{new Date(item.updated_at).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{tr(lang, "Recipe management", "Zarządzanie przepisami")}</h2>
            <p className="text-sm text-slate-600">{tr(lang, "Use quick controls to narrow results before opening a recipe.", "Użyj szybkich filtrów, aby zawęzić listę przed edycją przepisu.")}</p>
          </div>
          <Link href={buildHref(activeParams, { mine: params.mine === "1" ? null : "1" })}>
            <Button type="button" variant={params.mine === "1" ? "primary" : "secondary"} size="sm">
              {tr(lang, "My drafts", "Moje szkice")}
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-medium uppercase tracking-wide text-slate-500">{tr(lang, "Status", "Status")}</span>
            {(["draft", "in_review", "published", "archived"] as RecipeStatus[]).map((status) => {
              const active = params.status === status;
              return (
                <Link key={status} href={buildHref(activeParams, { status: active ? null : status })}>
                  <Button type="button" variant={active ? "primary" : "ghost"} size="sm">
                    {getRecipeStatusLabel(status, lang)}
                  </Button>
                </Link>
              );
            })}
            <Link href={buildHref(activeParams, { status: null })}>
              <Button type="button" variant={!params.status ? "secondary" : "ghost"} size="sm">
                {tr(lang, "all", "wszystkie")}
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-medium uppercase tracking-wide text-slate-500">{tr(lang, "Language", "Język")}</span>
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
                {tr(lang, "all", "wszystkie")}
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-medium uppercase tracking-wide text-slate-500">{tr(lang, "Quality", "Jakość")}</span>
            <Link href={buildHref(activeParams, { hasImage: params.hasImage === "1" ? null : "1" })}>
              <Button type="button" variant={params.hasImage === "1" ? "primary" : "ghost"} size="sm">
                {tr(lang, "Has image", "Ma zdjęcie")}
              </Button>
            </Link>
            <Link href={buildHref(activeParams, { missingNutrition: params.missingNutrition === "1" ? null : "1" })}>
              <Button type="button" variant={params.missingNutrition === "1" ? "primary" : "ghost"} size="sm">
                {tr(lang, "Missing nutrition", "Brak nutrition")}
              </Button>
            </Link>
            <Link href={buildHref(activeParams, { missingSubstitutions: params.missingSubstitutions === "1" ? null : "1" })}>
              <Button type="button" variant={params.missingSubstitutions === "1" ? "primary" : "ghost"} size="sm">
                {tr(lang, "Missing substitutions", "Brak zamienników")}
              </Button>
            </Link>
          </div>
        </div>

        <form className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4">
          <Select name="cuisine" defaultValue={params.cuisine || ""}>
            <option value="">{tr(lang, "All cuisines", "Wszystkie kuchnie")}</option>
            {normalizedSettings.enabled_cuisines.map((cuisine) => (
              <option key={cuisine} value={cuisine}>
                {cuisine}
              </option>
            ))}
          </Select>
          <Input name="search" defaultValue={params.search || ""} placeholder={tr(lang, "Search by recipe title", "Szukaj po nazwie przepisu")} />
          <input type="hidden" name="status" value={params.status || ""} />
          <input type="hidden" name="language" value={params.language || ""} />
          <input type="hidden" name="mine" value={params.mine || ""} />
          <input type="hidden" name="hasImage" value={params.hasImage || ""} />
          <input type="hidden" name="missingNutrition" value={params.missingNutrition || ""} />
          <input type="hidden" name="missingSubstitutions" value={params.missingSubstitutions || ""} />
          <div className="flex items-center gap-2">
            <Button type="submit">{tr(lang, "Apply", "Zastosuj")}</Button>
            <Link href="/dashboard">
              <Button type="button" variant="secondary">
                {tr(lang, "Reset", "Reset")}
              </Button>
            </Link>
          </div>
        </form>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {tr(lang, "Could not load recipes. Please try again.", "Nie udało się pobrać przepisów. Spróbuj ponownie.")}{" "}
            <span className="font-mono text-xs text-red-600/80">({tr(lang, "debug id", "debug id")}: {listDebugId})</span>
          </p>
        ) : null}

        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Recipe", "Przepis")}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Status", "Status")}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Media", "Media")}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "kcal / serving", "kcal / porcja")}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Cuisine", "Kuchnia")}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Languages", "Języki")}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Updated", "Aktualizacja")}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Actions", "Akcje")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecipes.map((recipe) => {
                const recipeId = typeof recipe.id === "string" && recipe.id.trim().length > 0 ? recipe.id : null;
                const servingKcal = (recipe.nutrition?.per_serving as { kcal?: number | null } | undefined)?.kcal;
                if (!recipeId) {
                  console.warn(`[${listDebugId}] Missing recipe.id in dashboard row`, recipe);
                }

                return (
                  <tr key={recipe.id || `${recipe.translation_group_id}-${recipe.updated_at}`} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <RecipeThumbnail imageUrl={recipe.image_urls?.[0] || null} title={recipe.title} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{recipe.title}</p>
                          <p className="text-xs text-slate-500">{recipe.language}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={recipe.status} lang={lang} />
                    </td>
                    <td className="px-4 py-3">
                      {recipe.image_urls?.length ? (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {tr(lang, "Image", "Zdjęcie")}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {tr(lang, "No image", "Brak zdjęcia")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {typeof servingKcal === "number" ? servingKcal : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{recipe.primary_cuisine || "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {(translationMap.get(recipe.translation_group_id) || [recipe.language]).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{new Date(recipe.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {recipeId ? (
                          <Link href={`/recipes/${recipeId}`}>
                            <Button type="button" variant="secondary" size="sm">
                              {tr(lang, "Open", "Otwórz")}
                            </Button>
                          </Link>
                        ) : (
                          // Defensive guard: avoid broken routing when identifier is missing.
                          <Button type="button" variant="secondary" size="sm" disabled>
                            {tr(lang, "Open", "Otwórz")}
                          </Button>
                        )}
                        {profile.role !== "reviewer" && recipeId ? (
                          <Link href={`/recipes/${recipeId}/translations`}>
                            <Button type="button" variant="ghost" size="sm">
                              {tr(lang, "Translations", "Tłumaczenia")}
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecipes.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-slate-500" colSpan={8}>
                    {tr(lang, "No recipes match the current filters. Adjust filters or create a new recipe.", "Brak przepisów dla wybranych filtrów. Zmień filtry lub dodaj nowy przepis.")}
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
