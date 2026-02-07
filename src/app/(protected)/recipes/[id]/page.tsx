import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import type { AppSettingsRecord, RecipeRecord } from "@/lib/types";

type RecipeEditProps = {
  params: Promise<{ id: string }>;
};

type TranslationSummaryItem = Pick<RecipeRecord, "id" | "language" | "status">;

export default async function RecipeEditPage({ params }: RecipeEditProps) {
  const { supabase, profile } = await getCurrentProfileOrRedirect();
  const { id } = await params;

  const [{ data: recipe, error }, { data: appSettings }] = await Promise.all([
    supabase
      .from("recipes")
      .select(
        "id, translation_group_id, language, title, subtitle, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, ingredients, steps, created_by, updated_by, created_at, updated_at, published_at",
      )
      .eq("id", id)
      .maybeSingle<RecipeRecord>(),
    supabase
      .from("app_settings")
      .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
      .eq("id", 1)
      .maybeSingle<AppSettingsRecord>(),
  ]);

  if (error || !recipe) {
    notFound();
  }

  const { data: translations } = await supabase
    .from("recipes")
    .select("id, language, status")
    .eq("translation_group_id", recipe.translation_group_id)
    .order("language", { ascending: true })
    .returns<TranslationSummaryItem[]>();

  const normalizedSettings = normalizeAppSettings(appSettings);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Edit recipe</h1>
        <Link href={`/recipes/${recipe.id}/translations`}>
          <Button type="button" variant="secondary">
            Manage translations
          </Button>
        </Link>
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Translations summary</h2>
        <div className="flex flex-wrap gap-2">
          {(translations || []).map((translation) => (
            <Link
              key={translation.id}
              href={`/recipes/${translation.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <span>{translation.language}</span>
              <StatusBadge status={translation.status} />
            </Link>
          ))}
        </div>
      </Card>

      <RecipeForm
        mode="edit"
        role={profile.role}
        recipe={recipe}
        enabledLanguages={normalizedSettings.enabled_languages}
        enabledCuisines={normalizedSettings.enabled_cuisines}
        defaultLanguage={normalizedSettings.default_language}
      />
    </div>
  );
}
