import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

export type PublishedRecipeRow = {
  id: string;
  title: string;
  primary_cuisine: string | null;
  language: string;
  updated_at: string;
  status: "published";
};

export type PublishedRecipesResult = {
  rows: PublishedRecipeRow[];
  error: string | null;
};

type GetPublishedRecipesParams = {
  language?: string;
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
  language,
}: GetPublishedRecipesParams = {}): Promise<PublishedRecipesResult> {
  if (!hasSupabaseEnv()) {
    return {
      rows: [],
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const client = createSupabaseClient(supabaseUrl!, supabaseAnonKey!);
  let query = client
    .from("recipes")
    .select("id, title, primary_cuisine, language, updated_at, status")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (language) {
    query = query.eq("language", language);
  }

  const { data, error } = await query.returns<PublishedRecipeRow[]>();
  if (error) {
    return {
      rows: [],
      error: `Could not load published recipes: ${error.message}`,
    };
  }

  return {
    rows: data ?? [],
    error: null,
  };
}
