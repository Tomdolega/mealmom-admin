import type { AppSettingsRecord } from "@/lib/types";

export const fallbackEnabledLanguages = ["pl", "en", "es", "de", "fr", "pt-PT", "en-GB"];
export const fallbackEnabledCuisines = [
  "Polish",
  "Italian",
  "French",
  "Spanish",
  "Mexican",
  "Indian",
  "Japanese",
];

export const defaultAppSettings: Pick<
  AppSettingsRecord,
  "default_language" | "enabled_languages" | "enabled_cuisines"
> = {
  default_language: "en",
  enabled_languages: fallbackEnabledLanguages,
  enabled_cuisines: fallbackEnabledCuisines,
};

export function normalizeAppSettings(row?: Partial<AppSettingsRecord> | null) {
  return {
    default_language: row?.default_language || defaultAppSettings.default_language,
    enabled_languages:
      row?.enabled_languages && row.enabled_languages.length > 0
        ? row.enabled_languages
        : defaultAppSettings.enabled_languages,
    enabled_cuisines:
      row?.enabled_cuisines && row.enabled_cuisines.length > 0
        ? row.enabled_cuisines
        : defaultAppSettings.enabled_cuisines,
  };
}
