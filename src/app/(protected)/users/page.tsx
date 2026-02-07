import { notFound } from "next/navigation";
import { UserRoleManager } from "@/components/user-role-manager";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { ProfileRecord } from "@/lib/types";

export default async function UsersPage() {
  const [{ supabase, profile }, lang] = await Promise.all([getCurrentProfileOrRedirect(), getServerUILang()]);

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
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tr(lang, "User roles", "Role użytkowników")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(lang, "This is an admin-only control area. Role changes affect permissions immediately across the panel.", "To strefa tylko dla administratora. Zmiany ról wpływają od razu na uprawnienia w całym panelu.")}
        </p>
      </section>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{tr(lang, "Could not load users right now.", "Nie udało się pobrać użytkowników.")}</p> : null}
      <UserRoleManager profiles={profiles || []} />
    </div>
  );
}
