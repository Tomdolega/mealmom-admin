import { ConnectionStatusWidget } from "@/components/connection-status-widget";
import { GlobalSettingsForm } from "@/components/global-settings-form";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { AppSettingsRecord } from "@/lib/types";

export default async function SettingsPage() {
  const [{ supabase, profile }, lang] = await Promise.all([getCurrentProfileOrRedirect(), getServerUILang()]);

  const { data: appSettingsRow } = await supabase
    .from("app_settings")
    .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
    .eq("id", 1)
    .maybeSingle<AppSettingsRecord>();

  const appSettings = normalizeAppSettings(appSettingsRow);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tr(lang, "Settings", "Ustawienia")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(lang, "System configuration used by recipe workflows and language management.", "Konfiguracja systemu używana w workflow przepisów i zarządzaniu językami.")}
        </p>
      </section>

      <ConnectionStatusWidget />

      {profile.role === "admin" ? (
        <GlobalSettingsForm
          initialDefaultLanguage={appSettings.default_language}
          initialEnabledLanguages={appSettings.enabled_languages}
          initialEnabledCuisines={appSettings.enabled_cuisines}
        />
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">{tr(lang, "Global configuration", "Konfiguracja globalna")}</h2>
          <p className="mt-2 text-sm text-slate-600">{tr(lang, "Only admins can edit system-wide settings.", "Tylko administrator może zmieniać ustawienia globalne.")}</p>
        </section>
      )}
    </div>
  );
}
