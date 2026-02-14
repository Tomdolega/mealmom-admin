import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeUnitCode } from "@/lib/ingredient-units";
import { toGrams } from "@/lib/nutrition";
import type { ProfileRole } from "@/lib/types";

type IngredientInput = {
  product_id?: string | null;
  display_name?: string;
  qty?: number | string;
  unit?: string;
  computed?: {
    kcal?: number | null;
    protein_g?: number | null;
    fat_g?: number | null;
    carbs_g?: number | null;
    sugar_g?: number | null;
    fiber_g?: number | null;
    salt_g?: number | null;
  } | null;
};

type CalcBody = {
  recipe_id: string;
  ingredients: IngredientInput[];
  servings: number;
};

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

function hashPayload(body: CalcBody) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ recipe_id: body.recipe_id, servings: body.servings, ingredients: body.ingredients }))
    .digest("hex");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: ProfileRole }>();
  if (!profile || !["admin", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as CalcBody | null;
  if (!body || !body.recipe_id || !Array.isArray(body.ingredients)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const servings = Number(body.servings);
  if (!Number.isFinite(servings) || servings <= 0) {
    return NextResponse.json({ error: "servings must be > 0" }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const cacheHash = hashPayload(body);
  const { data: cached } = await admin
    .from("nutrition_calc_cache")
    .select("payload")
    .eq("hash", cacheHash)
    .maybeSingle<{ payload: unknown }>();

  if (cached?.payload) {
    return NextResponse.json({ source: "cache", ...((cached.payload || {}) as Record<string, unknown>) });
  }

  const ingredientProductIds = body.ingredients
    .map((item) => (item.product_id ? String(item.product_id) : ""))
    .filter(Boolean);

  const { data: products } = ingredientProductIds.length
    ? await admin
        .from("products")
        .select("id, nutriments")
        .in("id", ingredientProductIds)
        .returns<
          Array<{
            id: string;
            nutriments: Record<string, unknown> | null;
          }>
        >()
    : { data: [] as Array<{ id: string; nutriments: Record<string, unknown> | null }> };

  const productMap = new Map((products || []).map((item) => [item.id, item]));

  let total = zero();
  const ingredientComputed = body.ingredients.map((ingredient) => {
    const qty = Number(ingredient.qty || 0);
    const unitCode = normalizeUnitCode(ingredient.unit || "") || "g";
    const grams = toGrams(String(qty), unitCode) || 0;

    let computed = zero();
    if (ingredient.product_id && productMap.has(String(ingredient.product_id))) {
      const p = productMap.get(String(ingredient.product_id))!;
      const nutriments = p.nutriments || {};
      const kcal100 = Number(nutriments["energy-kcal_100g"] || nutriments["kcal_100g"] || 0);
      const protein100 = Number(nutriments["proteins_100g"] || 0);
      const fat100 = Number(nutriments["fat_100g"] || 0);
      const carbs100 = Number(nutriments["carbohydrates_100g"] || 0);
      const sugar100 = Number(nutriments["sugars_100g"] || 0);
      const fiber100 = Number(nutriments["fiber_100g"] || 0);
      const salt100 = Number(nutriments["salt_100g"] || 0);
      const factor = grams / 100;
      computed = {
        kcal: round(kcal100 * factor),
        protein_g: round(protein100 * factor),
        fat_g: round(fat100 * factor),
        carbs_g: round(carbs100 * factor),
        sugar_g: round(sugar100 * factor),
        fiber_g: round(fiber100 * factor),
        salt_g: round(salt100 * factor),
      };
    } else if (ingredient.computed) {
      computed = {
        kcal: Number(ingredient.computed.kcal || 0),
        protein_g: Number(ingredient.computed.protein_g || 0),
        fat_g: Number(ingredient.computed.fat_g || 0),
        carbs_g: Number(ingredient.computed.carbs_g || 0),
        sugar_g: Number(ingredient.computed.sugar_g || 0),
        fiber_g: Number(ingredient.computed.fiber_g || 0),
        salt_g: Number(ingredient.computed.salt_g || 0),
      };
    }

    total = {
      kcal: round(total.kcal + computed.kcal),
      protein_g: round(total.protein_g + computed.protein_g),
      fat_g: round(total.fat_g + computed.fat_g),
      carbs_g: round(total.carbs_g + computed.carbs_g),
      sugar_g: round(total.sugar_g + computed.sugar_g),
      fiber_g: round(total.fiber_g + computed.fiber_g),
      salt_g: round(total.salt_g + computed.salt_g),
    };

    return {
      ...ingredient,
      unit: unitCode,
      grams,
      computed,
    };
  });

  const perServing = {
    kcal: round(total.kcal / servings),
    protein_g: round(total.protein_g / servings),
    fat_g: round(total.fat_g / servings),
    carbs_g: round(total.carbs_g / servings),
    sugar_g: round(total.sugar_g / servings),
    fiber_g: round(total.fiber_g / servings),
    salt_g: round(total.salt_g / servings),
  };

  const payload = {
    recipe_id: body.recipe_id,
    nutrition_total: total,
    nutrition_per_serving: perServing,
    ingredients: ingredientComputed,
    servings,
  };

  const { error: recipeUpdateError } = await admin
    .from("recipes")
    .update({ nutrition_total: total, nutrition_per_serving: perServing, nutrition_summary: { ...total, per_serving: perServing } })
    .eq("id", body.recipe_id);

  if (recipeUpdateError) {
    return NextResponse.json({ error: recipeUpdateError.message }, { status: 400 });
  }

  await admin
    .from("nutrition_calc_cache")
    .upsert({ hash: cacheHash, payload }, { onConflict: "hash" });

  return NextResponse.json({ source: "computed", ...payload });
}
