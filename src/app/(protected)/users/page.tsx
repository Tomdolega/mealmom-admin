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
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">User roles</h1>
        <p className="mt-1 text-sm text-slate-600">
          This is an admin-only control area. Role changes affect permissions immediately across the panel.
        </p>
      </section>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load users right now.</p> : null}
      <UserRoleManager profiles={profiles || []} />
    </div>
  );
}
