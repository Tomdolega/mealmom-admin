import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import type { ProfileRole } from "@/lib/types";

type InviteRequestBody = {
  email?: string;
  role?: ProfileRole;
  display_name?: string;
};

const allowedRoles: ProfileRole[] = ["admin", "editor", "reviewer"];

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

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json(
      {
        error:
          "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to environment variables to enable user invites.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as InviteRequestBody;
  const email = body.email?.trim().toLowerCase();
  const role = body.role;
  const displayName = body.display_name?.trim() || null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role value." }, { status: 400 });
  }

  const admin = createAdminClient();
  const requestUrl = new URL(request.url);
  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : requestUrl.origin);
  const normalizedAppUrl = appUrl.replace(/\/+$/, "");
  const redirectTo = `${normalizedAppUrl}/auth/callback`;
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: displayName ? { display_name: displayName } : undefined,
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const invitedId = inviteData.user?.id;
  if (!invitedId) {
    return NextResponse.json(
      { error: "Invite succeeded but no user id was returned by Supabase." },
      { status: 502 },
    );
  }

  const { data: upsertedProfile, error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: invitedId,
        role,
        display_name: displayName,
      },
      { onConflict: "id" },
    )
    .select("id, display_name, role, created_at, updated_at")
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({
    invited: true,
    profile: upsertedProfile,
  });
}
