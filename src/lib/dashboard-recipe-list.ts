import type { RecipeStatus } from "@/lib/types";

type DashboardQueryParams = {
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
};

export type DashboardRecipeListRow = {
  id: string;
  translation_group_id: string;
  title: string;
  status: RecipeStatus;
  primary_cuisine: string | null;
  cuisines: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  difficulty?: string | null;
  total_minutes?: number | null;
  nutrition_summary?: unknown;
};

// Keep dashboard list intentionally flat and schema-stable (no joins, no optional migrated columns).
export const DASHBOARD_RECIPE_LIST_COLUMNS =
  "id, title, status, created_at, updated_at, translation_group_id, created_by, primary_cuisine, cuisines, deleted_at, deleted_by, difficulty, total_minutes, nutrition_summary";

function buildCuisineOrFilter(cuisine: string) {
  const escaped = cuisine.replaceAll('"', '\\"');
  return `primary_cuisine.eq."${escaped}",cuisines.cs.{"${escaped}"}`;
}

function buildTagContainsFilter(tag: string) {
  const escaped = tag.replaceAll('"', '\\"');
  return `{"${escaped}"}`;
}

type DashboardFilterQuery<T> = {
  eq: (column: string, value: string) => T;
  in: (column: string, values: string[]) => T;
  ilike: (column: string, pattern: string) => T;
  or: (filters: string) => T;
  not: (column: string, operator: string, value: string) => T;
  filter: (column: string, operator: string, value: string) => T;
};

export function applyDashboardRecipeListFilters<T extends DashboardFilterQuery<T>>(
  query: T,
  params: DashboardQueryParams,
  userId: string,
  view: "active" | "trash" = "active",
) {
  let nextQuery = query;

  if (view === "trash") nextQuery = nextQuery.not("deleted_at", "is", "null");
  else nextQuery = nextQuery.filter("deleted_at", "is", "null");
  if (params.status) nextQuery = nextQuery.eq("status", params.status);
  else if (view === "active") nextQuery = nextQuery.in("status", ["draft", "published"]);
  if (params.mine === "1") {
    nextQuery = nextQuery.eq("created_by", userId);
    nextQuery = nextQuery.eq("status", "draft");
  }
  if (params.search) nextQuery = nextQuery.ilike("title", `%${params.search}%`);
  if (params.tag) nextQuery = nextQuery.filter("tags", "cs", buildTagContainsFilter(params.tag));
  if (params.cuisine) nextQuery = nextQuery.or(buildCuisineOrFilter(params.cuisine));
  if (params.difficulty) nextQuery = nextQuery.eq("difficulty", params.difficulty);
  if (params.time_from) nextQuery = nextQuery.filter("total_minutes", "gte", params.time_from);
  if (params.time_to) nextQuery = nextQuery.filter("total_minutes", "lte", params.time_to);
  if (params.has_nutrition === "1") nextQuery = nextQuery.not("nutrition_summary", "is", "null");

  return nextQuery;
}
