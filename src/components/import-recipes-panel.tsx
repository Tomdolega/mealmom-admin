"use client";

import * as XLSX from "xlsx";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NutritionRecord, RecipeStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClientUILang, tr } from "@/lib/ui-language.client";

const allowedStatuses: RecipeStatus[] = ["draft", "in_review", "published", "archived"];
const UPSERT_CHUNK_SIZE = 100;

type ParsedRow = Record<string, string>;

type ImportPayload = {
  id?: string;
  title: string;
  language: string;
  status: RecipeStatus;
  primary_cuisine: string | null;
  cuisines: string[];
  tags: string[];
  servings: number | null;
  total_minutes: number | null;
  difficulty: string | null;
  subtitle: string | null;
  description: string | null;
  nutrition: NutritionRecord;
  substitutions: unknown[];
  image_urls: string[];
  ingredients: unknown[];
  steps: unknown[];
  translation_group_id?: string;
};

type ValidationResult = {
  rowIndex: number;
  raw: ParsedRow;
  errors: string[];
  payload?: ImportPayload;
};

function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonArray(value: string, field: "ingredients" | "steps") {
  if (!value.trim()) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(`${field} must be a JSON array`);
  }
  return parsed;
}

function parseGenericJsonArray(value: string, fieldName: string) {
  if (!value.trim()) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON array`);
  }
  return parsed;
}

function parseJsonObject(value: string, field: "nutrition_per_serving" | "nutrition_per_100g") {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${field} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function normalizeNutritionObject(values: Record<string, unknown>) {
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      normalized[key] = parsed;
    }
  }
  return normalized;
}

function toErrorCsv(items: ValidationResult[]) {
  const lines = ["row,error"];
  for (const item of items) {
    const message = item.errors.join(" | ").replaceAll("\"", "\"\"");
    lines.push(`${item.rowIndex},"${message}"`);
  }
  return lines.join("\n");
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type ImportRecipesPanelProps = {
  enabledLanguages: string[];
  enabledCuisines: string[];
};

export function ImportRecipesPanel({ enabledLanguages, enabledCuisines }: ImportRecipesPanelProps) {
  const lang = getClientUILang();
  const tt = (en: string, pl: string) => tr(lang, en, pl);

  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [dryRun, setDryRun] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<{ created: number; failed: number; dryRun: boolean; validated: number } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  function validateRows(sourceRows: ParsedRow[]) {
    const validated: ValidationResult[] = sourceRows.map((row, index) => {
      const rowIndex = index + 2;
      const errors: string[] = [];

      const title = row.title?.trim() || "";
      const language = row.language?.trim() || "";
      const statusValue = (row.status?.trim() || "draft") as RecipeStatus;
      const primaryCuisine = row.primary_cuisine?.trim() || "";

      if (!title) errors.push(tt("Title is required.", "Tytuł jest wymagany."));
      if (!language) errors.push(tt("Language is required.", "Język jest wymagany."));
      if (language && !enabledLanguages.includes(language)) {
        errors.push(tt(`Language must be one of: ${enabledLanguages.join(", ")}.`, `Język musi być jednym z: ${enabledLanguages.join(", ")}.`));
      }
      if (!allowedStatuses.includes(statusValue)) {
        errors.push(tt(`Status must be one of: ${allowedStatuses.join(", ")}.`, `Status musi być jednym z: ${allowedStatuses.join(", ")}.`));
      }
      if (primaryCuisine && !enabledCuisines.includes(primaryCuisine)) {
        errors.push(tt("Primary cuisine is not in enabled cuisines.", "Kuchnia główna nie jest na liście aktywnych kuchni."));
      }

      let ingredients: unknown[] = [];
      let steps: unknown[] = [];
      let nutritionPerServing: Record<string, unknown> = {};
      let nutritionPer100g: Record<string, unknown> = {};
      let substitutions: unknown[] = [];

      try {
        ingredients = parseJsonArray(row.ingredients || "[]", "ingredients");
      } catch {
        errors.push(tt("Ingredients must be a valid JSON array.", "Składniki muszą być poprawną tablicą JSON."));
      }

      try {
        steps = parseJsonArray(row.steps || "[]", "steps");
      } catch {
        errors.push(tt("Steps must be a valid JSON array.", "Kroki muszą być poprawną tablicą JSON."));
      }
      try {
        nutritionPerServing = parseJsonObject(row.nutrition_per_serving || "{}", "nutrition_per_serving");
      } catch {
        errors.push(
          tt(
            "nutrition_per_serving must be a valid JSON object.",
            "nutrition_per_serving musi być poprawnym obiektem JSON.",
          ),
        );
      }
      try {
        nutritionPer100g = parseJsonObject(row.nutrition_per_100g || "{}", "nutrition_per_100g");
      } catch {
        errors.push(tt("nutrition_per_100g must be a valid JSON object.", "nutrition_per_100g musi być poprawnym obiektem JSON."));
      }
      try {
        substitutions = parseGenericJsonArray(row.substitutions || "[]", "substitutions");
      } catch {
        errors.push(tt("Substitutions must be a valid JSON array.", "Zamienniki muszą być poprawną tablicą JSON."));
      }

      const cuisines = parseList(row.cuisines || "");
      const tags = parseList(row.tags || "");
      const imageUrls = parseList(row.image_urls || "");

      const invalidCuisine = cuisines.find((cuisine) => !enabledCuisines.includes(cuisine));
      if (invalidCuisine) {
        errors.push(tt(`Cuisine '${invalidCuisine}' is not enabled.`, `Kuchnia '${invalidCuisine}' nie jest aktywna.`));
      }

      const payload: ImportPayload = {
        id: row.id?.trim() || undefined,
        title,
        language,
        status: statusValue,
        primary_cuisine: primaryCuisine || null,
        cuisines,
        tags,
        servings: row.servings ? Number(row.servings) : null,
        total_minutes: row.total_minutes ? Number(row.total_minutes) : null,
        difficulty: row.difficulty?.trim() || null,
        subtitle: row.subtitle?.trim() || null,
        description: row.description?.trim() || null,
        nutrition: {
          per_serving: normalizeNutritionObject(nutritionPerServing),
          per_100g: normalizeNutritionObject(nutritionPer100g),
        },
        substitutions,
        image_urls: imageUrls,
        ingredients,
        steps,
        translation_group_id: row.translation_group_id?.trim() || undefined,
      };

      if (payload.servings !== null && Number.isNaN(payload.servings)) errors.push(tt("Servings must be a number.", "Porcje muszą być liczbą."));
      if (payload.total_minutes !== null && Number.isNaN(payload.total_minutes)) {
        errors.push(tt("Total minutes must be a number.", "Czas całkowity musi być liczbą."));
      }
      for (const source of [payload.nutrition.per_serving || {}, payload.nutrition.per_100g || {}]) {
        for (const value of Object.values(source)) {
          if (value == null) continue;
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed < 0) {
            errors.push(
              tt(
                "Nutrition values must be numbers >= 0.",
                "Wartości nutrition muszą być liczbami >= 0.",
              ),
            );
            break;
          }
        }
      }

      return { rowIndex, raw: row, errors, payload: errors.length ? undefined : payload };
    });

    setResults(validated);
    setSummary(null);
  }

  async function readFile(file: File) {
    setReadError(null);
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
      });

      const normalized: ParsedRow[] = rawRows.map((row) => {
        const entries = Object.entries(row).map(([key, value]) => [normalizeKey(key), String(value ?? "")]);
        return Object.fromEntries(entries);
      });

      setRows(normalized);
      validateRows(normalized);
    } catch {
      setReadError(tt("Could not read that file. Please use a CSV or XLSX file with a header row.", "Nie udało się odczytać pliku. Użyj pliku CSV lub XLSX z nagłówkiem."));
      setRows([]);
      setResults([]);
      setSummary(null);
    }
  }

  async function importRows() {
    const validResults = results.filter((item) => item.payload);
    const failed: ValidationResult[] = results.filter((item) => !item.payload);

    if (validResults.length === 0 && failed.length === 0) {
      return;
    }

    if (dryRun) {
      setSummary({ created: 0, failed: failed.length, dryRun: true, validated: validResults.length });
      if (failed.length > 0) {
        downloadCsv("recipe-import-errors.csv", toErrorCsv(failed));
      }
      return;
    }

    setIsImporting(true);
    const supabase = createClient();

    let created = 0;

    for (const chunk of chunkArray(validResults, UPSERT_CHUNK_SIZE)) {
      const payloads = chunk.map((item) => item.payload!);
      const { error } = await supabase.from("recipes").upsert(payloads, { onConflict: "id" });

      if (!error) {
        created += chunk.length;
        continue;
      }

      for (const row of chunk) {
        const { error: rowError } = await supabase.from("recipes").upsert(row.payload!, { onConflict: "id" });
        if (rowError) {
          failed.push({ ...row, errors: [tt("Could not import this row. Check values and role permissions.", "Nie udało się zaimportować tego wiersza. Sprawdź wartości i uprawnienia roli.")] });
        } else {
          created += 1;
        }
      }
    }

    setIsImporting(false);
    setSummary({ created, failed: failed.length, dryRun: false, validated: validResults.length });

    if (failed.length > 0) {
      downloadCsv("recipe-import-errors.csv", toErrorCsv(failed));
    }
  }

  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);
  const validRows = useMemo(() => results.filter((item) => item.payload), [results]);
  const validDiffPreview = useMemo(() => validRows.slice(0, 5), [validRows]);
  const validCount = validRows.length;
  const errorCount = results.length - validCount;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-slate-900">{tt("Import workflow", "Workflow importu")}</h2>
        <p className="mt-1 text-sm text-slate-600">{tt("Upload a file, validate it, preview results, then confirm import.", "Wgraj plik, zwaliduj dane, sprawdź podgląd i potwierdź import.")}</p>

        <ol className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          {[
            [tt("Step 1", "Krok 1"), tt("Upload file", "Wgraj plik")],
            [tt("Step 2", "Krok 2"), tt("Validate rows", "Zweryfikuj wiersze")],
            [tt("Step 3", "Krok 3"), tt("Review preview", "Sprawdź podgląd")],
            [tt("Step 4", "Krok 4"), tt("Confirm import", "Potwierdź import")],
          ].map(([step, label]) => (
            <li key={step} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{step}</p>
              <p className="mt-0.5 text-slate-700">{label}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tt("Step 1: Upload", "Krok 1: Wgrywanie")}</h3>
        <Input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        {fileName ? <p className="text-sm text-slate-600">{tt("Loaded file", "Załadowany plik")}: {fileName}</p> : null}
        {readError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{readError}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {tt("Dry run only (validation without writing to database)", "Tylko dry-run (walidacja bez zapisu do bazy)")}
          </label>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const template = [
                "title,language,status,primary_cuisine,cuisines,tags,servings,total_minutes,difficulty,subtitle,description,nutrition_per_serving,nutrition_per_100g,substitutions,image_urls,ingredients,steps",
                'Tomato Soup,en,draft,Polish,"Polish,Italian","quick,vegetarian",4,35,easy,"Simple and warm","Rich tomato soup with basil.","{""kcal"":220,""protein_g"":6}","{""kcal"":80,""protein_g"":2}","[{""ingredient_key"":""tomato"",""alternatives"":[{""alt_name"":""passata"",""ratio"":""1:1"",""note"":""smooth texture"",""dietary_tags"":[""vegan""]}]}]","https://cdn.example.com/soup.jpg,https://cdn.example.com/soup-2.jpg","[{""ingredient_key"":""tomato"",""name"":""Tomato"",""amount"":""6"",""unit"":""pcs"",""note"":""ripe""}]","[{""step_number"":1,""text"":""Chop tomatoes"",""timer_seconds"":120}]"',
              ].join("\n");
              downloadCsv("recipes-import-template.csv", template);
            }}
          >
            {tt("Download template CSV", "Pobierz szablon CSV")}
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tt("Step 2: Validate", "Krok 2: Walidacja")}</h3>
        <p className="text-sm text-slate-600">
          {tt("Required fields", "Pola wymagane")}: <code>title</code>, <code>language</code>, <code>status</code>. {tt("Use JSON arrays for", "Użyj tablic JSON dla")}
          <code> ingredients</code>, <code>steps</code>, <code>substitutions</code>. {tt("Use JSON objects for", "Użyj obiektów JSON dla")} <code>nutrition_per_serving</code> {tt("and", "oraz")} <code>nutrition_per_100g</code>.
        </p>
        <p className="text-sm text-slate-700">
          {tt("Valid rows", "Poprawne wiersze")}: {validCount} · {tt("Rows with issues", "Wiersze z błędami")}: {errorCount}
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tt("Step 3: Preview", "Krok 3: Podgląd")}</h3>
        <p className="text-sm text-slate-600">{tt("First 5 valid rows shown in management view before import.", "Pierwsze 5 poprawnych wierszy przed importem.")}</p>
        <div className="space-y-2 rounded-md border border-slate-200 p-3 md:hidden">
          {validDiffPreview.map((item) => (
            <article key={`valid-preview-mobile-${item.rowIndex}`} className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-800">#{item.rowIndex} · {item.payload?.title || "-"}</p>
              <p className="text-slate-600">{tt("Language", "Język")}: {item.payload?.language || "-"}</p>
              <p className="text-slate-600">{tt("Status", "Status")}: {item.payload?.status || "-"}</p>
              <p className="text-slate-600">
                {tt("Counts", "Liczby")}: {tt("Cuisines", "Kuchnie")} {item.payload?.cuisines.length || 0}, {tt("Ingredients", "Składniki")} {item.payload?.ingredients.length || 0}, {tt("Steps", "Kroki")} {item.payload?.steps.length || 0}
              </p>
            </article>
          ))}
          {validDiffPreview.length === 0 ? <p className="text-sm text-slate-500">{tt("No valid rows to preview yet.", "Brak poprawnych wierszy do podglądu.")}</p> : null}
        </div>
        <div className="hidden overflow-x-auto rounded-md border border-slate-200 md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{tt("Row", "Wiersz")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Title", "Tytuł")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Language", "Język")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Status", "Status")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Cuisines", "Kuchnie")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Ingredients", "Składniki")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Steps", "Kroki")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Images", "Zdjęcia")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Nutrition", "Nutrition")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {validDiffPreview.map((item) => (
                <tr key={`valid-preview-${item.rowIndex}`}>
                  <td className="px-3 py-2">{item.rowIndex}</td>
                  <td className="px-3 py-2">{item.payload?.title}</td>
                  <td className="px-3 py-2">{item.payload?.language}</td>
                  <td className="px-3 py-2">{item.payload?.status}</td>
                  <td className="px-3 py-2">{item.payload?.cuisines.length || 0}</td>
                  <td className="px-3 py-2">{item.payload?.ingredients.length || 0}</td>
                  <td className="px-3 py-2">{item.payload?.steps.length || 0}</td>
                  <td className="px-3 py-2">{item.payload?.image_urls.length || 0}</td>
                  <td className="px-3 py-2">{Object.keys(item.payload?.nutrition?.per_serving || {}).length > 0 ? "yes" : "no"}</td>
                </tr>
              ))}
              {validDiffPreview.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-sm text-slate-500" colSpan={9}>
                    {tt("No valid rows to preview yet.", "Brak poprawnych wierszy do podglądu.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tt("Step 4: Confirm", "Krok 4: Potwierdzenie")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={importRows} disabled={isImporting || (validCount === 0 && errorCount === 0)}>
            {isImporting ? tt("Processing...", "Przetwarzanie...") : dryRun ? `${tt("Run dry validation", "Uruchom dry-run")}` + ` (${validCount} ${tt("valid", "poprawnych")})` : `${tt("Import valid rows", "Importuj poprawne wiersze")}` + ` (${validCount})`}
          </Button>
          <span className="text-sm text-slate-500">{tt("Errors will be exported as CSV automatically.", "Błędy zostaną automatycznie wyeksportowane do CSV.")}</span>
        </div>

        {summary ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {summary.dryRun
              ? tt(`Dry run complete. ${summary.validated} rows are valid and ${summary.failed} rows need corrections.`, `Dry-run zakończony. ${summary.validated} wierszy jest poprawnych, ${summary.failed} wymaga poprawek.`)
              : tt(`Import complete. ${summary.created} rows were created/updated and ${summary.failed} rows failed.`, `Import zakończony. ${summary.created} wierszy utworzono/zaktualizowano, ${summary.failed} zakończyło się błędem.`)}
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tt("Row issues (first 20)", "Błędy wierszy (pierwsze 20)")}</h3>
        <div className="space-y-2 rounded-md border border-slate-200 p-3 md:hidden">
          {previewRows.map((row, index) => {
            const result = results[index];
            return (
              <article key={`preview-mobile-${index}`} className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-800">#{index + 2} · {row.title || "-"}</p>
                <p className="text-slate-600">{tt("Language", "Język")}: {row.language || "-"}</p>
                <p className="text-slate-600">{tt("Status", "Status")}: {row.status || "draft"}</p>
                <p className={result?.errors.length ? "text-red-700" : "text-emerald-700"}>
                  {result?.errors.join("; ") || tt("No issues", "Brak problemów")}
                </p>
              </article>
            );
          })}
          {previewRows.length === 0 ? <p className="text-sm text-slate-500">{tt("Upload a CSV/XLSX file to start validation.", "Wgraj plik CSV/XLSX, aby rozpocząć walidację.")}</p> : null}
        </div>
        <div className="hidden overflow-x-auto rounded-md border border-slate-200 md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Title", "Tytuł")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Language", "Język")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Status", "Status")}</th>
                <th className="px-3 py-2 text-left font-medium">{tt("Issues", "Problemy")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {previewRows.map((row, index) => {
                const result = results[index];
                return (
                  <tr key={`preview-${index}`}>
                    <td className="px-3 py-2">{index + 2}</td>
                    <td className="px-3 py-2">{row.title || "-"}</td>
                    <td className="px-3 py-2">{row.language || "-"}</td>
                    <td className="px-3 py-2">{row.status || "draft"}</td>
                    <td className="px-3 py-2 text-red-700">{result?.errors.join("; ") || tt("No issues", "Brak problemów")}</td>
                  </tr>
                );
              })}
              {previewRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>
                    {tt("Upload a CSV/XLSX file to start validation.", "Wgraj plik CSV/XLSX, aby rozpocząć walidację.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
