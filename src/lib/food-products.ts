import type { OffNutritionPer100g, OffSearchItem } from "@/lib/off";
import type { FoodProductRecord } from "@/lib/types";

export type ProductSearchResult = {
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

export function mapFoodProductToSearchResult(product: FoodProductRecord): ProductSearchResult {
  return {
    id: product.id,
    product_id: product.id,
    source: product.source,
    source_id: product.source_id,
    barcode: product.barcode,
    name: product.name_pl || product.name_en || "Unknown product",
    brand: product.brand,
    categories: product.categories || [],
    kcal_100g: product.kcal_100g,
    protein_100g: product.protein_100g,
    fat_100g: product.fat_100g,
    carbs_100g: product.carbs_100g,
    sugar_100g: product.sugar_100g,
    fiber_100g: product.fiber_100g,
    salt_100g: product.salt_100g,
  };
}

export function offSearchItemToFoodProductUpsert(item: OffSearchItem) {
  return {
    source: "openfoodfacts",
    source_id: item.barcode,
    barcode: item.barcode,
    name_pl: item.name,
    name_en: item.name,
    brand: item.brands,
    categories: item.categories,
    nutriments: item.nutriments_raw || {},
    kcal_100g: item.nutrition_per_100g.kcal,
    protein_100g: item.nutrition_per_100g.protein_g,
    fat_100g: item.nutrition_per_100g.fat_g,
    carbs_100g: item.nutrition_per_100g.carbs_g,
    sugar_100g: item.nutrition_per_100g.sugar_g,
    fiber_100g: item.nutrition_per_100g.fiber_g,
    salt_100g: item.nutrition_per_100g.salt_g,
  };
}

export function nutritionToComputedValues(
  nutrition:
    | OffNutritionPer100g
    | {
        kcal?: number | null;
        protein_g?: number | null;
        fat_g?: number | null;
        carbs_g?: number | null;
        sugar_g?: number | null;
        fiber_g?: number | null;
        salt_g?: number | null;
      }
    | null
    | undefined,
  qtyGrams: number,
) {
  if (!nutrition || !Number.isFinite(qtyGrams) || qtyGrams <= 0) {
    return {
      kcal: 0,
      protein_g: 0,
      fat_g: 0,
      carbs_g: 0,
      sugar_g: 0,
      fiber_g: 0,
      salt_g: 0,
    };
  }
  const factor = qtyGrams / 100;
  return {
    kcal: Math.round(((nutrition.kcal || 0) * factor) * 100) / 100,
    protein_g: Math.round(((nutrition.protein_g || 0) * factor) * 100) / 100,
    fat_g: Math.round(((nutrition.fat_g || 0) * factor) * 100) / 100,
    carbs_g: Math.round(((nutrition.carbs_g || 0) * factor) * 100) / 100,
    sugar_g: Math.round(((nutrition.sugar_g || 0) * factor) * 100) / 100,
    fiber_g: Math.round(((nutrition.fiber_g || 0) * factor) * 100) / 100,
    salt_g: Math.round(((nutrition.salt_g || 0) * factor) * 100) / 100,
  };
}

export function normalizeTagSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
