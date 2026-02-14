import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchOffSearch, simplifyOffSearchPayload } from "@/lib/off";
import type { ProfileRole } from "@/lib/types";

type ImportRequest = {
  locale?: string;
  terms?: string[];
  pagesPerTerm?: number;
  pageSize?: number;
};

const DEFAULT_TERMS = ["mleko", "jogurt", "ser", "makaron", "ryż", "kurczak", "tuńczyk", "pomidor", "chleb"];

function normalizeTerms(input?: string[]) {
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_TERMS;
  return [...new Set(input.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 50);
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

  const body = (await request.json().catch(() => ({}))) as ImportRequest;
  const locale = String(body.locale || "pl").trim().toLowerCase();
  const terms = normalizeTerms(body.terms);
  const pagesPerTerm = Number.isFinite(body.pagesPerTerm) ? Math.max(1, Math.min(5, Number(body.pagesPerTerm))) : 2;
  const pageSize = Number.isFinite(body.pageSize) ? Math.max(10, Math.min(100, Number(body.pageSize))) : 50;

  let inserted = 0;
  let updated = 0;

  for (const term of terms) {
    for (let page = 1; page <= pagesPerTerm; page += 1) {
      const payload = await fetchOffSearch(term, locale, page, pageSize);
      const normalized = simplifyOffSearchPayload(payload);
      if (normalized.length === 0) continue;

      const sourceIds = normalized.map((item) => item.barcode);
      const { data: existing } = await admin
        .from("products")
        .select("source_id")
        .eq("source", "openfoodfacts")
        .in("source_id", sourceIds)
        .returns<Array<{ source_id: string }>>();

      const existingSet = new Set((existing || []).map((item) => item.source_id));

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

      for (const item of upserts) {
        if (existingSet.has(item.source_id)) updated += 1;
        else inserted += 1;
      }
    }
  }

  return NextResponse.json({ count_inserted: inserted, count_updated: updated, locale, terms_count: terms.length });
}
