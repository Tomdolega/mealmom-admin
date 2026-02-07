import { RecipeForm } from "@/components/recipe-form";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import type { AppSettingsRecord } from "@/lib/types";

type NewRecipeProps = {
  searchParams: Promise<{ translation_group_id?: string; language?: string }>;
};

export default async function NewRecipePage({ searchParams }: NewRecipeProps) {
  const { profile, supabase } = await getCurrentProfileOrRedirect();
  const params = await searchParams;

  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
    .eq("id", 1)
    .maybeSingle<AppSettingsRecord>();

  const normalizedSettings = normalizeAppSettings(appSettings);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Create recipe</h1>
      <RecipeForm
        mode="create"
        role={profile.role}
        translationGroupId={params.translation_group_id}
        language={params.language}
        enabledLanguages={normalizedSettings.enabled_languages}
        enabledCuisines={normalizedSettings.enabled_cuisines}
        defaultLanguage={normalizedSettings.default_language}
      />
    </div>
  );
}
