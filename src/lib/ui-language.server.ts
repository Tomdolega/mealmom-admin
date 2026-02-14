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
      trash: string;
      language: string;
      signOut: string;
      userDefault: string;
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
      trash: "Trash",
      language: "Language",
      signOut: "Sign out",
      userDefault: "User",
    },
  },
  pl: {
    nav: {
      dashboard: "Panel",
      newRecipe: "Nowy przepis",
      settings: "Ustawienia",
      import: "Import",
      users: "Użytkownicy",
      trash: "Kosz",
      language: "Język",
      signOut: "Wyloguj",
      userDefault: "Użytkownik",
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

export function tr(lang: UILang, en: string, pl: string) {
  return lang === "pl" ? pl : en;
}
