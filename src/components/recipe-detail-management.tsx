"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getClientUILang, tr } from "@/lib/ui-language.client";
import type { LabelRecord, ProfileRole } from "@/lib/types";

type RecipeDetailManagementProps = {
  recipeId: string;
  role: ProfileRole;
  isDeleted: boolean;
  labels: LabelRecord[];
  assignedLabelIds: string[];
};

export function RecipeDetailManagement({
  recipeId,
  role,
  isDeleted,
  labels: initialLabels,
  assignedLabelIds,
}: RecipeDetailManagementProps) {
  const lang = getClientUILang();
  const router = useRouter();
  const [labels, setLabels] = useState(initialLabels);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canManage = role === "admin" || role === "editor";

  async function runBulk(action: string, extra: Record<string, string> = {}) {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/recipes/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, recipeIds: [recipeId], ...extra }),
    });
    const payload = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(payload.error || tr(lang, "Action failed.", "Operacja nie powiodła się."));
      return;
    }

    setMessage(tr(lang, "Recipe updated.", "Przepis zaktualizowany."));
    router.refresh();
  }

  async function createLabel() {
    if (!newLabel.trim()) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newLabel.trim() }),
    });
    const payload = (await response.json()) as { error?: string; label?: LabelRecord };
    setLoading(false);
    if (!response.ok || !payload.label) {
      setError(payload.error || tr(lang, "Could not create label.", "Nie udało się utworzyć etykiety."));
      return;
    }
    setLabels((prev) => [...prev, payload.label!]);
    setSelectedLabel(payload.label.id);
    setNewLabel("");
    setMessage(tr(lang, "Label created.", "Utworzono etykietę."));
  }

  if (!canManage) return null;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {tr(lang, "Management actions", "Akcje zarządzania")}
      </h2>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {isDeleted ? (
          <>
            <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => void runBulk("restore")}>
              {tr(lang, "Restore", "Przywróć")}
            </Button>
            {role === "admin" ? (
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={loading}
                onClick={() => {
                  const confirmed = window.confirm(
                    tr(
                      lang,
                      "Permanently delete this recipe? This cannot be undone.",
                      "Usunąć ten przepis trwale? Tej operacji nie można cofnąć.",
                    ),
                  );
                  if (confirmed) void runBulk("delete_permanent");
                }}
              >
                {tr(lang, "Permanent delete", "Usuń trwale")}
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => void runBulk("trash")}
          >
            {tr(lang, "Move to Trash", "Przenieś do kosza")}
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Select value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value)}>
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
          disabled={!selectedLabel || loading}
          onClick={() => void runBulk("assign_label", { labelId: selectedLabel })}
        >
          {tr(lang, "Assign", "Przypisz")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!selectedLabel || loading || !assignedLabelIds.includes(selectedLabel)}
          onClick={() => void runBulk("remove_label", { labelId: selectedLabel })}
        >
          {tr(lang, "Remove", "Usuń")}
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder={tr(lang, "Create new label", "Utwórz nową etykietę")}
        />
        <Button type="button" size="sm" variant="secondary" disabled={!newLabel.trim() || loading} onClick={() => void createLabel()}>
          {tr(lang, "Create", "Utwórz")}
        </Button>
      </div>
    </section>
  );
}
