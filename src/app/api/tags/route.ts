import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeTagSlug } from "@/lib/food-products";
import type { ProfileRole, TagRecord } from "@/lib/types";

type TagCreateBody = {
  name?: string;
  slug?: string;
  type?: string;
  nameEn?: string;
};

async function getProfileRole() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { session: null as null, role: null as ProfileRole | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: ProfileRole }>();

  return { session, role: profile?.role || null };
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const safeQ = q.replaceAll(",", " ").replaceAll("%", "");
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 100)) : 20;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  let query = admin
    .from("tags")
    .select("id, slug, name_pl, name_en, type, created_at, updated_at")
    .order("name_pl", { ascending: true })
    .limit(limit);

  if (q.length >= 2) {
    query = query.or(`name_pl.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`);
  }

  const { data, error } = await query.returns<TagRecord[]>();

  if (error) {
    const schemaCacheHint =
      error.message.includes("schema cache") || error.message.includes("public.tags")
        ? "Table public.tags is missing from PostgREST schema cache. Run latest SQL migration and reload schema (NOTIFY pgrst, 'reload schema')."
        : undefined;
    return NextResponse.json({ error: schemaCacheHint || error.message }, { status: 400 });
  }

  return NextResponse.json({ tags: data || [] });
}

export async function POST(request: NextRequest) {
  const { session, role } = await getProfileRole();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!role || !["admin", "editor"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as TagCreateBody;
  const name = String(body.name || "").trim();
  const slug = normalizeTagSlug(body.slug || name);
  if (!name || !slug) {
    return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("tags")
    .upsert(
      {
        slug,
        name_pl: name,
        name_en: body.nameEn?.trim() || null,
        type: String(body.type || "custom").trim() || "custom",
      },
      { onConflict: "slug" },
    )
    .select("id, slug, name_pl, name_en, type, created_at, updated_at")
    .single<TagRecord>();

  if (error) {
    const schemaCacheHint =
      error.message.includes("schema cache") || error.message.includes("public.tags")
        ? "Table public.tags is missing from PostgREST schema cache. Run latest SQL migration and reload schema (NOTIFY pgrst, 'reload schema')."
        : undefined;
    return NextResponse.json({ error: schemaCacheHint || error.message }, { status: 400 });
  }

  return NextResponse.json({ tag: data });
}
