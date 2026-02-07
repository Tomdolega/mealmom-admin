import type { ProfileRole } from "@/lib/types";
import { LogoutButton } from "@/components/logout-button";
import { NavLink } from "@/components/nav-link";

type AppShellProps = {
  role: ProfileRole;
  displayName?: string | null;
  children: React.ReactNode;
};

export function AppShell({ role, displayName, children }: AppShellProps) {
  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-slate-900">MealMom Admin</p>
            <p className="truncate text-xs text-slate-500">
              {displayName || "User"} · {role}
            </p>
          </div>
          <div className="ml-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/recipes/new">New Recipe</NavLink>
            <NavLink href="/settings">Settings</NavLink>
            {role === "admin" ? <NavLink href="/import">Import</NavLink> : null}
            {role === "admin" ? <NavLink href="/users">Users</NavLink> : null}
          </div>
          <div className="ml-4">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
