import { notFound } from "next/navigation";
import { UserRoleManager } from "@/components/user-role-manager";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import type { ProfileRecord } from "@/lib/types";

export default async function UsersPage() {
  const { supabase, profile } = await getCurrentProfileOrRedirect();

  if (profile.role !== "admin") {
    notFound();
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, created_at, updated_at")
    .order("created_at", { ascending: true })
    .returns<ProfileRecord[]>();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">User roles</h1>
      <p className="text-sm text-slate-600">Admin-only page to manage roles in the profiles table.</p>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error.message}</p> : null}
      <UserRoleManager profiles={profiles || []} />
    </div>
  );
}
