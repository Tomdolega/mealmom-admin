import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { offSearchItemToFoodProductUpsert } from "@/lib/food-products";
import { fetchOffSearch, simplifyOffSearchPayload } from "@/lib/off";
import type { ProfileRole } from "@/lib/types";

type SeedBody = {
  locale?: string;
  terms?: string[];
  pagesPerTerm?: number;
  pageSize?: number;
};

const DEFAULT_TERMS = [
  "mleko",
  "jogurt",
  "ser",
  "makaron",
  "ryż",
  "kurczak",
  "tuńczyk",
  "pomidor",
  "chleb",
  "masło",
  "oliwa",
  "jajka",
];

function normalizeTerms(input?: string[]) {
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_TERMS;
  return [...new Set(input.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 40);
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

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as SeedBody;
  const locale = String(body.locale || "pl").trim().toLowerCase();
  const terms = normalizeTerms(body.terms);
  const pagesPerTerm = Number.isFinite(body.pagesPerTerm)
    ? Math.max(1, Math.min(5, Number(body.pagesPerTerm)))
    : 2;
  const pageSize = Number.isFinite(body.pageSize)
    ? Math.max(10, Math.min(100, Number(body.pageSize)))
    : 40;

  let inserted = 0;
  let updated = 0;

  for (const term of terms) {
    for (let page = 1; page <= pagesPerTerm; page += 1) {
      const payload = await fetchOffSearch(term, locale, page, pageSize);
      const simplified = simplifyOffSearchPayload(payload);
      if (simplified.length === 0) continue;

      const sourceIds = simplified.map((item) => item.barcode);
      const { data: existing } = await admin
        .from("food_products")
        .select("source_id")
        .eq("source", "openfoodfacts")
        .in("source_id", sourceIds)
        .returns<Array<{ source_id: string }>>();

      const existingSet = new Set((existing || []).map((item) => item.source_id));

      const upserts = simplified.map((item) => offSearchItemToFoodProductUpsert(item));
      const { error } = await admin.from("food_products").upsert(upserts, { onConflict: "source,source_id" });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      for (const row of upserts) {
        if (existingSet.has(row.source_id)) updated += 1;
        else inserted += 1;
      }
    }
  }

  return NextResponse.json({
    locale,
    terms_count: terms.length,
    count_inserted: inserted,
    count_updated: updated,
  });
}
