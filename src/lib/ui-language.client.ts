"use client";

export type UILang = "en" | "pl";

export function normalizeUILang(value?: string | null): UILang {
  return value === "pl" ? "pl" : "en";
}

export function getClientUILang(): UILang {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|;\s*)ui_lang=([^;]+)/);
  return normalizeUILang(match?.[1]);
}

export function getClientUILanguage(): UILang {
  return getClientUILang();
}

export function setClientUILanguage(lang: string) {
  if (typeof document === "undefined") return;
  const normalized = normalizeUILang(lang);
  document.cookie = `ui_lang=${normalized}; path=/; max-age=31536000; samesite=lax`;
}

export function tr(lang: UILang, en: string, pl: string) {
  return lang === "pl" ? pl : en;
}
