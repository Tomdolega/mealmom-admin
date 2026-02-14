import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { ALLOW_FEED_LOCALE_FALLBACK, DEFAULT_TRANSLATION_LOCALE } from "@/lib/translation-config";

export type PublishedRecipeRow = {
  id: string;
  title: string;
  primary_cuisine: string | null;
  locale: string;
  requested_locale: string;
  is_fallback: boolean;
  description: string | null;
  image_url: string | null;
  total_minutes: number | null;
  difficulty: string | null;
  nutrition_summary: {
    kcal?: number;
    protein_g?: number;
    fat_g?: number;
    carbs_g?: number;
    sugar_g?: number;
    fiber_g?: number;
    salt_g?: number;
    per_serving?: {
      kcal?: number;
      protein_g?: number;
      fat_g?: number;
      carbs_g?: number;
      sugar_g?: number;
      fiber_g?: number;
      salt_g?: number;
    };
  } | null;
  ingredients_preview: Array<{ name: string; amount?: string; unit?: string }>;
  substitutions: unknown[];
  updated_at: string;
};

export type PublishedRecipesResult = {
  rows: PublishedRecipeRow[];
  error: string | null;
};

type GetPublishedRecipesParams = {
  locale?: string;
};

export function getSupabaseUrlHost() {
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return null;
  }
}

export async function getPublishedRecipes({
  locale = DEFAULT_TRANSLATION_LOCALE,
}: GetPublishedRecipesParams = {}): Promise<PublishedRecipesResult> {
  if (!hasSupabaseEnv()) {
    return {
      rows: [],
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const client = createSupabaseClient(supabaseUrl!, supabaseAnonKey!);
  const baseQuery = client
    .from("recipes")
    .select("id, primary_cuisine, updated_at, deleted_at, total_minutes, difficulty, image_urls, nutrition_summary")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  const { data: recipes, error } = await baseQuery.returns<
    Array<{
      id: string;
      primary_cuisine: string | null;
      updated_at: string;
      deleted_at: string | null;
      total_minutes: number | null;
      difficulty: string | null;
      image_urls?: string[] | null;
      nutrition_summary?: PublishedRecipeRow["nutrition_summary"];
    }>
  >();
  if (error) {
    return {
      rows: [],
      error: `Could not load published recipes: ${error.message}`,
    };
  }

  const recipeIds = (recipes || []).map((row) => row.id);
  if (recipeIds.length === 0) return { rows: [], error: null };

  const { data: translations, error: translationsError } = await client
    .from("recipe_translations")
    .select("recipe_id, locale, title, joanna_says, ingredients, substitutions, translation_status")
    .in("recipe_id", recipeIds)
    .eq("translation_status", "published")
    .returns<
      Array<{
        recipe_id: string;
        locale: string;
        title: string | null;
        joanna_says: string | null;
        ingredients: Array<{ name?: string; amount?: string; unit?: string }> | null;
        substitutions: unknown[] | null;
        translation_status: "published";
      }>
    >();

  if (translationsError) {
    return {
      rows: [],
      error: `Could not load published translations: ${translationsError.message}`,
    };
  }

  const translationMap = new Map<
    string,
    Array<{
      recipe_id: string;
      locale: string;
      title: string | null;
      joanna_says: string | null;
      ingredients: Array<{ name?: string; amount?: string; unit?: string }> | null;
      substitutions: unknown[] | null;
    }>
  >();
  for (const item of translations || []) {
    const current = translationMap.get(item.recipe_id) || [];
    translationMap.set(item.recipe_id, [...current, item]);
  }

  const rows: PublishedRecipeRow[] = [];
  for (const recipe of recipes || []) {
    const candidates = translationMap.get(recipe.id) || [];
    const exact = candidates.find((item) => item.locale === locale);
    const fallback = ALLOW_FEED_LOCALE_FALLBACK
      ? candidates.find((item) => item.locale === DEFAULT_TRANSLATION_LOCALE)
      : undefined;
    const chosen = exact || fallback;
    if (!chosen) continue;
    rows.push({
      id: recipe.id,
      title: chosen.title || "",
      primary_cuisine: recipe.primary_cuisine,
      locale: chosen.locale,
      requested_locale: locale,
      is_fallback: !exact && Boolean(fallback),
      description: chosen.joanna_says || null,
      image_url: recipe.image_urls?.[0] || null,
      total_minutes: recipe.total_minutes,
      difficulty: recipe.difficulty,
      nutrition_summary: recipe.nutrition_summary || null,
      ingredients_preview: (chosen.ingredients || [])
        .slice(0, 5)
        .map((item) => ({ name: item.name || "", amount: item.amount, unit: item.unit })),
      substitutions: chosen.substitutions || [],
      updated_at: recipe.updated_at,
    });
  }

  return {
    rows,
    error: null,
  };
}
