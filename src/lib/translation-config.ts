export const DEFAULT_TRANSLATION_LOCALE = "pl-PL";

// If true, feed can fallback to DEFAULT_TRANSLATION_LOCALE when requested locale is unavailable.
export const ALLOW_FEED_LOCALE_FALLBACK = true;

export const LOCALE_LABELS: Record<string, { name: string; flag: string }> = {
  "pl-PL": { name: "Polski (Polska)", flag: "🇵🇱" },
  "en-GB": { name: "English (UK)", flag: "🇬🇧" },
  "en-US": { name: "English (US)", flag: "🇺🇸" },
  "es-ES": { name: "Español (España)", flag: "🇪🇸" },
  "de-DE": { name: "Deutsch (Deutschland)", flag: "🇩🇪" },
  "fr-FR": { name: "Français (France)", flag: "🇫🇷" },
  "pt-PT": { name: "Português (Portugal)", flag: "🇵🇹" },
};

export function getLocaleLabel(locale: string) {
  return LOCALE_LABELS[locale] || { name: locale, flag: "🌐" };
}
