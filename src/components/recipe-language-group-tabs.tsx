"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  currentUpdatedAt?: string | null;
  variants: RecipeLanguageVariant[];
  enabledLanguages: string[];
  canManage: boolean;
};

export function RecipeLanguageGroupTabs({
  recipeId,
  currentLanguage,
  currentUpdatedAt = null,
  variants,
  enabledLanguages,
  canManage,
}: RecipeLanguageGroupTabsProps) {
  const lang = getClientUILang();
  const router = useRouter();
  const allLanguages = enabledLanguages.length > 0 ? enabledLanguages : ["pl", "en"];
  const [activeLanguage, setActiveLanguage] = useState(currentLanguage);
  const [targetLanguage, setTargetLanguage] = useState(allLanguages[0] || "pl");
  const [creating, setCreating] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [lastTranslatedAt, setLastTranslatedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveLanguage(currentLanguage);
  }, [currentLanguage]);

  const existingLanguages = useMemo(() => new Set(variants.map((item) => item.language)), [variants]);
  const variantByLanguage = useMemo(
    () => new Map(variants.map((item) => [item.language, item])),
    [variants],
  );
  const missingLanguages = allLanguages.filter((item) => !existingLanguages.has(item));

  async function createLanguage(mode: "create_empty" | "copy_from_pl", requestedLanguage?: string) {
    setCreating(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/recipes/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipeId,
        targetLanguage: requestedLanguage || targetLanguage,
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

    setActiveLanguage(requestedLanguage || targetLanguage);
    router.push(`/recipes/${payload.recipeId}`);
    router.refresh();
  }

  async function copyFromPL(language: string) {
    const variant = variantByLanguage.get(language);
    if (!variant) return;
    setAutofilling(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipeId: variant.id,
        targetLanguage: language,
        mode: "copy_from_pl",
      }),
    });
    const payload = (await response.json()) as { error?: string; recipeId?: string; translatedAt?: string };
    setAutofilling(false);
    if (!response.ok) {
      setError(payload.error || tr(lang, "Could not copy from PL.", "Nie udało się skopiować z PL."));
      return;
    }
    setMessage(tr(lang, "Copied PL content into this language.", "Skopiowano treść PL do tego języka."));
    setLastTranslatedAt(payload.translatedAt || new Date().toISOString());
    router.refresh();
  }

  async function translateFromPL(language: string) {
    const variant = variantByLanguage.get(language);
    if (!variant) return;
    setTranslating(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipeId: variant.id,
        targetLanguage: language,
        mode: "translate_from_pl",
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      warning?: string | null;
      translatedAt?: string;
      provider?: string;
    };
    setTranslating(false);

    if (!response.ok) {
      setError(payload.error || tr(lang, "Could not translate from PL.", "Nie udało się przetłumaczyć z PL."));
      return;
    }

    setLastTranslatedAt(payload.translatedAt || new Date().toISOString());
    if (payload.warning) {
      setError(payload.warning);
      setMessage(tr(lang, "PL content was copied. Translation provider returned a warning.", "Skopiowano treść PL. Provider tłumaczeń zwrócił ostrzeżenie."));
    } else {
      setMessage(
        tr(
          lang,
          `Translated from PL using ${payload.provider || "provider"}.`,
          `Przetłumaczono z PL przez ${payload.provider || "provider"}.`,
        ),
      );
    }
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
              {(missingLanguages.length ? missingLanguages : allLanguages).map((locale) => {
                const label = getLocaleLabel(locale);
                return (
                  <option key={locale} value={locale}>
                    {label.flag} {label.name}
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
        {allLanguages.map((languageCode) => {
          const variant = variantByLanguage.get(languageCode);
          const label = getLocaleLabel(languageCode);
          const active = languageCode === activeLanguage;

          if (variant) {
            return (
              <Link
                key={variant.id}
                href={`/recipes/${variant.id}`}
                onClick={() => setActiveLanguage(languageCode)}
                className={
                  active
                    ? "inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                    : "inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                }
              >
                <span>{label.flag}</span>
                <span>{label.name}</span>
                <span className="text-xs opacity-80">{variant.status}</span>
              </Link>
            );
          }

          return (
            <button
              key={`missing-${languageCode}`}
              type="button"
              onClick={() => setActiveLanguage(languageCode)}
              className={
                active
                  ? "inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  : "inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              }
            >
              <span>{label.flag}</span>
              <span>{label.name}</span>
              <span className="text-xs">{tr(lang, "missing", "brak")}</span>
            </button>
          );
        })}
      </div>

      {!variantByLanguage.get(activeLanguage) && canManage ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-sm text-slate-700">
            {tr(lang, "This language variant does not exist yet.", "Ten wariant językowy jeszcze nie istnieje.")}
          </p>
          <Button type="button" size="sm" onClick={() => void createLanguage("copy_from_pl", activeLanguage)} disabled={creating}>
            {tr(lang, "Create version", "Utwórz wersję")}
          </Button>
        </div>
      ) : null}

      {variantByLanguage.get(activeLanguage) && canManage && activeLanguage !== "pl" && activeLanguage !== "pl-PL" ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-sm text-slate-700">
            {tr(lang, "Use PL as source: copy fields or run manual translation.", "Użyj PL jako źródła: skopiuj pola albo uruchom ręczne tłumaczenie.")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={autofilling}
            onClick={() => void copyFromPL(activeLanguage)}
          >
            {autofilling ? tr(lang, "Copying...", "Kopiowanie...") : tr(lang, "Copy PL into this language", "Skopiuj PL do tego języka")}
          </Button>
          <Button type="button" size="sm" disabled={translating} onClick={() => void translateFromPL(activeLanguage)}>
            {translating ? tr(lang, "Translating...", "Tłumaczenie...") : tr(lang, "Translate from PL", "Przetłumacz z PL")}
          </Button>
        </div>
      ) : null}

      {variantByLanguage.get(activeLanguage) && activeLanguage !== "pl" && activeLanguage !== "pl-PL" ? (
        <p className="text-xs text-slate-500">
          {tr(lang, "Last translated:", "Ostatnie tłumaczenie:")}{" "}
          {lastTranslatedAt ? new Date(lastTranslatedAt).toLocaleString() : currentUpdatedAt ? new Date(currentUpdatedAt).toLocaleString() : "—"}
        </p>
      ) : null}

      {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
