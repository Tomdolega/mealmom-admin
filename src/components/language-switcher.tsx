"use client";

import { useRouter } from "next/navigation";
import type { UILang } from "@/lib/ui-language.client";

type LanguageSwitcherProps = {
  lang: UILang;
  label: string;
};

export function LanguageSwitcher({ lang, label }: LanguageSwitcherProps) {
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span>{label}</span>
      <select
        className="h-10 rounded-md border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
