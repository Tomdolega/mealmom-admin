"use client";

import * as XLSX from "xlsx";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RecipeStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

      if (!title) errors.push("Title is required.");
      if (!language) errors.push("Language is required.");
      if (language && !enabledLanguages.includes(language)) {
        errors.push(`Language must be one of: ${enabledLanguages.join(", ")}.`);
      }
      if (!allowedStatuses.includes(statusValue)) {
        errors.push(`Status must be one of: ${allowedStatuses.join(", ")}.`);
      }
      if (primaryCuisine && !enabledCuisines.includes(primaryCuisine)) {
        errors.push("Primary cuisine is not in enabled cuisines.");
      }

      let ingredients: unknown[] = [];
      let steps: unknown[] = [];

      try {
        ingredients = parseJsonArray(row.ingredients || "[]", "ingredients");
      } catch {
        errors.push("Ingredients must be a valid JSON array.");
      }

      try {
        steps = parseJsonArray(row.steps || "[]", "steps");
      } catch {
        errors.push("Steps must be a valid JSON array.");
      }

      const cuisines = parseList(row.cuisines || "");
      const tags = parseList(row.tags || "");

      const invalidCuisine = cuisines.find((cuisine) => !enabledCuisines.includes(cuisine));
      if (invalidCuisine) {
        errors.push(`Cuisine '${invalidCuisine}' is not enabled.`);
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
        ingredients,
        steps,
        translation_group_id: row.translation_group_id?.trim() || undefined,
      };

      if (payload.servings !== null && Number.isNaN(payload.servings)) errors.push("Servings must be a number.");
      if (payload.total_minutes !== null && Number.isNaN(payload.total_minutes)) {
        errors.push("Total minutes must be a number.");
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
      setReadError("Could not read that file. Please use a CSV or XLSX file with a header row.");
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
          failed.push({ ...row, errors: ["Could not import this row. Check values and role permissions."] });
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
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Import workflow</h2>
        <p className="mt-1 text-sm text-slate-600">Upload a file, validate it, preview results, then confirm import.</p>

        <ol className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          {[
            ["Step 1", "Upload file"],
            ["Step 2", "Validate rows"],
            ["Step 3", "Review preview"],
            ["Step 4", "Confirm import"],
          ].map(([step, label]) => (
            <li key={step} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{step}</p>
              <p className="mt-0.5 text-slate-700">{label}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Step 1: Upload</h3>
        <Input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        {fileName ? <p className="text-sm text-slate-600">Loaded file: {fileName}</p> : null}
        {readError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{readError}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Dry run only (validation without writing to database)
          </label>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const template = [
                "title,language,status,primary_cuisine,cuisines,tags,servings,total_minutes,difficulty,subtitle,ingredients,steps",
                'Tomato Soup,en,draft,Polish,"Polish,Italian","quick,vegetarian",4,35,easy,"Simple and warm","[{""name"":""Tomato"",""amount"":""6"",""unit"":""pcs"",""note"":""ripe""}]","[{""step_number"":1,""text"":""Chop tomatoes"",""timer_seconds"":120}]"',
              ].join("\n");
              downloadCsv("recipes-import-template.csv", template);
            }}
          >
            Download template CSV
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Step 2: Validate</h3>
        <p className="text-sm text-slate-600">
          Required fields: <code>title</code>, <code>language</code>, <code>status</code>. Use JSON arrays for
          <code> ingredients</code> and <code>steps</code> cells.
        </p>
        <p className="text-sm text-slate-700">
          Valid rows: {validCount} · Rows with issues: {errorCount}
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Step 3: Preview</h3>
        <p className="text-sm text-slate-600">First 5 valid rows shown in management view before import.</p>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Row</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Language</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Cuisines</th>
                <th className="px-3 py-2 text-left font-medium">Ingredients</th>
                <th className="px-3 py-2 text-left font-medium">Steps</th>
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
                </tr>
              ))}
              {validDiffPreview.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-sm text-slate-500" colSpan={7}>
                    No valid rows to preview yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Step 4: Confirm</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={importRows} disabled={isImporting || (validCount === 0 && errorCount === 0)}>
            {isImporting ? "Processing..." : dryRun ? `Run dry validation (${validCount} valid)` : `Import valid rows (${validCount})`}
          </Button>
          <span className="text-sm text-slate-500">Errors will be exported as CSV automatically.</span>
        </div>

        {summary ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {summary.dryRun
              ? `Dry run complete. ${summary.validated} rows are valid and ${summary.failed} rows need corrections.`
              : `Import complete. ${summary.created} rows were created/updated and ${summary.failed} rows failed.`}
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Row issues (first 20)</h3>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Language</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Issues</th>
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
                    <td className="px-3 py-2 text-red-700">{result?.errors.join("; ") || "No issues"}</td>
                  </tr>
                );
              })}
              {previewRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>
                    Upload a CSV/XLSX file to start validation.
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
