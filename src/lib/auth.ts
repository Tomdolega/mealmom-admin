import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRecord, ProfileRole } from "@/lib/types";

export async function getSessionOrRedirect() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return { supabase, session };
}

export async function getCurrentProfileOrRedirect() {
  const { supabase, session } = await getSessionOrRedirect();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, created_at, updated_at")
    .eq("id", session.user.id)
    .maybeSingle<ProfileRecord>();

  if (!profile) {
    redirect("/login?error=profile_missing");
  }

  return { supabase, session, profile };
}

export function requireRole(role: ProfileRole, userRole: ProfileRole) {
  return role === userRole;
}
