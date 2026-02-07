"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      setMessage(error.message);
      return;
    }

    setDefaultLanguage(normalizedDefault);
    setMessage("Global settings saved.");
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">Global settings (admin)</h2>
      <FormField label="Enabled languages" hint="Comma-separated values, e.g. pl, en, es, de">
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
      <FormField label="Enabled cuisines" hint="Comma-separated values, e.g. Polish, Italian, French">
        <Input value={enabledCuisinesText} onChange={(e) => setEnabledCuisinesText(e.target.value)} />
      </FormField>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      <Button type="button" onClick={saveGlobalSettings} disabled={saving}>
        {saving ? "Saving..." : "Save global settings"}
      </Button>
    </Card>
  );
}
