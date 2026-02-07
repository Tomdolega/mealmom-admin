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
    let query = supabase
      .from("recipes")
      .select(
        "id, translation_group_id, language, title, subtitle, description, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, nutrition, substitutions, image_urls, ingredients, steps, published_at",
      )
      .eq("status", "published")
      .order("title", { ascending: true });

    if (language) query = query.eq("language", language);
    if (cuisine) query = query.or(`primary_cuisine.eq.${cuisine},cuisines.cs.{${cuisine}}`);

    const { data, error: fetchError } = await query;

    setLoading(false);

    if (fetchError) {
      setError(tr(lang, "Could not export right now. Please retry.", "Nie udało się wyeksportować. Spróbuj ponownie."));
      return;
    }

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
