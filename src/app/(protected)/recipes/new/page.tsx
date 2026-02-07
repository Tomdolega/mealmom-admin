import { RecipeForm } from "@/components/recipe-form";
import { notFound } from "next/navigation";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { AppSettingsRecord } from "@/lib/types";

type NewRecipeProps = {
  searchParams: Promise<{ translation_group_id?: string; language?: string }>;
};

export default async function NewRecipePage({ searchParams }: NewRecipeProps) {
  const [{ profile, supabase }, params, lang] = await Promise.all([getCurrentProfileOrRedirect(), searchParams, getServerUILang()]);

  if (profile.role === "reviewer") {
    notFound();
  }

  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
    .eq("id", 1)
    .maybeSingle<AppSettingsRecord>();

  const normalizedSettings = normalizeAppSettings(appSettings);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tr(lang, "Create recipe", "Nowy przepis")}</h1>
        <p className="mt-1 text-sm text-slate-600">{tr(lang, "Start with core details, then add ingredients and steps.", "Zacznij od szczegółów, a potem dodaj składniki i kroki.")}</p>
      </section>

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
