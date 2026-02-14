import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchOffSearch, simplifyOffSearchPayload } from "@/lib/off";

const DEFAULT_TERMS = [
  "mleko",
  "jogurt",
  "ser",
  "chleb",
  "makaron",
  "ryż",
  "kurczak",
  "wołowina",
  "jajka",
  "masło",
  "oliwa",
  "pomidor",
  "ziemniaki",
  "jabłko",
  "banan",
  "płatki owsiane",
];

type SeedBody = {
  runId?: string;
  locale?: string;
  terms?: string[];
  page?: number;
  pageSize?: number;
};

function normalizeTerms(values?: string[]) {
  if (!Array.isArray(values) || values.length === 0) return DEFAULT_TERMS;
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 50);
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rate = checkRateLimit(`off:seed:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many seed requests. Try again shortly." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as SeedBody;
  const locale = String(body.locale || "pl").trim().toLowerCase();
  const terms = normalizeTerms(body.terms);
  const page = Number.isFinite(body.page) ? Math.max(1, Number(body.page)) : 1;
  const pageSize = Number.isFinite(body.pageSize) ? Math.max(20, Math.min(100, Number(body.pageSize))) : 50;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const termIndex = body.runId ? undefined : 0;
  let runId = body.runId;

  if (!runId) {
    const { data: run, error: runError } = await admin
      .from("off_seed_runs")
      .insert({
        locale,
        terms,
        status: "running",
        processed_count: 0,
        upserted_count: 0,
        error_count: 0,
        cursor: { termIndex: 0, page },
        logs: [],
      })
      .select("id")
      .single<{ id: string }>();

    if (runError || !run) {
      return NextResponse.json({ error: runError?.message || "Could not start seed run." }, { status: 400 });
    }
    runId = run.id;
  }

  const { data: existingRun } = await admin
    .from("off_seed_runs")
    .select("id, terms, locale, cursor, processed_count, upserted_count, error_count, logs")
    .eq("id", runId)
    .maybeSingle<{
      id: string;
      terms: string[];
      locale: string;
      cursor: { termIndex?: number; page?: number };
      processed_count: number;
      upserted_count: number;
      error_count: number;
      logs: unknown[];
    }>();

  if (!existingRun) {
    return NextResponse.json({ error: "Seed run not found." }, { status: 404 });
  }

  const runTerms = existingRun.terms?.length ? existingRun.terms : terms;
  const cursorTermIndex = Math.max(0, Number(existingRun.cursor?.termIndex ?? termIndex ?? 0));
  const cursorPage = Math.max(1, Number(existingRun.cursor?.page ?? page));

  if (cursorTermIndex >= runTerms.length) {
    await admin.from("off_seed_runs").update({ status: "done" }).eq("id", runId);
    return NextResponse.json({
      runId,
      status: "done",
      progress: {
        processed: existingRun.processed_count,
        upserted: existingRun.upserted_count,
        errors: existingRun.error_count,
      },
      next: null,
    });
  }

  const currentTerm = runTerms[cursorTermIndex];
  let processed = existingRun.processed_count;
  let upserted = existingRun.upserted_count;
  let errors = existingRun.error_count;
  const logs = Array.isArray(existingRun.logs) ? existingRun.logs.slice(-50) : [];

  try {
    const payload = await fetchOffSearch(currentTerm, locale, cursorPage, pageSize);
    const simplified = simplifyOffSearchPayload(payload);
    processed += simplified.length;

    if (simplified.length > 0) {
      const upserts = simplified.map((item) => ({
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
      }));
      const { error: upsertError } = await admin
        .from("food_products")
        .upsert(upserts, { onConflict: "source,source_id" });
      if (upsertError) {
        errors += simplified.length;
        logs.push({ at: new Date().toISOString(), level: "error", term: currentTerm, message: upsertError.message });
      } else {
        upserted += simplified.length;
        logs.push({ at: new Date().toISOString(), level: "info", term: currentTerm, message: `Upserted ${simplified.length}` });
      }
    }

    const totalPages = Number((payload as { page_count?: number }).page_count || 1);
    const nextPage = cursorPage + 1;
    const moveToNextTerm = nextPage > totalPages || simplified.length === 0;
    const nextCursor = moveToNextTerm
      ? { termIndex: cursorTermIndex + 1, page: 1 }
      : { termIndex: cursorTermIndex, page: nextPage };
    const done = nextCursor.termIndex >= runTerms.length;

    await admin
      .from("off_seed_runs")
      .update({
        status: done ? "done" : "running",
        processed_count: processed,
        upserted_count: upserted,
        error_count: errors,
        cursor: nextCursor,
        logs,
      })
      .eq("id", runId);

    return NextResponse.json({
      runId,
      status: done ? "done" : "running",
      progress: {
        term: currentTerm,
        page: cursorPage,
        processed,
        upserted,
        errors,
      },
      next: done ? null : nextCursor,
    });
  } catch (error) {
    errors += 1;
    logs.push({ at: new Date().toISOString(), level: "error", term: currentTerm, message: "OFF fetch failed" });

    await admin
      .from("off_seed_runs")
      .update({
        status: "error",
        processed_count: processed,
        upserted_count: upserted,
        error_count: errors,
        logs,
      })
      .eq("id", runId);

    console.error("OFF seed failed", { runId, term: currentTerm, error });
    return NextResponse.json({ error: "Seeding failed for current batch.", runId }, { status: 502 });
  }
}
