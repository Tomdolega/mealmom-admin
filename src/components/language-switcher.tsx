"use client";

import { useRouter } from "next/navigation";
import type { UILang } from "@/lib/ui-language";

type LanguageSwitcherProps = {
  lang: UILang;
  label: string;
};

export function LanguageSwitcher({ lang, label }: LanguageSwitcherProps) {
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
      <span>{label}</span>
      <select
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
        value={lang}
        onChange={(event) => {
          const next = event.target.value as UILang;
          document.cookie = `ui_lang=${next}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
      >
        <option value="en">EN</option>
        <option value="pl">PL</option>
      </select>
    </label>
  );
}
