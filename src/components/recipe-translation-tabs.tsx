"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getLocaleLabel } from "@/lib/translation-config";
import type { IngredientItem, IngredientSubstitution, ProfileRole, RecipeTranslationRecord, TranslationStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type TranslationDraft = {
  id?: string;
  recipe_id: string;
  locale: string;
  title: string;
  short_phrase: string;
  joanna_says: string;
  ingredientsText: string;
  stepsText: string;
  substitutionsText: string;
  tips: string;
  translation_status: TranslationStatus;
};

type RecipeTranslationTabsProps = {
  recipeId: string;
  role: ProfileRole;
  enabledLocales: string[];
  defaultLocale: string;
  canGenerateTranslation: boolean;
  initialTranslations: RecipeTranslationRecord[];
};

function ingredientRowsToText(rows: IngredientItem[] = []) {
  return rows
    .map((row) => [row.name || "", row.amount || "", row.unit || "", row.note || ""].join(" | "))
    .join("\n");
}

function stepsRowsToText(rows: Array<{ text: string }> = []) {
  return rows.map((row) => row.text || "").join("\n");
}

function substitutionsRowsToText(rows: IngredientSubstitution[] = []) {
  return rows
    .flatMap((row) =>
      (row.alternatives || []).map((alt) =>
        [
          row.ingredient_key || "",
          alt.alt_name || "",
          alt.ratio || "",
          alt.note || "",
          (alt.dietary_tags || []).join(","),
        ].join(" | "),
      ),
    )
    .join("\n");
}

function parseIngredientsText(value: string): IngredientItem[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", amount = "", unit = "", note = ""] = line.split("|").map((part) => part.trim());
      return { name, amount, unit, note };
    })
    .filter((item) => item.name.length > 0);
}

function parseStepsText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      step_number: index + 1,
      text,
      timer_seconds: null,
    }));
}

function parseSubstitutionsText(value: string): IngredientSubstitution[] {
  const grouped = new Map<string, IngredientSubstitution>();
  for (const line of value.split("\n").map((item) => item.trim()).filter(Boolean)) {
    const [ingredientKeyRaw = "", altNameRaw = "", ratioRaw = "", noteRaw = "", tagsRaw = ""] = line
      .split("|")
      .map((part) => part.trim());
    if (!ingredientKeyRaw || !altNameRaw) continue;
    const current = grouped.get(ingredientKeyRaw) || {
      ingredient_key: ingredientKeyRaw,
      alternatives: [],
    };
    current.alternatives.push({
      alt_name: altNameRaw,
      ratio: ratioRaw || undefined,
      note: noteRaw || undefined,
      dietary_tags: tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    grouped.set(ingredientKeyRaw, current);
  }
  return [...grouped.values()];
}

function draftFromRecord(record: RecipeTranslationRecord): TranslationDraft {
  return {
    id: record.id,
    recipe_id: record.recipe_id,
    locale: record.locale,
    title: record.title || "",
    short_phrase: record.short_phrase || "",
    joanna_says: record.joanna_says || "",
    ingredientsText: ingredientRowsToText(record.ingredients || []),
    stepsText: stepsRowsToText(record.steps || []),
    substitutionsText: substitutionsRowsToText(record.substitutions || []),
    tips: record.tips || "",
    translation_status: record.translation_status,
  };
}

function cloneFromSource(
  source: TranslationDraft | undefined,
  recipeId: string,
  locale: string,
): TranslationDraft {
  if (!source) {
    return {
      recipe_id: recipeId,
      locale,
      title: "",
      short_phrase: "",
      joanna_says: "",
      ingredientsText: "",
      stepsText: "",
      substitutionsText: "",
      tips: "",
      translation_status: "draft",
    };
  }

  return {
    ...source,
    id: undefined,
    recipe_id: recipeId,
    locale,
    translation_status: "draft",
  };
}

export function RecipeTranslationTabs({
  recipeId,
  role,
  enabledLocales,
  defaultLocale,
  canGenerateTranslation,
  initialTranslations,
}: RecipeTranslationTabsProps) {
  const lang = getClientUILang();
  const canEdit = role !== "reviewer";

  const [items, setItems] = useState<TranslationDraft[]>(
    initialTranslations.length
      ? initialTranslations.map(draftFromRecord)
      : [
          {
            recipe_id: recipeId,
            locale: defaultLocale,
            title: "",
            short_phrase: "",
            joanna_says: "",
            ingredientsText: "",
            stepsText: "",
            substitutionsText: "",
            tips: "",
            translation_status: "draft",
          },
        ],
  );
  const [activeLocale, setActiveLocale] = useState(items[0]?.locale || defaultLocale);
  const [newLocale, setNewLocale] = useState(defaultLocale);
  const [sourceLocale, setSourceLocale] = useState(defaultLocale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeItem = useMemo(
    () => items.find((item) => item.locale === activeLocale),
    [activeLocale, items],
  );
  const missingLocales = useMemo(
    () => enabledLocales.filter((locale) => !items.some((item) => item.locale === locale)),
    [enabledLocales, items],
  );

  function updateActive(patch: Partial<TranslationDraft>) {
    setItems((prev) => prev.map((item) => (item.locale === activeLocale ? { ...item, ...patch } : item)));
  }

  async function saveActive() {
    if (!activeItem) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const payload = {
      recipe_id: recipeId,
      locale: activeItem.locale,
      title: activeItem.title.trim() || null,
      short_phrase: activeItem.short_phrase.trim() || null,
      joanna_says: activeItem.joanna_says.trim() || null,
      ingredients: parseIngredientsText(activeItem.ingredientsText),
      steps: parseStepsText(activeItem.stepsText),
      tips: activeItem.tips.trim() || null,
      substitutions: parseSubstitutionsText(activeItem.substitutionsText),
      translation_status: activeItem.translation_status,
    };

    const { data, error: upsertError } = await supabase
      .from("recipe_translations")
      .upsert(payload, { onConflict: "recipe_id,locale" })
      .select("id, recipe_id, locale, title, short_phrase, joanna_says, ingredients, steps, tips, substitutions, translation_status, created_at, updated_at")
      .maybeSingle<RecipeTranslationRecord>();

    setLoading(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    if (data) {
      setItems((prev) => prev.map((item) => (item.locale === activeItem.locale ? draftFromRecord(data) : item)));
    }
    setMessage(tr(lang, "Translation saved.", "Tłumaczenie zapisane."));
  }

  async function generateTranslation() {
    if (!activeItem || activeItem.locale === sourceLocale) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/recipes/translations/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipeId,
        sourceLocale,
        targetLocale: activeItem.locale,
      }),
    });
    const payload = (await response.json()) as { error?: string; translation?: RecipeTranslationRecord };
    setLoading(false);

    if (!response.ok || !payload.translation) {
      setError(payload.error || tr(lang, "Could not generate translation.", "Nie udało się wygenerować tłumaczenia."));
      return;
    }

    setItems((prev) => {
      const exists = prev.some((item) => item.locale === payload.translation!.locale);
      if (exists) return prev.map((item) => (item.locale === payload.translation!.locale ? draftFromRecord(payload.translation!) : item));
      return [...prev, draftFromRecord(payload.translation!)];
    });
    setMessage(tr(lang, "Translation generated as draft.", "Tłumaczenie wygenerowane jako szkic."));
  }

  function addLanguage() {
    if (!newLocale || items.some((item) => item.locale === newLocale)) return;
    const source = items.find((item) => item.locale === sourceLocale);
    const draft = cloneFromSource(source, recipeId, newLocale);
    setItems((prev) => [...prev, draft]);
    setActiveLocale(newLocale);
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          {tr(lang, "Language translations", "Tłumaczenia językowe")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={newLocale} onChange={(event) => setNewLocale(event.target.value)} className="w-[150px]">
            {(missingLocales.length ? missingLocales : enabledLocales).map((locale) => (
              <option key={locale} value={locale}>
                {getLocaleLabel(locale).flag} {locale}
              </option>
            ))}
          </Select>
          <Select value={sourceLocale} onChange={(event) => setSourceLocale(event.target.value)} className="w-[170px]">
            {items.map((item) => (
              <option key={`source-${item.locale}`} value={item.locale}>
                {tr(lang, "From", "Z")} {item.locale}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" variant="secondary" disabled={!canEdit} onClick={addLanguage}>
            {tr(lang, "Add language", "Dodaj język")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {items.map((item) => {
          const label = getLocaleLabel(item.locale);
          const active = item.locale === activeLocale;
          return (
            <button
              key={item.locale}
              type="button"
              onClick={() => setActiveLocale(item.locale)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span>{label.flag}</span>
              <span>{item.locale}</span>
              <span className="text-xs opacity-80">{item.translation_status}</span>
            </button>
          );
        })}
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      {activeItem ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={activeItem.title}
              onChange={(event) => updateActive({ title: event.target.value })}
              placeholder={tr(lang, "Title", "Tytuł")}
              disabled={!canEdit}
            />
            <Select
              value={activeItem.translation_status}
              onChange={(event) => updateActive({ translation_status: event.target.value as TranslationStatus })}
              disabled={!canEdit && role !== "reviewer"}
            >
              <option value="draft">{tr(lang, "Draft", "Szkic")}</option>
              <option value="in_review">{tr(lang, "In review", "W recenzji")}</option>
              <option value="published">{tr(lang, "Published", "Opublikowany")}</option>
            </Select>
          </div>
          <Input
            value={activeItem.short_phrase}
            onChange={(event) => updateActive({ short_phrase: event.target.value })}
            placeholder={tr(lang, "Short phrase", "Krótka fraza")}
            disabled={!canEdit}
          />
          <Textarea
            value={activeItem.joanna_says}
            onChange={(event) => updateActive({ joanna_says: event.target.value })}
            placeholder={tr(lang, "Joanna says", "Joanna mówi")}
            disabled={!canEdit}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">{tr(lang, "Ingredients", "Składniki")}</p>
              <Textarea
                value={activeItem.ingredientsText}
                onChange={(event) => updateActive({ ingredientsText: event.target.value })}
                disabled={!canEdit}
                className="min-h-36"
                placeholder={tr(
                  lang,
                  "One line: name | amount | unit | note",
                  "Jedna linia: nazwa | ilość | jednostka | notatka",
                )}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">{tr(lang, "Steps", "Kroki")}</p>
              <Textarea
                value={activeItem.stepsText}
                onChange={(event) => updateActive({ stepsText: event.target.value })}
                disabled={!canEdit}
                className="min-h-36"
                placeholder={tr(lang, "One line per step", "Jedna linia na krok")}
              />
            </div>
          </div>
          <Textarea
            value={activeItem.tips}
            onChange={(event) => updateActive({ tips: event.target.value })}
            placeholder={tr(lang, "Tips", "Wskazówki")}
            disabled={!canEdit}
            className="min-h-24"
          />
          <Textarea
            value={activeItem.substitutionsText}
            onChange={(event) => updateActive({ substitutionsText: event.target.value })}
            disabled={!canEdit}
            className="min-h-24"
            placeholder={tr(
              lang,
              "One line: ingredient_key | alternative | ratio | note | tags(comma)",
              "Jedna linia: ingredient_key | zamiennik | proporcja | notatka | tagi(przecinki)",
            )}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveActive()} disabled={loading || (!canEdit && role !== "reviewer")}>
              {loading ? tr(lang, "Saving...", "Zapisywanie...") : tr(lang, "Save translation", "Zapisz tłumaczenie")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || !canGenerateTranslation || !canEdit || activeItem.locale === sourceLocale}
              onClick={() => void generateTranslation()}
            >
              {tr(lang, "Generate translation", "Generuj tłumaczenie")}
            </Button>
            {!canGenerateTranslation ? (
              <span className="text-xs text-slate-500">
                {tr(lang, "No translation API key configured. Use Add language + copy from source.", "Brak klucza API tłumaczeń. Użyj Dodaj język + kopiowanie ze źródła.")}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
