import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LabelRecord, ProfileRole } from "@/lib/types";

type LabelCreateBody = {
  name?: string;
  color?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: ProfileRole }>();

  if (!profile || !["admin", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as LabelCreateBody;
  const name = body.name?.trim();
  const color = body.color?.trim() || null;
  if (!name) {
    return NextResponse.json({ error: "Label name is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("labels")
    .upsert({ name, color }, { onConflict: "name" })
    .select("id, name, color, created_at")
    .maybeSingle<LabelRecord>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ label: data });
}
