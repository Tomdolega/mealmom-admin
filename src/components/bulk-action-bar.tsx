"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getClientUILang, tr } from "@/lib/ui-language.client";
import type { LabelRecord, RecipeStatus } from "@/lib/types";

type BulkActionBarProps = {
  canManage: boolean;
  isTrashView: boolean;
  selectedCount: number;
  allSelectedOnPage: boolean;
  labels: LabelRecord[];
  selectedRows: Array<{
    id: string;
    title: string;
    status: RecipeStatus;
    language: string;
    updated_at: string;
  }>;
  loading: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onClearSelection: () => void;
  onAction: (action: string, payload?: Record<string, string>) => Promise<void>;
  onCreateLabel: (name: string, color?: string) => Promise<void>;
};

export function BulkActionBar({
  canManage,
  isTrashView,
  selectedCount,
  allSelectedOnPage,
  labels,
  selectedRows,
  loading,
  onToggleSelectAll,
  onClearSelection,
  onAction,
  onCreateLabel,
}: BulkActionBarProps) {
  const lang = getClientUILang();
  const [status, setStatus] = useState<RecipeStatus>("draft");
  const [labelId, setLabelId] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#64748b");

  const csvPayload = useMemo(() => {
    const header = ["id", "title", "status", "language", "updated_at"];
    const rows = selectedRows.map((row) => [row.id, row.title, row.status, row.language, row.updated_at]);
    return [header, ...rows]
      .map((line) => line.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(","))
      .join("\n");
  }, [selectedRows]);

  function download(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={allSelectedOnPage}
            onChange={(event) => onToggleSelectAll(event.target.checked)}
          />
          {tr(lang, "Select all on page", "Zaznacz wszystko na stronie")}
        </label>
        <span className="text-sm text-slate-500">
          {selectedCount > 0
            ? tr(lang, `${selectedCount} selected`, `Zaznaczono: ${selectedCount}`)
            : tr(lang, "No selection", "Brak zaznaczenia")}
        </span>
        {selectedCount > 0 ? (
          <Button type="button" size="sm" variant="ghost" onClick={onClearSelection}>
            {tr(lang, "Clear", "Wyczyść")}
          </Button>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {isTrashView ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={selectedCount === 0 || loading}
                onClick={() => void onAction("restore")}
              >
                {tr(lang, "Restore", "Przywróć")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={selectedCount === 0 || loading}
                onClick={() => void onAction("delete_permanent")}
              >
                {tr(lang, "Permanent delete", "Usuń trwale")}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={selectedCount === 0 || loading}
                onClick={() => void onAction("trash")}
              >
                {tr(lang, "Move to Trash", "Przenieś do kosza")}
              </Button>

              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as RecipeStatus)}
                className="min-w-[180px]"
              >
                <option value="draft">{tr(lang, "Draft", "Szkic")}</option>
                <option value="in_review">{tr(lang, "In review", "W recenzji")}</option>
                <option value="published">{tr(lang, "Published", "Opublikowany")}</option>
                <option value="archived">{tr(lang, "Archived", "Zarchiwizowany")}</option>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={selectedCount === 0 || loading}
                onClick={() => void onAction("set_status", { status })}
              >
                {tr(lang, "Set status", "Ustaw status")}
              </Button>

              <Select value={labelId} onChange={(event) => setLabelId(event.target.value)} className="min-w-[200px]">
                <option value="">{tr(lang, "Select label", "Wybierz etykietę")}</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!labelId || selectedCount === 0 || loading}
                onClick={() => void onAction("assign_label", { labelId })}
              >
                {tr(lang, "Assign label", "Przypisz etykietę")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!labelId || selectedCount === 0 || loading}
                onClick={() => void onAction("remove_label", { labelId })}
              >
                {tr(lang, "Remove label", "Usuń etykietę")}
              </Button>

              <Input
                value={newLabelName}
                onChange={(event) => setNewLabelName(event.target.value)}
                placeholder={tr(lang, "New label", "Nowa etykieta")}
                className="h-10 w-[180px]"
              />
              <input
                type="color"
                value={newLabelColor}
                onChange={(event) => setNewLabelColor(event.target.value)}
                className="h-10 w-12 rounded-md border border-slate-300 bg-white p-1"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!newLabelName.trim() || loading}
                onClick={async () => {
                  await onCreateLabel(newLabelName.trim(), newLabelColor);
                  setNewLabelName("");
                }}
              >
                {tr(lang, "Create label", "Utwórz etykietę")}
              </Button>
            </>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={selectedCount === 0}
            onClick={() => download("recipes-selected.csv", csvPayload, "text/csv")}
          >
            {tr(lang, "Export CSV", "Eksport CSV")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={selectedCount === 0}
            onClick={() => download("recipes-selected.json", JSON.stringify(selectedRows, null, 2), "application/json")}
          >
            {tr(lang, "Export JSON", "Eksport JSON")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
