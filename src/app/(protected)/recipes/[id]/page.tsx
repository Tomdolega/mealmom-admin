import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form";
import { Button } from "@/components/ui/button";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import type { AppSettingsRecord, RecipeRecord } from "@/lib/types";

type RecipeEditProps = {
  params: Promise<{ id: string }>;
};

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
