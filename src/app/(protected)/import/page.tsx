import { notFound } from "next/navigation";
import { ImportRecipesPanel } from "@/components/import-recipes-panel";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { AppSettingsRecord } from "@/lib/types";

export default async function ImportPage() {
  const [{ supabase, profile }, lang] = await Promise.all([getCurrentProfileOrRedirect(), getServerUILang()]);

  if (profile.role !== "admin") {
    notFound();
  }

  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
    .eq("id", 1)
    .maybeSingle<AppSettingsRecord>();

  const normalized = normalizeAppSettings(appSettings);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tr(lang, "Import recipes", "Import przepisów")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(lang, "Run imports as a controlled workflow: validate first, inspect preview, then confirm changes.", "Uruchamiaj import jako kontrolowany proces: walidacja, podgląd i dopiero zapis.")}
        </p>
      </section>

      <ImportRecipesPanel enabledLanguages={normalized.enabled_languages} enabledCuisines={normalized.enabled_cuisines} />
    </div>
  );
}
