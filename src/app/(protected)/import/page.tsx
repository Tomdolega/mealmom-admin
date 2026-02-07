import { notFound } from "next/navigation";
import { ImportRecipesPanel } from "@/components/import-recipes-panel";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import type { AppSettingsRecord } from "@/lib/types";

export default async function ImportPage() {
  const { supabase, profile } = await getCurrentProfileOrRedirect();

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import recipes</h1>
        <p className="text-sm text-slate-600">Upload a CSV/XLSX, preview validation, then import valid rows.</p>
      </div>

      <ImportRecipesPanel
        enabledLanguages={normalized.enabled_languages}
        enabledCuisines={normalized.enabled_cuisines}
      />
    </div>
  );
}
