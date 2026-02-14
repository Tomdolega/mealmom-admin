"use client";

import Link from "next/link";
import { RecipeThumbnail } from "@/components/recipe-thumbnail";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getClientUILang, tr } from "@/lib/ui-language.client";
import type { LabelRecord, ProfileRole, RecipeStatus } from "@/lib/types";

export type RecipeManagementRow = {
  id: string;
  title: string;
  status: RecipeStatus;
  language: string;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  primary_cuisine: string | null;
  image_urls: string[];
  labels: LabelRecord[];
};

type RecipeTableProps = {
  rows: RecipeManagementRow[];
  role: ProfileRole;
  isTrashView: boolean;
  selectedIds: string[];
  onToggleSelection: (id: string, index: number, shiftKey: boolean) => void;
  onSingleAction: (action: string, row: RecipeManagementRow) => Promise<void>;
};

export function RecipeTable({
  rows,
  role,
  isTrashView,
  selectedIds,
  onToggleSelection,
  onSingleAction,
}: RecipeTableProps) {
  const lang = getClientUILang();
  const canManage = role === "admin" || role === "editor";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/70">
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((row, index) => {
          const checked = selectedIds.includes(row.id);
          return (
            <article key={`mobile-${row.id}`} className="space-y-3 px-4 py-4">
              <div className="flex items-start gap-3">
                {canManage ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      onToggleSelection(row.id, index, Boolean((event.nativeEvent as MouseEvent).shiftKey))
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                ) : null}
                <RecipeThumbnail imageUrl={row.image_urls[0] || null} title={row.title} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{row.title}</p>
                  <p className="text-xs text-slate-500">{row.language}</p>
                </div>
                <StatusBadge status={row.status} lang={lang} />
              </div>
              <div className="flex flex-wrap gap-2">
                {row.labels.map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {label.name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {tr(lang, "Updated", "Aktualizacja")}: {new Date(row.updated_at).toLocaleString()}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/recipes/${row.id}`} className="flex-1 sm:flex-none">
                  <Button type="button" size="sm" variant="secondary" className="w-full sm:w-auto">
                    {tr(lang, "Open", "Otwórz")}
                  </Button>
                </Link>
                {canManage ? (
                  isTrashView ? (
                    <>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onSingleAction("restore", row)}>
                        {tr(lang, "Restore", "Przywróć")}
                      </Button>
                      {role === "admin" ? (
                        <Button type="button" size="sm" variant="danger" onClick={() => void onSingleAction("delete_permanent", row)}>
                          {tr(lang, "Delete", "Usuń")}
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" onClick={() => void onSingleAction("trash", row)}>
                      {tr(lang, "Trash", "Kosz")}
                    </Button>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">{tr(lang, "No recipes found.", "Nie znaleziono przepisów.")}</div>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {canManage ? <th className="px-3 py-3 text-left font-medium text-slate-600">✓</th> : null}
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Recipe", "Przepis")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Status", "Status")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Labels", "Etykiety")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Language", "Język")}</th>
              {isTrashView ? <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Deleted", "Usunięto")}</th> : null}
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Updated", "Aktualizacja")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Actions", "Akcje")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const checked = selectedIds.includes(row.id);
              return (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  {canManage ? (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          onToggleSelection(row.id, index, Boolean((event.nativeEvent as MouseEvent).shiftKey))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RecipeThumbnail imageUrl={row.image_urls[0] || null} title={row.title} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{row.title}</p>
                        <p className="text-xs text-slate-500">{row.primary_cuisine || "-"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} lang={lang} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.labels.length ? row.labels.map((label) => (
                        <span key={label.id} className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                          {label.name}
                        </span>
                      )) : <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.language}</td>
                  {isTrashView ? (
                    <td className="px-4 py-3 text-xs text-slate-600">{row.deleted_at ? new Date(row.deleted_at).toLocaleString() : "—"}</td>
                  ) : null}
                  <td className="px-4 py-3 text-slate-600">{new Date(row.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/recipes/${row.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          {tr(lang, "Open", "Otwórz")}
                        </Button>
                      </Link>
                      {canManage ? (
                        isTrashView ? (
                          <>
                            <Button type="button" size="sm" variant="ghost" onClick={() => void onSingleAction("restore", row)}>
                              {tr(lang, "Restore", "Przywróć")}
                            </Button>
                            {role === "admin" ? (
                              <Button type="button" size="sm" variant="danger" onClick={() => void onSingleAction("delete_permanent", row)}>
                                {tr(lang, "Delete", "Usuń")}
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <Button type="button" size="sm" variant="ghost" onClick={() => void onSingleAction("trash", row)}>
                            {tr(lang, "Trash", "Kosz")}
                          </Button>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-sm text-slate-500"
                  colSpan={canManage ? (isTrashView ? 8 : 7) : isTrashView ? 7 : 6}
                >
                  {tr(lang, "No recipes found.", "Nie znaleziono przepisów.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
