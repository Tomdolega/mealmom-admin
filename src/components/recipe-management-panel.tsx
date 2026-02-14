"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { RecipeTable, type RecipeManagementRow } from "@/components/recipe-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getClientUILang, tr } from "@/lib/ui-language.client";
import type { LabelRecord, ProfileRole } from "@/lib/types";

type RecipeManagementPanelProps = {
  rows: RecipeManagementRow[];
  labels: LabelRecord[];
  role: ProfileRole;
  isTrashView?: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  errorMessage?: string | null;
};

const sortOptions = [
  { value: "updated_at.desc", en: "Updated (newest)", pl: "Aktualizacja (najnowsze)" },
  { value: "updated_at.asc", en: "Updated (oldest)", pl: "Aktualizacja (najstarsze)" },
  { value: "created_at.desc", en: "Created (newest)", pl: "Utworzenie (najnowsze)" },
  { value: "created_at.asc", en: "Created (oldest)", pl: "Utworzenie (najstarsze)" },
  { value: "title.asc", en: "Title A-Z", pl: "Tytuł A-Z" },
  { value: "title.desc", en: "Title Z-A", pl: "Tytuł Z-A" },
  { value: "status.asc", en: "Status", pl: "Status" },
];

export function RecipeManagementPanel({
  rows,
  labels: initialLabels,
  role,
  isTrashView = false,
  page,
  pageSize,
  totalCount,
  errorMessage,
}: RecipeManagementPanelProps) {
  const lang = getClientUILang();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canManage = role === "admin" || role === "editor";

  const [labels, setLabels] = useState(initialLabels);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRows = useMemo(
    () => rows.filter((item) => selectedIds.includes(item.id)),
    [rows, selectedIds],
  );
  const allSelectedOnPage = rows.length > 0 && rows.every((item) => selectedIds.includes(item.id));
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const sortValue = `${searchParams.get("sort") || "updated_at"}.${searchParams.get("dir") || "desc"}`;

  function setQueryParam(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    if (Object.keys(next).some((key) => key !== "page")) {
      params.set("page", "1");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function toggleRowSelection(id: string, index: number, shiftKey: boolean) {
    setSelectedIds((prev) => {
      const exists = prev.includes(id);
      if (shiftKey && lastCheckedIndex !== null) {
        const [start, end] = [lastCheckedIndex, index].sort((a, b) => a - b);
        const rangeIds = rows.slice(start, end + 1).map((row) => row.id);
        if (exists) {
          return prev.filter((item) => !rangeIds.includes(item));
        }
        return [...new Set([...prev, ...rangeIds])];
      }
      if (exists) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
    setLastCheckedIndex(index);
  }

  async function runBulkAction(action: string, extra: Record<string, string> = {}, recipeIdsArg?: string[]) {
    const recipeIds = recipeIdsArg && recipeIdsArg.length > 0 ? recipeIdsArg : selectedIds;
    if (recipeIds.length === 0) return;
    if (action === "trash" && recipeIds.length > 20) {
      const confirmed = window.confirm(
        tr(
          lang,
          `Move ${recipeIds.length} recipes to Trash?`,
          `Przenieść ${recipeIds.length} przepisów do kosza?`,
        ),
      );
      if (!confirmed) return;
    }
    if (action === "delete_permanent") {
      const confirmed = window.confirm(
        tr(
          lang,
          `Permanently delete ${recipeIds.length} recipes? This cannot be undone.`,
          `Usunąć trwale ${recipeIds.length} przepisów? Tej operacji nie można cofnąć.`,
        ),
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/recipes/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        recipeIds,
        ...extra,
      }),
    });
    const payload = (await response.json()) as { error?: string; affected?: number };
    setLoading(false);

    if (!response.ok) {
      setError(payload.error || tr(lang, "Bulk action failed.", "Operacja zbiorcza nie powiodła się."));
      return;
    }

    setMessage(
      tr(
        lang,
        `Updated ${payload.affected || recipeIds.length} recipes.`,
        `Zaktualizowano ${payload.affected || recipeIds.length} przepisów.`,
      ),
    );
    setSelectedIds([]);
    router.refresh();
  }

  async function createLabel(name: string, color?: string) {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const payload = (await response.json()) as { error?: string; label?: LabelRecord };
    setLoading(false);
    if (!response.ok || !payload.label) {
      setError(payload.error || tr(lang, "Could not create label.", "Nie udało się utworzyć etykiety."));
      return;
    }
    setLabels((prev) => {
      const exists = prev.some((item) => item.id === payload.label!.id);
      if (exists) return prev;
      return [...prev, payload.label!];
    });
    setMessage(tr(lang, "Label created.", "Utworzono etykietę."));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {errorMessage ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/70 p-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setQueryParam({
              search: String(data.get("search") || "").trim() || null,
              page_size: String(data.get("page_size") || "25"),
            });
          }}
        >
          <Input
            name="search"
            defaultValue={searchParams.get("search") || ""}
            placeholder={tr(lang, "Search title", "Szukaj po tytule")}
            className="w-[220px]"
          />
          <Select
            defaultValue={searchParams.get("label_id") || ""}
            onChange={(event) => setQueryParam({ label_id: event.target.value || null })}
            className="w-[190px]"
          >
            <option value="">{tr(lang, "All labels", "Wszystkie etykiety")}</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </Select>
          <Select
            name="sort_combo"
            value={sortValue}
            onChange={(event) => {
              const [sort, dir] = event.target.value.split(".");
              setQueryParam({ sort, dir });
            }}
            className="w-[210px]"
          >
            {sortOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {tr(lang, item.en, item.pl)}
              </option>
            ))}
          </Select>
          <Select
            name="page_size"
            defaultValue={String(pageSize)}
            onChange={(event) => setQueryParam({ page_size: event.target.value })}
            className="w-[120px]"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
          <Button type="submit" size="sm">{tr(lang, "Apply", "Zastosuj")}</Button>
        </form>
      </div>

      <BulkActionBar
        canManage={canManage}
        isTrashView={isTrashView}
        selectedCount={selectedIds.length}
        allSelectedOnPage={allSelectedOnPage}
        labels={labels}
        selectedRows={selectedRows}
        loading={loading}
        onToggleSelectAll={(checked) => setSelectedIds(checked ? rows.map((item) => item.id) : [])}
        onClearSelection={() => setSelectedIds([])}
        onAction={(action, payload) => runBulkAction(action, payload)}
        onCreateLabel={createLabel}
      />

      <RecipeTable
        rows={rows}
        role={role}
        isTrashView={isTrashView}
        selectedIds={selectedIds}
        onToggleSelection={toggleRowSelection}
        onSingleAction={async (action, row) => {
          await runBulkAction(action, {}, [row.id]);
        }}
      />

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-600">
        <span>
          {tr(lang, "Total", "Łącznie")}: {totalCount}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setQueryParam({ page: String(page - 1) })}
          >
            {tr(lang, "Previous", "Poprzednia")}
          </Button>
          <span>
            {tr(lang, "Page", "Strona")} {page} / {pageCount}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page >= pageCount}
            onClick={() => setQueryParam({ page: String(page + 1) })}
          >
            {tr(lang, "Next", "Następna")}
          </Button>
        </div>
      </div>
    </div>
  );
}
