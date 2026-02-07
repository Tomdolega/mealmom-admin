import { cookies } from "next/headers";

export type UILang = "en" | "pl";

export const uiDict: Record<
  UILang,
  {
    nav: {
      dashboard: string;
      newRecipe: string;
      settings: string;
      import: string;
      users: string;
      language: string;
      signOut: string;
    };
  }
> = {
  en: {
    nav: {
      dashboard: "Dashboard",
      newRecipe: "New recipe",
      settings: "Settings",
      import: "Import",
      users: "Users",
      language: "Language",
      signOut: "Sign out",
    },
  },
  pl: {
    nav: {
      dashboard: "Panel",
      newRecipe: "Nowy przepis",
      settings: "Ustawienia",
      import: "Import",
      users: "Użytkownicy",
      language: "Język",
      signOut: "Wyloguj",
    },
  },
};

export function normalizeUILang(value?: string | null): UILang {
  return value === "pl" ? "pl" : "en";
}

export async function getServerUILang(): Promise<UILang> {
  const store = await cookies();
  return normalizeUILang(store.get("ui_lang")?.value);
}

export function getClientUILang(): UILang {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|;\s*)ui_lang=([^;]+)/);
  return normalizeUILang(match?.[1]);
}

export function tr(lang: UILang, en: string, pl: string) {
  return lang === "pl" ? pl : en;
}
