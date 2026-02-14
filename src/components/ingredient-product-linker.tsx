"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type OffSearchItem = {
  barcode: string;
  name: string;
  brands: string | null;
  quantity: string | null;
  nutriscore: string | null;
  nova: number | null;
  image_url: string | null;
  allergens: string[];
  categories: string[];
};

type OffProduct = {
  barcode: string;
  name: string;
  image_url: string | null;
  nutriscore: string | null;
  categories: string[];
  nutrition_per_100g: {
    kcal: number | null;
    protein_g: number | null;
    fat_g: number | null;
    carbs_g: number | null;
    sugar_g: number | null;
    fiber_g: number | null;
    salt_g: number | null;
  };
};

type IngredientProductLinkerProps = {
  onSelect: (product: OffProduct) => void;
  disabled?: boolean;
};

export function IngredientProductLinker({ onSelect, disabled }: IngredientProductLinkerProps) {
  const lang = getClientUILang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OffSearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const normalizedQuery = query.trim();
  const visibleResults = normalizedQuery.length >= 3 ? results : [];

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 3) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/off/search?q=${encodeURIComponent(q)}&lc=pl`);
      const payload = (await response.json()) as { error?: string; results?: OffSearchItem[] };
      setLoading(false);
      if (!response.ok) {
        setResults([]);
        setError(payload.error || tr(lang, "Search failed.", "Wyszukiwanie nie powiodło się."));
        return;
      }
      setResults(payload.results || []);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [open, query, lang]);

  async function selectProduct(barcode: string) {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/off/product/${encodeURIComponent(barcode)}?lc=pl`);
    const payload = (await response.json()) as { error?: string; product?: OffProduct };
    setLoading(false);
    if (!response.ok || !payload.product) {
      setError(payload.error || tr(lang, "Could not load product details.", "Nie udało się pobrać szczegółów produktu."));
      return;
    }
    onSelect(payload.product);
    setOpen(false);
    setQuery("");
    setResults([]);
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
              <h3 className="text-base font-semibold text-slate-900">{tr(lang, "Find product (OpenFoodFacts)", "Znajdź produkt (OpenFoodFacts)")}</h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                {tr(lang, "Close", "Zamknij")}
              </Button>
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr(lang, "Search product name (min 3 chars)", "Szukaj nazwy produktu (min 3 znaki)")}
            />
            {loading ? <p className="mt-3 text-sm text-slate-600">{tr(lang, "Searching...", "Wyszukiwanie...")}</p> : null}
            {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-auto">
              {visibleResults.map((item) => (
                <button
                  key={item.barcode}
                  type="button"
                  onClick={() => void selectProduct(item.barcode)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.brands || "—"} · {item.quantity || "—"} · {item.barcode}
                  </p>
                </button>
              ))}
              {!loading && normalizedQuery.length >= 3 && visibleResults.length === 0 && !error ? (
                <p className="text-sm text-slate-500">{tr(lang, "No products found.", "Brak wyników.")}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
