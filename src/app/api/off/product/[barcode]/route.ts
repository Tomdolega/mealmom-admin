import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapFoodProductToSearchResult } from "@/lib/food-products";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchOffProduct, simplifyOffProductPayload } from "@/lib/off";
import type { FoodProductRecord } from "@/lib/types";

const PRODUCT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_PER_MINUTE = 30;

function getIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest, context: { params: Promise<unknown> }) {
  const ip = getIp(request);
  const rate = checkRateLimit(`off:product:${ip}`, RATE_LIMIT_PER_MINUTE, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please retry shortly.", retry_after_ms: Math.max(0, rate.resetAt - Date.now()) },
      { status: 429 },
    );
  }

  const params = (await context.params) as { barcode?: string };
  const barcode = params.barcode || "";
  const cleanBarcode = String(barcode || "").trim();
  if (!cleanBarcode) {
    return NextResponse.json({ error: "Missing barcode." }, { status: 400 });
  }
  const lc = (request.nextUrl.searchParams.get("lc") || "pl").trim().toLowerCase();

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL for OFF cache API." },
      { status: 500 },
    );
  }
  const { data: cached, error: cacheReadError } = await admin
    .from("product_cache")
    .select("payload, expires_at")
    .eq("barcode", cleanBarcode)
    .maybeSingle<{ payload: unknown; expires_at: string }>();

  if (!cacheReadError && cached && new Date(cached.expires_at).getTime() > Date.now()) {
    const { data: localRow } = await admin
      .from("food_products")
      .select(
        "id, source, source_id, barcode, name_pl, name_en, brand, categories, nutriments, kcal_100g, protein_100g, fat_100g, carbs_100g, sugar_100g, fiber_100g, salt_100g, created_at, updated_at",
      )
      .eq("source", "openfoodfacts")
      .eq("source_id", cleanBarcode)
      .maybeSingle<FoodProductRecord>();

    return NextResponse.json({
      source: "cache",
      barcode: cleanBarcode,
      lc,
      product: cached.payload,
      local: localRow ? mapFoodProductToSearchResult(localRow) : null,
    });
  }

  try {
    const rawPayload = await fetchOffProduct(cleanBarcode, lc);
    const simplified = simplifyOffProductPayload(rawPayload, cleanBarcode);
    if (!simplified) {
      return NextResponse.json({ error: "Product not found in OpenFoodFacts." }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + PRODUCT_TTL_MS).toISOString();
    const { error: cacheWriteError } = await admin.from("product_cache").upsert(
      {
        barcode: cleanBarcode,
        payload: simplified,
        expires_at: expiresAt,
      },
      { onConflict: "barcode" },
    );
    if (cacheWriteError) {
      console.warn("OFF product cache write failed", {
        message: cacheWriteError.message,
        code: cacheWriteError.code,
      });
    }

    const { error: productWriteError } = await admin.from("food_products").upsert(
      {
        source: "openfoodfacts",
        source_id: cleanBarcode,
        barcode: cleanBarcode,
        name_pl: simplified.name,
        name_en: simplified.name,
        brand: simplified.brands,
        categories: simplified.categories,
        nutriments: rawPayload,
        kcal_100g: simplified.nutrition_per_100g.kcal,
        protein_100g: simplified.nutrition_per_100g.protein_g,
        fat_100g: simplified.nutrition_per_100g.fat_g,
        carbs_100g: simplified.nutrition_per_100g.carbs_g,
        sugar_100g: simplified.nutrition_per_100g.sugar_g,
        fiber_100g: simplified.nutrition_per_100g.fiber_g,
        salt_100g: simplified.nutrition_per_100g.salt_g,
      },
      { onConflict: "source,source_id" },
    );
    if (productWriteError) {
      console.warn("OFF product food_products upsert failed", {
        message: productWriteError.message,
        code: productWriteError.code,
      });
    }

    const { data: localRow } = await admin
      .from("food_products")
      .select(
        "id, source, source_id, barcode, name_pl, name_en, brand, categories, nutriments, kcal_100g, protein_100g, fat_100g, carbs_100g, sugar_100g, fiber_100g, salt_100g, created_at, updated_at",
      )
      .eq("source", "openfoodfacts")
      .eq("source_id", cleanBarcode)
      .maybeSingle<FoodProductRecord>();

    return NextResponse.json({
      source: "off",
      barcode: cleanBarcode,
      lc,
      product: simplified,
      local: localRow ? mapFoodProductToSearchResult(localRow) : null,
    });
  } catch (error) {
    console.error("OFF product fetch failed", { barcode: cleanBarcode, lc, error });
    return NextResponse.json(
      { error: "OpenFoodFacts product fetch failed. Please try again later." },
      { status: 502 },
    );
  }
}
