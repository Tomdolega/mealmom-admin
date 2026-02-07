"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ExportButtonProps = {
  language?: string;
  cuisine?: string;
};

export function ExportPublishedPackButton({ language, cuisine }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    let query = supabase
      .from("recipes")
      .select(
        "id, translation_group_id, language, title, subtitle, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, ingredients, steps, published_at",
      )
      .eq("status", "published")
      .order("title", { ascending: true });

    if (language) query = query.eq("language", language);
    if (cuisine) query = query.or(`primary_cuisine.eq.${cuisine},cuisines.cs.{${cuisine}}`);

    const { data, error: fetchError } = await query;

    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
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
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? "Exporting..." : "Export published pack"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
