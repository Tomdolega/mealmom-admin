import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchOffSearch, simplifyOffSearchPayload } from "@/lib/off";
import type { ProfileRole } from "@/lib/types";

function sanitizeLike(value: string) {
  return value.replaceAll(",", " ").replaceAll("%", "").trim();
}

type ProductRow = {
  id: string;
  source: string;
  source_id: string;
  barcode: string | null;
  name_pl: string | null;
  name_en: string | null;
  brand: string | null;
  categories: string[] | null;
  image_url: string | null;
  nutriments: Record<string, unknown> | null;
  last_synced_at: string | null;
};

function normalizeProduct(item: ProductRow) {
  return {
    id: item.id,
    source: item.source,
    source_id: item.source_id,
    name_pl: item.name_pl,
    name_en: item.name_en,
    name: item.name_pl || item.name_en || "Unknown product",
    brand: item.brand,
    barcode: item.barcode,
    image_url: item.image_url,
    categories: item.categories || [],
    kcal_100g: Number((item.nutriments || {})["energy-kcal_100g"] || (item.nutriments || {})["kcal_100g"] || 0) || null,
    protein_100g: Number((item.nutriments || {})["proteins_100g"] || 0) || null,
    fat_100g: Number((item.nutriments || {})["fat_100g"] || 0) || null,
    carbs_100g: Number((item.nutriments || {})["carbohydrates_100g"] || 0) || null,
    sugar_100g: Number((item.nutriments || {})["sugars_100g"] || 0) || null,
    fiber_100g: Number((item.nutriments || {})["fiber_100g"] || 0) || null,
    salt_100g: Number((item.nutriments || {})["salt_100g"] || 0) || null,
  };
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const locale = (request.nextUrl.searchParams.get("lang") || "pl").trim().toLowerCase();
  const forceOff = request.nextUrl.searchParams.get("fetch_off") === "1";

  if (q.length < 3) {
    return NextResponse.json({ error: "Query must be at least 3 characters." }, { status: 400 });
  }

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
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const safeQ = sanitizeLike(q);
  const { data: localRows, error: localError } = await admin
    .from("products")
    .select("id, source, source_id, barcode, name_pl, name_en, brand, categories, image_url, nutriments, last_synced_at")
    .or(`name_pl.ilike.%${safeQ}%,name_en.ilike.%${safeQ}%,brand.ilike.%${safeQ}%`)
    .order("updated_at", { ascending: false })
    .limit(20)
    .returns<ProductRow[]>();

  if (localError) return NextResponse.json({ error: localError.message }, { status: 400 });

  if ((localRows || []).length >= 5 && !forceOff) {
    return NextResponse.json({ source: "local", results: (localRows || []).map(normalizeProduct) });
  }

  try {
    const payload = await fetchOffSearch(q, locale, 1, 20);
    const normalized = simplifyOffSearchPayload(payload);
    if (normalized.length > 0) {
      const upserts = normalized.map((item) => ({
        source: "openfoodfacts",
        source_id: item.barcode,
        barcode: item.barcode,
        name_pl: item.name,
        name_en: item.name,
        brand: item.brands,
        categories: item.categories,
        image_url: item.image_url,
        nutriments: item.nutriments_raw,
        last_synced_at: new Date().toISOString(),
      }));
      const { error: upsertError } = await admin.from("products").upsert(upserts, { onConflict: "source,source_id" });
      if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });
    }

    const sourceIds = normalized.map((item) => item.barcode);
    const { data: syncedRows } = sourceIds.length
      ? await admin
          .from("products")
          .select("id, source, source_id, barcode, name_pl, name_en, brand, categories, image_url, nutriments, last_synced_at")
          .eq("source", "openfoodfacts")
          .in("source_id", sourceIds)
          .returns<ProductRow[]>()
      : { data: [] as ProductRow[] };

    return NextResponse.json({ source: "openfoodfacts", results: (syncedRows || []).map(normalizeProduct) });
  } catch (error) {
    console.error("Product OFF search failed", { q, locale, error });
    return NextResponse.json({ error: "OpenFoodFacts search failed." }, { status: 502 });
  }
}
