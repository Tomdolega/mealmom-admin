"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type ProductResult = {
  id: string;
  product_id: string;
  source: string;
  source_id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  categories: string[];
  kcal_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  carbs_100g: number | null;
  sugar_100g: number | null;
  fiber_100g: number | null;
  salt_100g: number | null;
};

type IngredientProductLinkerProps = {
  onSelect: (product: ProductResult) => void;
  disabled?: boolean;
};

export function IngredientProductLinker({ onSelect, disabled }: IngredientProductLinkerProps) {
  const lang = getClientUILang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncingOff, setSyncingOff] = useState(false);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const normalizedQuery = query.trim();
  const visibleResults = normalizedQuery.length >= 2 ? results : [];

  useEffect(() => {
    if (!open) return;
    if (normalizedQuery.length < 2) return;

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/products/off-search?q=${encodeURIComponent(normalizedQuery)}&locale=pl`);
      const payload = (await response.json()) as { error?: string; results?: ProductResult[] };
      setLoading(false);

      if (!response.ok) {
        setResults([]);
        setError(payload.error || tr(lang, "Search failed.", "Wyszukiwanie nie powiodło się."));
        return;
      }

      setResults(payload.results || []);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [open, normalizedQuery, lang]);

  async function searchOpenFoodFacts() {
    if (normalizedQuery.length < 3) {
      setError(tr(lang, "Type at least 3 characters.", "Wpisz minimum 3 znaki."));
      return;
    }

    setSyncingOff(true);
    setError(null);
    const response = await fetch(`/api/products/off-search?q=${encodeURIComponent(normalizedQuery)}&locale=pl&fetch_off=1`);
    const payload = (await response.json()) as { error?: string; results?: ProductResult[] };
    setSyncingOff(false);

    if (!response.ok) {
      setError(payload.error || tr(lang, "Could not sync OpenFoodFacts results.", "Nie udało się pobrać wyników z OpenFoodFacts."));
      return;
    }

    setResults(payload.results || []);
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        {tr(lang, "Link to product", "Połącz z produktem")}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-900/30 p-4">
          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {tr(lang, "Find ingredient product", "Znajdź produkt składnika")}
              </h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                {tr(lang, "Close", "Zamknij")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tr(lang, "Search local catalog", "Szukaj w lokalnym katalogu")}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={syncingOff || normalizedQuery.length < 3}
                onClick={() => void searchOpenFoodFacts()}
              >
                {syncingOff
                  ? tr(lang, "Syncing OFF...", "Synchronizacja OFF...")
                  : tr(lang, "Search OpenFoodFacts", "Szukaj w OpenFoodFacts")}
              </Button>
            </div>
            {loading ? <p className="mt-3 text-sm text-slate-600">{tr(lang, "Searching local cache...", "Wyszukiwanie w lokalnym cache...")}</p> : null}
            {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-auto">
              {visibleResults.map((item) => (
                <button
                  key={`${item.source}-${item.source_id}`}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                    setQuery("");
                    setResults([]);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.brand || "—"} · {item.barcode || item.source_id} · kcal/100g: {item.kcal_100g ?? "—"}
                  </p>
                </button>
              ))}
              {!loading && normalizedQuery.length >= 2 && visibleResults.length === 0 && !error ? (
                <p className="text-sm text-slate-500">
                  {tr(lang, "No local results. Use OpenFoodFacts sync button.", "Brak lokalnych wyników. Użyj przycisku wyszukania OpenFoodFacts.")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
