"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type GlobalSettingsFormProps = {
  initialDefaultLanguage: string;
  initialEnabledLanguages: string[];
  initialEnabledCuisines: string[];
};

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function GlobalSettingsForm({
  initialDefaultLanguage,
  initialEnabledLanguages,
  initialEnabledCuisines,
}: GlobalSettingsFormProps) {
  const [enabledLanguagesText, setEnabledLanguagesText] = useState(initialEnabledLanguages.join(", "));
  const [enabledCuisinesText, setEnabledCuisinesText] = useState(initialEnabledCuisines.join(", "));
  const [defaultLanguage, setDefaultLanguage] = useState(initialDefaultLanguage);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const languageOptions = parseCommaList(enabledLanguagesText);

  async function saveGlobalSettings() {
    setSaving(true);
    setMessage(null);

    const enabledLanguages = parseCommaList(enabledLanguagesText);
    const enabledCuisines = parseCommaList(enabledCuisinesText);
    const normalizedDefault = enabledLanguages.includes(defaultLanguage)
      ? defaultLanguage
      : enabledLanguages[0] || "en";

    const supabase = createClient();
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      default_language: normalizedDefault,
      enabled_languages: enabledLanguages,
      enabled_cuisines: enabledCuisines,
    });

    setSaving(false);

    if (error) {
      setMessage("Could not save global settings. Please try again.");
      return;
    }

    setDefaultLanguage(normalizedDefault);
    setMessage("Global settings saved.");
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Global configuration</h2>
        <p className="mt-1 text-sm text-slate-600">These defaults affect all users and recipe workflows.</p>
      </div>

      <FormField label="Enabled languages" hint="Comma-separated list, e.g. pl, en, es, de">
        <Input value={enabledLanguagesText} onChange={(e) => setEnabledLanguagesText(e.target.value)} />
      </FormField>

      <FormField label="Default language">
        <Select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}>
          {languageOptions.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Enabled cuisines" hint="Comma-separated list, e.g. Polish, Italian, French">
        <Input value={enabledCuisinesText} onChange={(e) => setEnabledCuisinesText(e.target.value)} />
      </FormField>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={saveGlobalSettings} disabled={saving}>
          {saving ? "Saving..." : "Save global settings"}
        </Button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </section>
  );
}
