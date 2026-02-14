import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchOffSearch, simplifyOffSearchPayload } from "@/lib/off";

const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_PER_MINUTE = 30;

function normalizeQuery(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function makeCacheKey(query: string, lc: string) {
  return `${lc}:${query}`;
}

function getIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const ip = getIp(request);
  const rate = checkRateLimit(`off:search:${ip}`, RATE_LIMIT_PER_MINUTE, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please retry shortly.", retry_after_ms: Math.max(0, rate.resetAt - Date.now()) },
      { status: 429 },
    );
  }

  const q = normalizeQuery(request.nextUrl.searchParams.get("q") || "");
  const lc = (request.nextUrl.searchParams.get("lc") || "pl").trim().toLowerCase();
  if (q.length < 3) {
    return NextResponse.json({ error: "Query must be at least 3 characters." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL for OFF cache API." },
      { status: 500 },
    );
  }
  const cacheKey = makeCacheKey(q, lc);

  const { data: cached, error: cacheReadError } = await admin
    .from("search_cache")
    .select("payload, expires_at")
    .eq("query", cacheKey)
    .maybeSingle<{ payload: unknown; expires_at: string }>();

  if (!cacheReadError && cached && new Date(cached.expires_at).getTime() > Date.now()) {
    return NextResponse.json({
      source: "cache",
      query: q,
      lc,
      results: cached.payload,
    });
  }

  try {
    const rawPayload = await fetchOffSearch(q, lc);
    const simplified = simplifyOffSearchPayload(rawPayload);
    const expiresAt = new Date(Date.now() + SEARCH_TTL_MS).toISOString();

    const { error: cacheWriteError } = await admin.from("search_cache").upsert(
      {
        query: cacheKey,
        lc,
        payload: simplified,
        expires_at: expiresAt,
      },
      { onConflict: "query" },
    );
    if (cacheWriteError) {
      console.warn("OFF search cache write failed", {
        message: cacheWriteError.message,
        code: cacheWriteError.code,
      });
    }

    return NextResponse.json({
      source: "off",
      query: q,
      lc,
      results: simplified,
    });
  } catch (error) {
    console.error("OFF search failed", { query: q, lc, error });
    return NextResponse.json(
      { error: "OpenFoodFacts search is temporarily unavailable. Try again in a moment." },
      { status: 502 },
    );
  }
}
