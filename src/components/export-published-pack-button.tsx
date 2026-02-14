"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type ExportButtonProps = {
  language?: string;
  cuisine?: string;
};

export function ExportPublishedPackButton({ language, cuisine }: ExportButtonProps) {
  const lang = getClientUILang();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    let recipeQuery = supabase
      .from("recipes")
      .select(
        "id, translation_group_id, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, nutrition, image_urls, published_at",
      )
      .eq("status", "published")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (cuisine) recipeQuery = recipeQuery.or(`primary_cuisine.eq.${cuisine},cuisines.cs.{${cuisine}}`);

    const { data: recipes, error: recipesError } = await recipeQuery;
    if (recipesError) {
      setLoading(false);
      setError(tr(lang, "Could not export right now. Please retry.", "Nie udało się wyeksportować. Spróbuj ponownie."));
      return;
    }

    const recipeIds = (recipes || []).map((item) => item.id);
    if (recipeIds.length === 0) {
      setLoading(false);
      const payload = JSON.stringify([], null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `published-pack-${language || "all-langs"}-${cuisine || "all-cuisines"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    let translationQuery = supabase
      .from("recipe_translations")
      .select("id, recipe_id, locale, title, short_phrase, joanna_says, ingredients, steps, tips, substitutions, translation_status")
      .in("recipe_id", recipeIds)
      .eq("translation_status", "published");
    if (language) translationQuery = translationQuery.eq("locale", language);
    const { data: translations, error: translationsError } = await translationQuery.order("locale", { ascending: true });

    setLoading(false);

    if (translationsError) {
      setError(tr(lang, "Could not export right now. Please retry.", "Nie udało się wyeksportować. Spróbuj ponownie."));
      return;
    }

    const translationMap = new Map<string, unknown[]>();
    for (const row of translations || []) {
      const current = translationMap.get(row.recipe_id) || [];
      translationMap.set(row.recipe_id, [...current, row]);
    }

    const data = (recipes || []).map((recipe) => ({
      ...recipe,
      translations: translationMap.get(recipe.id) || [],
    }));

    const payload = JSON.stringify(data || [], null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `published-pack-${language || "all-langs"}-${cuisine || "all-cuisines"}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="secondary" onClick={handleExport} disabled={loading}>
        {loading ? tr(lang, "Preparing export...", "Przygotowywanie eksportu...") : tr(lang, "Export published pack", "Eksportuj paczkę opublikowanych")}
      </Button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
