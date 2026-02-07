"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import type { RecipeStatus } from "@/lib/types";

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
};

export function TranslationsPanel({
  translationGroupId,
  recipes,
  enabledLanguages,
  defaultLanguage,
}: TranslationsPanelProps) {
  const [newLanguage, setNewLanguage] = useState(defaultLanguage);

  const usedLanguages = useMemo(() => recipes.map((item) => item.language), [recipes]);
  const available = enabledLanguages.filter((language) => !usedLanguages.includes(language));

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold">Create new translation</h2>
        <p className="mt-1 text-sm text-slate-600">Open recipe form in the same translation group.</p>
        <div className="mt-3 flex gap-2">
          <Select value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)}>
            {(available.length ? available : enabledLanguages).map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </Select>
          <Link href={`/recipes/new?translation_group_id=${translationGroupId}&language=${encodeURIComponent(newLanguage)}`}>
            <Button type="button">Create translation</Button>
          </Link>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Language</th>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {recipes.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.language}</td>
                <td className="px-4 py-3">{item.title}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">{new Date(item.updated_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Link href={`/recipes/${item.id}`}>
                    <Button type="button" variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
