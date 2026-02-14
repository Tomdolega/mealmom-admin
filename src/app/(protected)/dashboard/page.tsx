import Link from "next/link";
import { ExportPublishedPackButton } from "@/components/export-published-pack-button";
import { RecipeManagementPanel } from "@/components/recipe-management-panel";
import { RecipeThumbnail } from "@/components/recipe-thumbnail";
import { Button } from "@/components/ui/button";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import {
  applyDashboardRecipeListFilters,
  DASHBOARD_RECIPE_LIST_COLUMNS,
  type DashboardRecipeListRow,
} from "@/lib/dashboard-recipe-list";
import { normalizeAppSettings } from "@/lib/settings";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { AppSettingsRecord, LabelRecord, RecipeRecord, RecipeStatus } from "@/lib/types";

type DashboardProps = {
  searchParams: Promise<{
    status?: RecipeStatus;
    language?: string;
    cuisine?: string;
    search?: string;
    tag?: string;
    difficulty?: string;
    time_from?: string;
    time_to?: string;
    has_nutrition?: string;
    mine?: string;
    hasImage?: string;
    missingNutrition?: string;
    missingSubstitutions?: string;
    label_id?: string;
    sort?: string;
    dir?: "asc" | "desc";
    page?: string;
    page_size?: string;
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

async function getStatusCount(
  supabase: Awaited<ReturnType<typeof getCurrentProfileOrRedirect>>["supabase"],
  status: RecipeStatus,
) {
  const { count } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .is("deleted_at", null);
  return count || 0;
}

const allowedSortColumns = new Set(["updated_at", "created_at", "title", "status", "total_minutes"]);
const allowedPageSizes = new Set([25, 50, 100]);

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const [{ supabase, session, profile }, params, lang] = await Promise.all([
    getCurrentProfileOrRedirect(),
    searchParams,
    getServerUILang(),
  ]);

  const pageSizeRaw = Number(params.page_size || 25);
  const pageSize = allowedPageSizes.has(pageSizeRaw) ? pageSizeRaw : 25;
  const page = Math.max(1, Number(params.page || 1));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortColumn = allowedSortColumns.has(params.sort || "") ? (params.sort as string) : "updated_at";
  const sortAsc = params.dir === "asc";

  const [appSettingsRes, labelsRes, draftCount, reviewCount, publishedCount, recentRes] = await Promise.all([
    supabase
      .from("app_settings")
      .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
      .eq("id", 1)
      .maybeSingle<AppSettingsRecord>(),
    supabase
      .from("labels")
      .select("id, name, color, created_at")
      .order("name", { ascending: true })
      .returns<LabelRecord[]>(),
    getStatusCount(supabase, "draft"),
    getStatusCount(supabase, "in_review"),
    getStatusCount(supabase, "published"),
    supabase
      .from("recipes")
      .select("id, title, status, updated_at, image_urls")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6)
      .returns<Array<Pick<RecipeRecord, "id" | "title" | "status" | "updated_at" | "image_urls">>>(),
  ]);

  const normalizedSettings = normalizeAppSettings(appSettingsRes.data);
  const enabledLanguages = normalizedSettings.enabled_languages;
  const recentRecipes = recentRes.data || [];
  const labels = labelsRes.data || [];
  const defaultLocale = normalizedSettings.default_language.includes("-")
    ? normalizedSettings.default_language
    : normalizedSettings.default_language === "pl"
      ? "pl-PL"
      : normalizedSettings.default_language === "en"
        ? "en-GB"
        : normalizedSettings.default_language;

  const labelRecipeIds = new Set<string>();
  if (params.label_id) {
    const { data: labelLinks } = await supabase
      .from("recipe_labels")
      .select("recipe_id")
      .eq("label_id", params.label_id)
      .returns<Array<{ recipe_id: string }>>();

    for (const item of labelLinks || []) {
      labelRecipeIds.add(item.recipe_id);
    }
  }

  const translationRecipeIds = new Set<string>();
  if (params.language) {
    let translationQuery = supabase.from("recipe_translations").select("recipe_id");
    if (params.language) translationQuery = translationQuery.eq("locale", params.language);
    const { data: translationLinks } = await translationQuery.returns<Array<{ recipe_id: string }>>();
    for (const item of translationLinks || []) {
      translationRecipeIds.add(item.recipe_id);
    }
  }

  const listDebugId = `dash-list-${session.user.id.slice(0, 8)}-${params.status || "all"}-${params.language || "all"}`;

  let countQuery = supabase.from("recipes").select("id", { count: "exact", head: true });
  countQuery = applyDashboardRecipeListFilters(countQuery, params, session.user.id, "active");
  if (params.language && translationRecipeIds.size > 0) {
    countQuery = countQuery.in("id", [...translationRecipeIds]);
  } else if (params.language && translationRecipeIds.size === 0) {
    countQuery = countQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  if (params.label_id && labelRecipeIds.size > 0) {
    countQuery = countQuery.in("id", [...labelRecipeIds]);
  } else if (params.label_id && labelRecipeIds.size === 0) {
    countQuery = countQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  let listQuery = supabase
    .from("recipes")
    .select(DASHBOARD_RECIPE_LIST_COLUMNS)
    .order(sortColumn, { ascending: sortAsc })
    .range(from, to);
  listQuery = applyDashboardRecipeListFilters(listQuery, params, session.user.id, "active");
  if (params.language && translationRecipeIds.size > 0) {
    listQuery = listQuery.in("id", [...translationRecipeIds]);
  } else if (params.language && translationRecipeIds.size === 0) {
    listQuery = listQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  if (params.label_id && labelRecipeIds.size > 0) {
    listQuery = listQuery.in("id", [...labelRecipeIds]);
  } else if (params.label_id && labelRecipeIds.size === 0) {
    listQuery = listQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const [{ count: totalCount }, { data: recipes, error }] = await Promise.all([
    countQuery,
    listQuery.returns<DashboardRecipeListRow[]>(),
  ]);

  if (error) {
    console.error(`[${listDebugId}] Dashboard recipe list query failed`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      filters: params,
    });
  }

  const recipeIds = (recipes || []).map((item) => item.id);
  const labelMap = new Map<string, LabelRecord[]>();
  const imageMap = new Map<string, string[]>();
  const translationsByRecipe = new Map<
    string,
    Array<{ recipe_id: string; locale: string; title: string | null; translation_status: string }>
  >();

  if (recipeIds.length > 0) {
    const [{ data: recipeLabelLinks }, { data: recipeMeta }, { data: translationRows, error: translationRowsError }] =
      await Promise.all([
      supabase
        .from("recipe_labels")
        .select("recipe_id, label_id")
        .in("recipe_id", recipeIds)
        .returns<Array<{ recipe_id: string; label_id: string }>>(),
      supabase
        .from("recipes")
        .select("id, image_urls")
        .in("id", recipeIds)
        .returns<Array<{ id: string; image_urls: string[] | null }>>(),
      supabase
        .from("recipe_translations")
        .select("recipe_id, locale, title, translation_status")
        .in("recipe_id", recipeIds)
        .returns<Array<{ recipe_id: string; locale: string; title: string | null; translation_status: string }>>(),
    ]);

    if (translationRowsError) {
      console.error(`[${listDebugId}] Dashboard translation enrichment failed`, {
        message: translationRowsError.message,
        code: translationRowsError.code,
        details: translationRowsError.details,
        hint: translationRowsError.hint,
      });
    }

    for (const item of recipeMeta || []) imageMap.set(item.id, item.image_urls || []);

    const labelsById = new Map(labels.map((item) => [item.id, item]));
    for (const row of translationRows || []) {
      const current = translationsByRecipe.get(row.recipe_id) || [];
      translationsByRecipe.set(row.recipe_id, [...current, row]);
    }
    for (const item of recipeLabelLinks || []) {
      const next = labelMap.get(item.recipe_id) || [];
      const label = labelsById.get(item.label_id);
      if (label) labelMap.set(item.recipe_id, [...next, label]);
    }
  }

  const enriched = (recipes || []).map((row) => ({
    ...row,
    image_urls: imageMap.get(row.id) || [],
    labels: labelMap.get(row.id) || [],
  }));

  const finalRows = enriched
    .filter((item) => {
      if (params.hasImage === "1" && item.image_urls.length === 0) return false;
      return true;
    })
    .map((item) => {
      const preferredTranslation =
        (translationsByRecipe.get(item.id) || []).find((row) => row.locale === params.language) ||
        (translationsByRecipe.get(item.id) || []).find((row) => row.locale === defaultLocale) ||
        (translationsByRecipe.get(item.id) || [])[0];
        return {
          id: item.id,
          translation_group_id: item.translation_group_id,
          title: preferredTranslation?.title || item.title,
          status: item.status,
          language: preferredTranslation?.locale || "—",
          languages_summary: [...new Set((translationsByRecipe.get(item.id) || []).map((row) => row.locale))],
          updated_at: item.updated_at,
        created_at: item.created_at,
        deleted_at: item.deleted_at,
        deleted_by: item.deleted_by,
          primary_cuisine: item.primary_cuisine,
          image_urls: item.image_urls,
          labels: item.labels,
          nutrition_summary: item.nutrition_summary,
        };
      });
  const sortedRows =
    params.sort === "kcal" || params.sort === "protein"
      ? [...finalRows].sort((a, b) => {
          const field = params.sort === "protein" ? "protein_g" : "kcal";
          const aValue = Number(
            (a.nutrition_summary as { per_serving?: { kcal?: number; protein_g?: number } } | undefined)?.per_serving?.[
              field
            ] || 0,
          );
          const bValue = Number(
            (b.nutrition_summary as { per_serving?: { kcal?: number; protein_g?: number } } | undefined)?.per_serving?.[
              field
            ] || 0,
          );
          return sortAsc ? aValue - bValue : bValue - aValue;
        })
      : finalRows;

  const activeParams = new URLSearchParams();
  if (params.status) activeParams.set("status", params.status);
  if (params.language) activeParams.set("language", params.language);
  if (params.cuisine) activeParams.set("cuisine", params.cuisine);
  if (params.search) activeParams.set("search", params.search);
  if (params.tag) activeParams.set("tag", params.tag);
  if (params.mine) activeParams.set("mine", params.mine);
  if (params.difficulty) activeParams.set("difficulty", params.difficulty);
  if (params.time_from) activeParams.set("time_from", params.time_from);
  if (params.time_to) activeParams.set("time_to", params.time_to);
  if (params.has_nutrition) activeParams.set("has_nutrition", params.has_nutrition);
  if (params.hasImage) activeParams.set("hasImage", params.hasImage);
  if (params.missingNutrition) activeParams.set("missingNutrition", params.missingNutrition);
  if (params.missingSubstitutions) activeParams.set("missingSubstitutions", params.missingSubstitutions);
  if (params.label_id) activeParams.set("label_id", params.label_id);
  if (params.sort) activeParams.set("sort", params.sort);
  if (params.dir) activeParams.set("dir", params.dir);
  if (params.page_size) activeParams.set("page_size", params.page_size);

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
                      <RecipeThumbnail imageUrl={item.image_urls?.[0] || null} title={item.title} size="sm" />
                      <span className="truncate text-sm text-slate-700">
                        {item.title}
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
              <p className="text-sm text-slate-600">{tr(lang, "Email-like list operations: select, bulk update, labels, and trash.", "Operacje jak w skrzynce e-mail: zaznaczanie, akcje zbiorcze, etykiety i kosz.")}</p>
            </div>
            <div className="flex gap-2">
              <Link href={buildHref(activeParams, { mine: params.mine === "1" ? null : "1" })}>
                <Button type="button" variant={params.mine === "1" ? "primary" : "secondary"} size="sm">
                  {tr(lang, "My drafts", "Moje szkice")}
                </Button>
              </Link>
              <Link href="/trash">
                <Button type="button" variant="secondary" size="sm">
                  {tr(lang, "Open Trash", "Otwórz kosz")}
                </Button>
              </Link>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-xs font-medium uppercase tracking-wide text-slate-500">{tr(lang, "Status", "Status")}</span>
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
          </div>

          <RecipeManagementPanel
            rows={sortedRows}
            labels={labels}
            enabledCuisines={normalizedSettings.enabled_cuisines}
            role={profile.role}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount || 0}
            errorMessage={
              error
                ? `${tr(lang, "Could not load recipes. Please try again.", "Nie udało się pobrać przepisów. Spróbuj ponownie.")} (${tr(lang, "debug id", "debug id")}: ${listDebugId})`
                : null
            }
          />
        </section>
    </div>
  );
}
