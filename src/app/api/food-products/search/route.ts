import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapFoodProductToSearchResult } from "@/lib/food-products";
import type { FoodProductRecord } from "@/lib/types";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const safeQ = q.replaceAll(",", " ").replaceAll("%", "");
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") || 12);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 12;

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("food_products")
    .select(
      "id, source, source_id, barcode, name_pl, name_en, brand, categories, nutriments, kcal_100g, protein_100g, fat_100g, carbs_100g, sugar_100g, fiber_100g, salt_100g, created_at, updated_at",
    )
    .or(`name_pl.ilike.%${safeQ}%,brand.ilike.%${safeQ}%`)
    .order("updated_at", { ascending: false })
    .limit(limit)
    .returns<FoodProductRecord[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    source: "local",
    query: q,
    results: (data || []).map(mapFoodProductToSearchResult),
  });
}
