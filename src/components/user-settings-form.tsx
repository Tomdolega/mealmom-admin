"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UiDensity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { OrderedCuisinesEditor } from "@/components/ordered-cuisines-editor";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type UserSettingsFormProps = {
  userId: string;
  enabledLanguages: string[];
  enabledCuisines: string[];
  initial: {
    preferred_language: string | null;
    preferred_cuisines: string[];
    ui_density: UiDensity;
  };
};

export function UserSettingsForm({ userId, enabledLanguages, enabledCuisines, initial }: UserSettingsFormProps) {
  const lang = getClientUILang();
  const [preferredLanguage, setPreferredLanguage] = useState(initial.preferred_language || enabledLanguages[0] || "en");
  const [preferredCuisines, setPreferredCuisines] = useState<string[]>(initial.preferred_cuisines || []);
  const [uiDensity, setUiDensity] = useState<UiDensity>(initial.ui_density || "comfortable");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.from("user_settings").upsert({
      user_id: userId,
      preferred_language: preferredLanguage,
      preferred_cuisines: preferredCuisines,
      ui_density: uiDensity,
    });

    setSaving(false);

    if (error) {
      setMessage(tr(lang, "Could not save preferences. Please try again.", "Nie udało się zapisać preferencji. Spróbuj ponownie."));
      return;
    }

    setMessage(tr(lang, "Preferences saved.", "Preferencje zapisane."));
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{tr(lang, "Personal preferences", "Preferencje osobiste")}</h2>
        <p className="mt-1 text-sm text-slate-600">{tr(lang, "Customize your default language, cuisine order, and editor density.", "Dostosuj domyślny język, kolejność kuchni i gęstość interfejsu.")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label={tr(lang, "Preferred language", "Preferowany język")}>
          <Select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)}>
            {enabledLanguages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={tr(lang, "UI density", "Gęstość interfejsu")}>
          <Select value={uiDensity} onChange={(e) => setUiDensity(e.target.value as UiDensity)}>
            <option value="comfortable">{tr(lang, "comfortable", "komfortowa")}</option>
            <option value="compact">{tr(lang, "compact", "zwarta")}</option>
          </Select>
        </FormField>
      </div>

      <FormField label={tr(lang, "Preferred cuisines (ordered)", "Preferowane kuchnie (kolejność)")}>
        <OrderedCuisinesEditor available={enabledCuisines} value={preferredCuisines} onChange={setPreferredCuisines} />
      </FormField>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={saveSettings} disabled={saving}>
          {saving ? tr(lang, "Saving...", "Zapisywanie...") : tr(lang, "Save preferences", "Zapisz preferencje")}
        </Button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </section>
  );
}
