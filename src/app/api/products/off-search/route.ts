import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { mapFoodProductToSearchResult, offSearchItemToFoodProductUpsert } from "@/lib/food-products";
import { fetchOffSearch, simplifyOffSearchPayload } from "@/lib/off";
import type { FoodProductRecord } from "@/lib/types";

function sanitizeLike(value: string) {
  return value.replaceAll(",", " ").replaceAll("%", "").trim();
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const locale = (request.nextUrl.searchParams.get("locale") || "pl").trim().toLowerCase();
  const fetchOff = request.nextUrl.searchParams.get("fetch_off") === "1";

  if (q.length < 3) {
    return NextResponse.json({ error: "Query must be at least 3 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const safeQ = sanitizeLike(q);
  const { data: localRows, error: localError } = await admin
    .from("food_products")
    .select(
      "id, source, source_id, barcode, name_pl, name_en, brand, categories, nutriments, kcal_100g, protein_100g, fat_100g, carbs_100g, sugar_100g, fiber_100g, salt_100g, image_url, created_at, updated_at",
    )
    .or(`name_pl.ilike.%${safeQ}%,brand.ilike.%${safeQ}%`)
    .order("updated_at", { ascending: false })
    .limit(20)
    .returns<FoodProductRecord[]>();

  if (localError) {
    return NextResponse.json({ error: localError.message }, { status: 400 });
  }

  if ((localRows || []).length > 0 && !fetchOff) {
    return NextResponse.json({
      source: "local",
      query: q,
      locale,
      results: (localRows || []).map(mapFoodProductToSearchResult),
    });
  }

  try {
    const offPayload = await fetchOffSearch(q, locale, 1, 20);
    const simplified = simplifyOffSearchPayload(offPayload);

    if (simplified.length > 0) {
      const upserts = simplified.map((item) => offSearchItemToFoodProductUpsert(item));
      const { error: upsertError } = await admin
        .from("food_products")
        .upsert(upserts, { onConflict: "source,source_id" });
      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 400 });
      }
    }

    const sourceIds = simplified.map((item) => item.barcode);
    const { data: syncedRows, error: syncedError } = sourceIds.length
      ? await admin
          .from("food_products")
          .select(
            "id, source, source_id, barcode, name_pl, name_en, brand, categories, nutriments, kcal_100g, protein_100g, fat_100g, carbs_100g, sugar_100g, fiber_100g, salt_100g, image_url, created_at, updated_at",
          )
          .eq("source", "openfoodfacts")
          .in("source_id", sourceIds)
          .returns<FoodProductRecord[]>()
      : { data: [], error: null };

    if (syncedError) {
      return NextResponse.json({ error: syncedError.message }, { status: 400 });
    }

    return NextResponse.json({
      source: "openfoodfacts",
      query: q,
      locale,
      results: (syncedRows || []).map(mapFoodProductToSearchResult),
    });
  } catch (error) {
    console.error("OFF search failed", { query: q, locale, error });
    return NextResponse.json({ error: "OpenFoodFacts search failed." }, { status: 502 });
  }
}
