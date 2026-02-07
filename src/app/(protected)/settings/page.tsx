import { ConnectionStatusWidget } from "@/components/connection-status-widget";
import { GlobalSettingsForm } from "@/components/global-settings-form";
import { UserSettingsForm } from "@/components/user-settings-form";
import { Card } from "@/components/ui/card";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import type { AppSettingsRecord, UserSettingsRecord } from "@/lib/types";

export default async function SettingsPage() {
  const { supabase, profile, session } = await getCurrentProfileOrRedirect();

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-600">Personal preferences and app-level configuration.</p>
      </div>

      <ConnectionStatusWidget />

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
        <Card>
          <p className="text-sm text-slate-600">Global settings can only be edited by admins.</p>
        </Card>
      )}
    </div>
  );
}
