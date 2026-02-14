import { notFound } from "next/navigation";
import { RecipeManagementPanel } from "@/components/recipe-management-panel";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import {
  applyDashboardRecipeListFilters,
  DASHBOARD_RECIPE_LIST_COLUMNS,
  type DashboardRecipeListRow,
} from "@/lib/dashboard-recipe-list";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { LabelRecord, RecipeStatus } from "@/lib/types";

type TrashPageProps = {
  searchParams: Promise<{
    status?: RecipeStatus;
    language?: string;
    search?: string;
    label_id?: string;
    sort?: string;
    dir?: "asc" | "desc";
    page?: string;
    page_size?: string;
  }>;
};

const allowedSortColumns = new Set(["updated_at", "created_at", "title", "status", "language", "deleted_at"]);
const allowedPageSizes = new Set([25, 50, 100]);

export default async function TrashPage({ searchParams }: TrashPageProps) {
  const [{ supabase, session, profile }, params, lang] = await Promise.all([
    getCurrentProfileOrRedirect(),
    searchParams,
    getServerUILang(),
  ]);

  if (profile.role === "reviewer") {
    notFound();
  }

  const pageSizeRaw = Number(params.page_size || 25);
  const pageSize = allowedPageSizes.has(pageSizeRaw) ? pageSizeRaw : 25;
  const page = Math.max(1, Number(params.page || 1));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortColumn = allowedSortColumns.has(params.sort || "") ? (params.sort as string) : "deleted_at";
  const sortAsc = params.dir === "asc";

  const [{ data: labels }, { data: labelLinks }] = await Promise.all([
    supabase
      .from("labels")
      .select("id, name, color, created_at")
      .order("name", { ascending: true })
      .returns<LabelRecord[]>(),
    params.label_id
      ? supabase
          .from("recipe_labels")
          .select("recipe_id")
          .eq("label_id", params.label_id)
          .returns<Array<{ recipe_id: string }>>()
      : Promise.resolve({ data: [] as Array<{ recipe_id: string }> }),
  ]);

  const labelRecipeIds = new Set((labelLinks || []).map((item) => item.recipe_id));
  const debugId = `trash-list-${session.user.id.slice(0, 8)}-${params.status || "all"}-${params.language || "all"}`;

  let countQuery = supabase.from("recipes").select("id", { count: "exact", head: true });
  countQuery = applyDashboardRecipeListFilters(countQuery, params, session.user.id, "trash");
  if (params.label_id && labelRecipeIds.size > 0) countQuery = countQuery.in("id", [...labelRecipeIds]);
  else if (params.label_id && labelRecipeIds.size === 0) countQuery = countQuery.eq("id", "00000000-0000-0000-0000-000000000000");

  let listQuery = supabase
    .from("recipes")
    .select(DASHBOARD_RECIPE_LIST_COLUMNS)
    .order(sortColumn, { ascending: sortAsc })
    .range(from, to);
  listQuery = applyDashboardRecipeListFilters(listQuery, params, session.user.id, "trash");
  if (params.label_id && labelRecipeIds.size > 0) listQuery = listQuery.in("id", [...labelRecipeIds]);
  else if (params.label_id && labelRecipeIds.size === 0) listQuery = listQuery.eq("id", "00000000-0000-0000-0000-000000000000");

  const [{ count: totalCount }, { data: rows, error }] = await Promise.all([
    countQuery,
    listQuery.returns<DashboardRecipeListRow[]>(),
  ]);

  if (error) {
    console.error(`[${debugId}] Trash query failed`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  const recipeIds = (rows || []).map((item) => item.id);
  const [metaRes, recipeLabelRes] = recipeIds.length
    ? await Promise.all([
        supabase
          .from("recipes")
          .select("id, image_urls")
          .in("id", recipeIds)
          .returns<Array<{ id: string; image_urls: string[] | null }>>(),
        supabase
          .from("recipe_labels")
          .select("recipe_id, label_id")
          .in("recipe_id", recipeIds)
          .returns<Array<{ recipe_id: string; label_id: string }>>(),
      ])
    : [{ data: [] as Array<{ id: string; image_urls: string[] | null }> }, { data: [] as Array<{ recipe_id: string; label_id: string }> }];

  const imageMap = new Map<string, string[]>((metaRes.data || []).map((item) => [item.id, item.image_urls || []]));
  const labelsById = new Map((labels || []).map((item) => [item.id, item]));
  const labelMap = new Map<string, LabelRecord[]>();
  for (const item of recipeLabelRes.data || []) {
    const current = labelMap.get(item.recipe_id) || [];
    const label = labelsById.get(item.label_id);
    if (label) labelMap.set(item.recipe_id, [...current, label]);
  }

  const finalRows = (rows || []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    language: row.language,
    updated_at: row.updated_at,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    deleted_by: row.deleted_by,
    primary_cuisine: row.primary_cuisine,
    image_urls: imageMap.get(row.id) || [],
    labels: labelMap.get(row.id) || [],
  }));

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tr(lang, "Trash", "Kosz")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            lang,
            "Soft-deleted recipes stay here until restored or permanently removed.",
            "Miękko usunięte przepisy pozostają tutaj, dopóki nie zostaną przywrócone lub trwale usunięte.",
          )}
        </p>
      </section>

      <RecipeManagementPanel
        rows={finalRows}
        labels={labels || []}
        role={profile.role}
        isTrashView
        page={page}
        pageSize={pageSize}
        totalCount={totalCount || 0}
        errorMessage={
          error
            ? `${tr(lang, "Could not load trash recipes.", "Nie udało się pobrać elementów kosza.")} (${tr(lang, "debug id", "debug id")}: ${debugId})`
            : null
        }
      />
    </div>
  );
}
