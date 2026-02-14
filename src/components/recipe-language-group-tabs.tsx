"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getLocaleLabel } from "@/lib/translation-config";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type RecipeLanguageVariant = {
  id: string;
  language: string;
  status: string;
};

type RecipeLanguageGroupTabsProps = {
  recipeId: string;
  currentLanguage: string;
  variants: RecipeLanguageVariant[];
  enabledLanguages: string[];
  canManage: boolean;
};

export function RecipeLanguageGroupTabs({
  recipeId,
  currentLanguage,
  variants,
  enabledLanguages,
  canManage,
}: RecipeLanguageGroupTabsProps) {
  const lang = getClientUILang();
  const router = useRouter();
  const [targetLanguage, setTargetLanguage] = useState(enabledLanguages[0] || "pl-PL");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingLanguages = useMemo(() => new Set(variants.map((item) => item.language)), [variants]);
  const missingLanguages = enabledLanguages.filter((item) => !existingLanguages.has(item));

  async function createLanguage(mode: "create_empty" | "copy_from_pl") {
    setCreating(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/recipes/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipeId,
        targetLanguage,
        mode,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      recipeId?: string;
      reused?: boolean;
      copiedFromLanguage?: string;
      note?: string;
    };
    setCreating(false);

    if (!response.ok || !payload.recipeId) {
      setError(payload.error || tr(lang, "Could not create language variant.", "Nie udało się utworzyć wariantu językowego."));
      return;
    }

    setMessage(
      payload.reused
        ? tr(lang, "Language already exists; opened existing variant.", "Język już istnieje; otwarto istniejący wariant.")
        : mode === "copy_from_pl"
          ? tr(
              lang,
              `Created draft by copying from ${payload.copiedFromLanguage || "PL"}.`,
              `Utworzono szkic przez kopiowanie z ${payload.copiedFromLanguage || "PL"}.`,
            )
          : tr(lang, "Created empty language draft.", "Utworzono pusty szkic językowy."),
    );

    router.push(`/recipes/${payload.recipeId}`);
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{tr(lang, "Language variants", "Warianty językowe")}</h2>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              className="w-[170px]"
            >
              {(missingLanguages.length ? missingLanguages : enabledLanguages).map((locale) => {
                const label = getLocaleLabel(locale);
                return (
                  <option key={locale} value={locale}>
                    {label.flag} {locale}
                  </option>
                );
              })}
            </Select>
            <Button type="button" size="sm" variant="secondary" disabled={creating} onClick={() => void createLanguage("create_empty")}>
              {tr(lang, "Add language", "Dodaj język")}
            </Button>
            <Button type="button" size="sm" disabled={creating} onClick={() => void createLanguage("copy_from_pl")}>
              {tr(lang, "Copy from PL", "Kopiuj z PL")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const label = getLocaleLabel(variant.language);
          const active = variant.language === currentLanguage;
          return (
            <Link
              key={variant.id}
              href={`/recipes/${variant.id}`}
              className={
                active
                  ? "inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                  : "inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
              }
            >
              <span>{label.flag}</span>
              <span>{variant.language}</span>
              <span className="text-xs opacity-80">{variant.status}</span>
            </Link>
          );
        })}
      </div>

      {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
