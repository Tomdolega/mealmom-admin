"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { normalizeTagSlug } from "@/lib/food-products";
import { getClientUILang, tr } from "@/lib/ui-language.client";
import type { TagRecord } from "@/lib/types";

type TagSelectorProps = {
  value: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
};

const TAG_TYPES = ["custom", "diet", "cuisine", "time", "difficulty", "allergen", "goal", "meal_type", "equipment"];

export function TagSelector({ value, disabled, onChange }: TagSelectorProps) {
  const lang = getClientUILang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newType, setNewType] = useState("custom");
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = query.trim();

  useEffect(() => {
    if (normalizedQuery.length < 2 || disabled) return;

    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/tags?q=${encodeURIComponent(normalizedQuery)}`);
      const payload = (await response.json()) as { error?: string; tags?: TagRecord[] };
      setLoading(false);
      if (!response.ok) {
        setResults([]);
        setError(payload.error || tr(lang, "Could not load tags.", "Nie udało się pobrać tagów."));
        return;
      }
      setResults(payload.tags || []);
    }, 250);

    return () => clearTimeout(timeout);
  }, [normalizedQuery, disabled, lang]);

  const canCreate = useMemo(() => {
    if (!normalizedQuery) return false;
    const slug = normalizeTagSlug(normalizedQuery);
    if (!slug) return false;
    return !value.includes(slug) && !results.some((item) => item.slug === slug);
  }, [normalizedQuery, value, results]);

  async function createTag() {
    if (!canCreate) return;
    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: normalizedQuery, type: newType }),
    });
    const payload = (await response.json()) as { error?: string; tag?: TagRecord };
    if (!response.ok || !payload.tag) {
      setError(payload.error || tr(lang, "Could not create tag.", "Nie udało się utworzyć tagu."));
      return;
    }
    if (!value.includes(payload.tag.slug)) {
      onChange([...value, payload.tag.slug]);
    }
    setQuery("");
    setResults([]);
  }

  function addTag(slug: string) {
    if (value.includes(slug)) return;
    onChange([...value, slug]);
  }

  function removeTag(slug: string) {
    onChange(value.filter((item) => item !== slug));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((slug) => (
          <span key={slug} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
            {slug}
            {!disabled ? (
              <button type="button" onClick={() => removeTag(slug)} className="text-slate-500 hover:text-slate-900" aria-label={tr(lang, "Remove tag", "Usuń tag")}>×</button>
            ) : null}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
          placeholder={tr(lang, "Type tag name", "Wpisz nazwę tagu")}
          className="min-w-[220px] flex-1"
        />
        <Select value={newType} onChange={(event) => setNewType(event.target.value)} disabled={disabled} className="w-[170px]">
          {TAG_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
        <Button type="button" size="sm" variant="secondary" disabled={disabled || !canCreate} onClick={() => void createTag()}>
          {tr(lang, "Create tag", "Utwórz tag")}
        </Button>
      </div>

      {loading ? <p className="text-xs text-slate-500">{tr(lang, "Loading tags...", "Wczytywanie tagów...")}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p> : null}

      {results.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {results.map((tag) => (
            <Button
              key={tag.id}
              type="button"
              size="sm"
              variant={value.includes(tag.slug) ? "secondary" : "ghost"}
              disabled={disabled || value.includes(tag.slug)}
              onClick={() => addTag(tag.slug)}
            >
              {tag.name_pl} · {tag.type}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
