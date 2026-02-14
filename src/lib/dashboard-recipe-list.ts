import type { RecipeStatus } from "@/lib/types";

type DashboardQueryParams = {
  status?: RecipeStatus;
  language?: string;
  cuisine?: string;
  search?: string;
  mine?: string;
  hasImage?: string;
  missingNutrition?: string;
  missingSubstitutions?: string;
};

export type DashboardRecipeListRow = {
  id: string;
  translation_group_id: string;
  language: string;
  title: string;
  status: RecipeStatus;
  primary_cuisine: string | null;
  cuisines: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

// Keep dashboard list intentionally flat and schema-stable (no joins, no optional migrated columns).
export const DASHBOARD_RECIPE_LIST_COLUMNS =
  "id, title, status, language, created_at, updated_at, translation_group_id, created_by, primary_cuisine, cuisines, deleted_at, deleted_by";

function buildCuisineOrFilter(cuisine: string) {
  const escaped = cuisine.replaceAll('"', '\\"');
  return `primary_cuisine.eq."${escaped}",cuisines.cs.{"${escaped}"}`;
}

type DashboardFilterQuery<T> = {
  eq: (column: string, value: string) => T;
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
  if (params.language) nextQuery = nextQuery.eq("language", params.language);
  if (params.search) nextQuery = nextQuery.ilike("title", `%${params.search}%`);
  if (params.mine === "1") {
    nextQuery = nextQuery.eq("created_by", userId);
    nextQuery = nextQuery.eq("status", "draft");
  }
  if (params.cuisine) nextQuery = nextQuery.or(buildCuisineOrFilter(params.cuisine));

  return nextQuery;
}
