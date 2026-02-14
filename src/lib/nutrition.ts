import type { IngredientItem, RecipeNutritionSummary } from "@/lib/types";

type Macro = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sugar_g: number;
  fiber_g: number;
  salt_g: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function zero(): Macro {
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

export function toGrams(amountRaw: string, unitRaw: string, servingSize?: string | null): number | null {
  const amount = Number(String(amountRaw || "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = String(unitRaw || "").trim().toLowerCase();

  if (unit === "g") return amount;
  if (unit === "kg") return amount * 1000;
  if (unit === "mg") return amount / 1000;
  if (unit === "ml" || unit === "l") {
    // water-like fallback density: 1 ml ~= 1 g
    return unit === "l" ? amount * 1000 : amount;
  }
  if (unit === "pcs" || unit === "piece" || unit === "szt") {
    if (!servingSize) return null;
    const servingMatch = servingSize.match(/([\d.,]+)\s*g/i);
    if (!servingMatch) return null;
    const gramsPerPiece = Number(servingMatch[1].replace(",", "."));
    if (!Number.isFinite(gramsPerPiece) || gramsPerPiece <= 0) return null;
    return gramsPerPiece * amount;
  }
  if (unit === "tsp" || unit === "łyżeczka" || unit === "lyzeczka") {
    return amount * 5;
  }
  if (unit === "tbsp" || unit === "łyżka" || unit === "lyzka") {
    return amount * 15;
  }
  if (unit === "cup" || unit === "szklanka") {
    return amount * 240;
  }
  if (unit === "pinch" || unit === "szczypta") {
    return amount * 0.5;
  }
  if (unit === "slice" || unit === "plaster") {
    return amount * 25;
  }
  if (unit === "clove" || unit === "ząbek" || unit === "zabek") {
    return amount * 5;
  }
  if (unit === "pack" || unit === "opakowanie") {
    return servingSize ? toGrams(amountRaw, "pcs", servingSize) : null;
  }
  return null;
}

function mergeMacro(sum: Macro, grams: number, per100?: IngredientItem["off_nutrition_per_100g"]) {
  if (!per100) return sum;
  const factor = grams / 100;
  return {
    kcal: sum.kcal + (per100.kcal || 0) * factor,
    protein_g: sum.protein_g + (per100.protein_g || 0) * factor,
    fat_g: sum.fat_g + (per100.fat_g || 0) * factor,
    carbs_g: sum.carbs_g + (per100.carbs_g || 0) * factor,
    sugar_g: sum.sugar_g + (per100.sugar_g || 0) * factor,
    fiber_g: sum.fiber_g + (per100.fiber_g || 0) * factor,
    salt_g: sum.salt_g + (per100.salt_g || 0) * factor,
  };
}

export function computeRecipeNutritionSummary(ingredients: IngredientItem[], servings: number | null): RecipeNutritionSummary {
  let totalWeight = 0;
  let total = zero();
  for (const ingredient of ingredients || []) {
    const grams = toGrams(ingredient.amount, ingredient.unit_code || ingredient.unit);
    if (!grams || !ingredient.off_nutrition_per_100g) continue;
    totalWeight += grams;
    total = mergeMacro(total, grams, ingredient.off_nutrition_per_100g);
  }

  const normalizedTotal = {
    kcal: round(total.kcal),
    protein_g: round(total.protein_g),
    fat_g: round(total.fat_g),
    carbs_g: round(total.carbs_g),
    sugar_g: round(total.sugar_g),
    fiber_g: round(total.fiber_g),
    salt_g: round(total.salt_g),
  };

  const per100 =
    totalWeight > 0
      ? {
          kcal: round((normalizedTotal.kcal / totalWeight) * 100),
          protein_g: round((normalizedTotal.protein_g / totalWeight) * 100),
          fat_g: round((normalizedTotal.fat_g / totalWeight) * 100),
          carbs_g: round((normalizedTotal.carbs_g / totalWeight) * 100),
          sugar_g: round((normalizedTotal.sugar_g / totalWeight) * 100),
          fiber_g: round((normalizedTotal.fiber_g / totalWeight) * 100),
          salt_g: round((normalizedTotal.salt_g / totalWeight) * 100),
        }
      : undefined;

  const perServing =
    servings && servings > 0
      ? {
          kcal: round(normalizedTotal.kcal / servings),
          protein_g: round(normalizedTotal.protein_g / servings),
          fat_g: round(normalizedTotal.fat_g / servings),
          carbs_g: round(normalizedTotal.carbs_g / servings),
          sugar_g: round(normalizedTotal.sugar_g / servings),
          fiber_g: round(normalizedTotal.fiber_g / servings),
          salt_g: round(normalizedTotal.salt_g / servings),
        }
      : undefined;

  return {
    ...normalizedTotal,
    per_100g: per100,
    per_serving: perServing,
  };
}

export function suggestSubstitutionsForIngredient(ingredient: IngredientItem): Array<{ alt_name: string; note: string }> {
  const categories = ingredient.off_categories || [];
  const lowerName = ingredient.name.toLowerCase();
  const combined = [...categories, lowerName].join(" ");

  if (combined.includes("butter")) {
    return [
      { alt_name: "Olive oil", note: "May change taste" },
      { alt_name: "Plant margarine", note: "May change taste" },
      { alt_name: "Greek yogurt", note: "May change taste" },
    ];
  }
  if (combined.includes("milk") || combined.includes("dairy")) {
    return [
      { alt_name: "Oat milk", note: "May change taste" },
      { alt_name: "Soy milk", note: "May change taste" },
      { alt_name: "Coconut milk", note: "May change taste" },
    ];
  }
  if (combined.includes("oil")) {
    return [
      { alt_name: "Rapeseed oil", note: "May change taste" },
      { alt_name: "Olive oil", note: "May change taste" },
      { alt_name: "Avocado oil", note: "May change taste" },
    ];
  }
  return [
    { alt_name: "Closest available ingredient", note: "May change taste" },
    { alt_name: "Seasonal alternative", note: "May change taste" },
  ];
}
