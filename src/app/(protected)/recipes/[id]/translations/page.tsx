import { notFound } from "next/navigation";
import { TranslationsPanel } from "@/components/translations-panel";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import type { AppSettingsRecord, RecipeRecord } from "@/lib/types";

type RecipeTranslationsProps = {
  params: Promise<{ id: string }>;
};

type TranslationListItem = Pick<RecipeRecord, "id" | "language" | "title" | "status" | "updated_at">;

export default async function RecipeTranslationsPage({ params }: RecipeTranslationsProps) {
  const { supabase, profile } = await getCurrentProfileOrRedirect();
  const { id } = await params;

  const [{ data: rootRecipe }, { data: appSettings }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, translation_group_id")
      .eq("id", id)
      .maybeSingle<{ id: string; translation_group_id: string }>(),
    supabase
      .from("app_settings")
      .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
      .eq("id", 1)
      .maybeSingle<AppSettingsRecord>(),
  ]);

  if (!rootRecipe) {
    notFound();
  }

  const { data: translations } = await supabase
    .from("recipes")
    .select("id, language, title, status, updated_at")
    .eq("translation_group_id", rootRecipe.translation_group_id)
    .order("language", { ascending: true })
    .returns<TranslationListItem[]>();

  const normalizedSettings = normalizeAppSettings(appSettings);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Translations</h1>
        <p className="mt-1 text-sm text-slate-600">Track language coverage and create missing variants.</p>
      </section>
      <TranslationsPanel
        translationGroupId={rootRecipe.translation_group_id}
        recipes={translations || []}
        enabledLanguages={normalizedSettings.enabled_languages}
        defaultLanguage={normalizedSettings.default_language}
        canCreate={profile.role !== "reviewer"}
      />
    </div>
  );
}
