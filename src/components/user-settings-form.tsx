"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UiDensity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { OrderedCuisinesEditor } from "@/components/ordered-cuisines-editor";

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
      setMessage("Could not save preferences. Please try again.");
      return;
    }

    setMessage("Preferences saved.");
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Personal preferences</h2>
        <p className="mt-1 text-sm text-slate-600">Customize your default language, cuisine order, and editor density.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Preferred language">
          <Select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)}>
            {enabledLanguages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="UI density">
          <Select value={uiDensity} onChange={(e) => setUiDensity(e.target.value as UiDensity)}>
            <option value="comfortable">comfortable</option>
            <option value="compact">compact</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Preferred cuisines (ordered)">
        <OrderedCuisinesEditor available={enabledCuisines} value={preferredCuisines} onChange={setPreferredCuisines} />
      </FormField>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </section>
  );
}
