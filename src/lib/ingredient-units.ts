import { tr } from "@/lib/ui-language.client";
import type { IngredientUnitCode } from "@/lib/types";

export const INGREDIENT_UNITS: Array<{ code: IngredientUnitCode; en: string; pl: string }> = [
  { code: "g", en: "g", pl: "g" },
  { code: "kg", en: "kg", pl: "kg" },
  { code: "ml", en: "ml", pl: "ml" },
  { code: "l", en: "l", pl: "l" },
  { code: "pcs", en: "pcs", pl: "szt" },
  { code: "tsp", en: "tsp", pl: "łyżeczka" },
  { code: "tbsp", en: "tbsp", pl: "łyżka" },
  { code: "cup", en: "cup", pl: "szklanka" },
  { code: "pack", en: "pack", pl: "opakowanie" },
];

export function getUnitLabel(code: IngredientUnitCode, lang: "en" | "pl") {
  const unit = INGREDIENT_UNITS.find((item) => item.code === code);
  if (!unit) return code;
  return tr(lang, unit.en, unit.pl);
}

export function normalizeUnitCode(value: string | null | undefined): IngredientUnitCode | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (INGREDIENT_UNITS.some((item) => item.code === trimmed)) {
    return trimmed as IngredientUnitCode;
  }
  const lowered = trimmed.toLowerCase();
  const aliasMap: Record<string, IngredientUnitCode> = {
    szt: "pcs",
    sztuka: "pcs",
    łyżeczka: "tsp",
    lyzeczka: "tsp",
    łyżka: "tbsp",
    lyzka: "tbsp",
    szklanka: "cup",
    opakowanie: "pack",
  };
  return aliasMap[lowered];
}
