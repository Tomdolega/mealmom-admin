"use client";

import * as XLSX from "xlsx";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RecipeStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const allowedStatuses: RecipeStatus[] = ["draft", "in_review", "published", "archived"];

type ParsedRow = Record<string, string>;

type ValidationResult = {
  rowIndex: number;
  raw: ParsedRow;
  errors: string[];
  payload?: {
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

type ImportRecipesPanelProps = {
  enabledLanguages: string[];
  enabledCuisines: string[];
};

export function ImportRecipesPanel({ enabledLanguages, enabledCuisines }: ImportRecipesPanelProps) {
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<{ created: number; failed: number } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  function validateRows(sourceRows: ParsedRow[]) {
    const validated: ValidationResult[] = sourceRows.map((row, index) => {
      const rowIndex = index + 2;
      const errors: string[] = [];

      const title = row.title?.trim() || "";
      const language = row.language?.trim() || "";
      const statusValue = (row.status?.trim() || "draft") as RecipeStatus;
      const primaryCuisine = row.primary_cuisine?.trim() || "";

      if (!title) errors.push("title is required");
      if (!language) errors.push("language is required");
      if (language && !enabledLanguages.includes(language)) {
        errors.push(`language must be one of: ${enabledLanguages.join(", ")}`);
      }
      if (!allowedStatuses.includes(statusValue)) {
        errors.push(`status must be one of: ${allowedStatuses.join(", ")}`);
      }
      if (primaryCuisine && !enabledCuisines.includes(primaryCuisine)) {
        errors.push("primary_cuisine is not in enabled cuisines");
      }

      let ingredients: unknown[] = [];
      let steps: unknown[] = [];

      try {
        ingredients = parseJsonArray(row.ingredients || "[]", "ingredients");
      } catch (error) {
        errors.push((error as Error).message);
      }

      try {
        steps = parseJsonArray(row.steps || "[]", "steps");
      } catch (error) {
        errors.push((error as Error).message);
      }

      const cuisines = parseList(row.cuisines || "");
      const tags = parseList(row.tags || "");

      const invalidCuisine = cuisines.find((cuisine) => !enabledCuisines.includes(cuisine));
      if (invalidCuisine) {
        errors.push(`cuisine '${invalidCuisine}' is not enabled`);
      }

      const payload = {
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

      if (payload.servings !== null && Number.isNaN(payload.servings)) errors.push("servings must be a number");
      if (payload.total_minutes !== null && Number.isNaN(payload.total_minutes)) {
        errors.push("total_minutes must be a number");
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
      setReadError("Could not parse file. Use CSV or XLSX with a header row.");
      setRows([]);
      setResults([]);
    }
  }

  async function importRows() {
    const validPayloads = results.filter((item) => item.payload).map((item) => item.payload!);
    if (validPayloads.length === 0) return;

    setIsImporting(true);
    const supabase = createClient();

    let created = 0;
    const failed: ValidationResult[] = [];

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (!result.payload) {
        failed.push(result);
        continue;
      }

      const { error } = await supabase.from("recipes").insert(result.payload);
      if (error) {
        failed.push({ ...result, errors: [error.message] });
      } else {
        created += 1;
      }
    }

    setSummary({ created, failed: failed.length });
    setIsImporting(false);

    if (failed.length > 0) {
      const csv = toErrorCsv(failed);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "recipe-import-errors.csv";
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);
  const validCount = results.filter((item) => item.payload).length;
  const errorCount = results.length - validCount;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Upload file</h2>
          <p className="text-sm text-slate-600">Supported formats: CSV and XLSX.</p>
        </div>
        <Input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        {fileName ? <p className="text-sm text-slate-600">Loaded: {fileName}</p> : null}
        {readError ? <p className="text-sm text-red-700">{readError}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const template = [
                "title,language,status,primary_cuisine,cuisines,tags,servings,total_minutes,difficulty,subtitle,ingredients,steps",
                'Tomato Soup,en,draft,Polish,"Polish,Italian","quick,vegetarian",4,35,easy,"Simple and warm","[{""name"":""Tomato"",""amount"":""6"",""unit"":""pcs"",""note"":""ripe""}]","[{""step_number"":1,""text"":""Chop tomatoes"",""timer_seconds"":120}]"',
              ].join("\n");
              const blob = new Blob([template], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "recipes-import-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download template CSV
          </Button>
          <Button type="button" onClick={importRows} disabled={isImporting || validCount === 0}>
            {isImporting ? "Importing..." : `Import valid rows (${validCount})`}
          </Button>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">Validation</h2>
        <p className="text-sm text-slate-600">
          Required fields: <code>title</code>, <code>language</code>, <code>status</code>. For complex fields,
          use JSON arrays in cells for <code>ingredients</code> and <code>steps</code>.
        </p>
        <p className="text-sm text-slate-700">
          Valid rows: {validCount} · Rows with errors: {errorCount}
        </p>
        {summary ? (
          <p className="text-sm text-slate-700">
            Import complete. Created: {summary.created}, Failed: {summary.failed}. Failed rows are downloaded as CSV.
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Preview (first 20 rows)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Language</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {previewRows.map((row, index) => {
                const result = results[index];
                return (
                  <tr key={`preview-${index}`}>
                    <td className="px-3 py-2">{index + 2}</td>
                    <td className="px-3 py-2">{row.title || "-"}</td>
                    <td className="px-3 py-2">{row.language || "-"}</td>
                    <td className="px-3 py-2">{row.status || "draft"}</td>
                    <td className="px-3 py-2 text-red-700">{result?.errors.join("; ") || "OK"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
