"use client";

import Link from "next/link";
import { useState } from "react";

type TranslationItem = {
  id: string;
  language: string;
  title: string;
  status: string;
  updated_at: string;
};

type TranslationsPanelProps = {
  translationGroupId: string;
  recipes: TranslationItem[];
};

export function TranslationsPanel({ translationGroupId, recipes }: TranslationsPanelProps) {
  const [newLanguage, setNewLanguage] = useState("en");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Create new translation</h2>
        <p className="mt-1 text-sm text-slate-600">
          This will open the recipe form with the same translation group.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={newLanguage}
            onChange={(e) => setNewLanguage(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="e.g. es"
          />
          <Link
            href={`/recipes/new?translation_group_id=${translationGroupId}&language=${encodeURIComponent(newLanguage)}`}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
          >
            Create translation
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Language</th>
              <th className="px-3 py-2 text-left font-medium">Title</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Updated</th>
              <th className="px-3 py-2 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {recipes.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2">{item.language}</td>
                <td className="px-3 py-2">{item.title}</td>
                <td className="px-3 py-2">{item.status}</td>
                <td className="px-3 py-2">{new Date(item.updated_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Link href={`/recipes/${item.id}`} className="text-sm text-blue-700 underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
