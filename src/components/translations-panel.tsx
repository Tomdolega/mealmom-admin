"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import type { RecipeStatus } from "@/lib/types";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type TranslationItem = {
  id: string;
  language: string;
  title: string;
  status: RecipeStatus;
  updated_at: string;
};

type TranslationsPanelProps = {
  translationGroupId: string;
  recipes: TranslationItem[];
  enabledLanguages: string[];
  defaultLanguage: string;
  canCreate: boolean;
};

export function TranslationsPanel({
  translationGroupId,
  recipes,
  enabledLanguages,
  defaultLanguage,
  canCreate,
}: TranslationsPanelProps) {
  const lang = getClientUILang();
  const [newLanguage, setNewLanguage] = useState(defaultLanguage);

  const usedLanguages = useMemo(() => recipes.map((item) => item.language), [recipes]);
  const missingLanguages = enabledLanguages.filter((language) => !usedLanguages.includes(language));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-white/70 backdrop-blur-xl">
          <h2 className="text-base font-semibold text-slate-900">{tr(lang, "Create translation", "Utwórz tłumaczenie")}</h2>
          <p className="mt-1 text-sm text-slate-600">{tr(lang, "Create a new language record in this translation group.", "Dodaj nową wersję językową w tej grupie tłumaczeń.")}</p>
          {canCreate ? (
            <div className="mt-3 flex gap-2">
              <Select value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)}>
                {(missingLanguages.length ? missingLanguages : enabledLanguages).map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </Select>
              <Link href={`/recipes/new?translation_group_id=${translationGroupId}&language=${encodeURIComponent(newLanguage)}`}>
                <Button type="button">{tr(lang, "Create", "Utwórz")}</Button>
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">{tr(lang, "Reviewer mode: translations are read-only.", "Tryb recenzenta: tłumaczenia są tylko do odczytu.")}</p>
          )}
        </Card>

        <Card className="bg-white/70 backdrop-blur-xl">
          <h2 className="text-base font-semibold text-slate-900">{tr(lang, "Missing languages", "Brakujące języki")}</h2>
          <p className="mt-1 text-sm text-slate-600">{tr(lang, "Enabled languages not yet present in this group.", "Aktywne języki, których jeszcze nie ma w tej grupie.")}</p>
          {missingLanguages.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">{tr(lang, "No missing languages.", "Brak brakujących języków.")}</p>
          ) : canCreate ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {missingLanguages.map((language) => (
                <Link
                  key={language}
                  href={`/recipes/new?translation_group_id=${translationGroupId}&language=${encodeURIComponent(language)}`}
                >
                  <Button type="button" variant="secondary" size="sm">
                    {tr(lang, "Create", "Utwórz")} {language}
                  </Button>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">{tr(lang, "Missing", "Brakuje")}: {missingLanguages.join(", ")}</p>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto bg-white/70 p-0 backdrop-blur-xl">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Language", "Język")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Title", "Tytuł")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Status", "Status")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Updated", "Aktualizacja")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Action", "Akcja")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recipes.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.language}</td>
                <td className="px-4 py-3">{item.title}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">{new Date(item.updated_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Link href={`/recipes/${item.id}`}>
                    <Button type="button" variant="secondary" size="sm">
                      {tr(lang, "Open", "Otwórz")}
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
            {recipes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-sm text-slate-500">
                  {tr(lang, "No translations found in this group yet.", "Brak tłumaczeń w tej grupie.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
