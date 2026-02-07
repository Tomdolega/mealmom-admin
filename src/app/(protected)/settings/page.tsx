import { ConnectionStatusWidget } from "@/components/connection-status-widget";
import { GlobalSettingsForm } from "@/components/global-settings-form";
import { UserSettingsForm } from "@/components/user-settings-form";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { AppSettingsRecord, UserSettingsRecord } from "@/lib/types";

export default async function SettingsPage() {
  const [{ supabase, profile, session }, lang] = await Promise.all([getCurrentProfileOrRedirect(), getServerUILang()]);

  const { data: appSettingsRow } = await supabase
    .from("app_settings")
    .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
    .eq("id", 1)
    .maybeSingle<AppSettingsRecord>();

  const appSettings = normalizeAppSettings(appSettingsRow);

  const { data: userSettingsRow } = await supabase
    .from("user_settings")
    .select("user_id, preferred_language, preferred_cuisines, ui_density, created_at, updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle<UserSettingsRecord>();

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tr(lang, "Settings", "Ustawienia")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(lang, "Personal preferences and system configuration for the admin workspace.", "Preferencje użytkownika i konfiguracja systemu panelu administracyjnego.")}
        </p>
      </section>

      <ConnectionStatusWidget />

      <div className="grid gap-5 lg:grid-cols-2">
        <UserSettingsForm
          userId={session.user.id}
          enabledLanguages={appSettings.enabled_languages}
          enabledCuisines={appSettings.enabled_cuisines}
          initial={{
            preferred_language: userSettingsRow?.preferred_language || appSettings.default_language,
            preferred_cuisines: userSettingsRow?.preferred_cuisines || [],
            ui_density: userSettingsRow?.ui_density || "comfortable",
          }}
        />

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
    </div>
  );
}
