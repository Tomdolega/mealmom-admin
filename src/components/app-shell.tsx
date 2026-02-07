import Link from "next/link";
import type { ProfileRole } from "@/lib/types";
import { LogoutButton } from "@/components/logout-button";

type AppShellProps = {
  role: ProfileRole;
  displayName?: string | null;
  children: React.ReactNode;
};

export function AppShell({ role, displayName, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-lg font-semibold">MealMom Admin</p>
            <p className="text-sm text-slate-500">
              Signed in as {displayName || "User"} ({role})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-3 px-4 pb-4 sm:px-6 lg:px-8">
          <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" href="/dashboard">
            Dashboard
          </Link>
          <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" href="/recipes/new">
            New Recipe
          </Link>
          {role === "admin" ? (
            <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" href="/users">
              Users
            </Link>
          ) : null}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
