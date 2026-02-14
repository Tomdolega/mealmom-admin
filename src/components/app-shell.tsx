import type { ProfileRole } from "@/lib/types";
import type { UILang } from "@/lib/ui-language.server";
import { LogoutButton } from "@/components/logout-button";
import { NavLink } from "@/components/nav-link";
import { LanguageSwitcher } from "@/components/language-switcher";

type AppShellProps = {
  role: ProfileRole;
  displayName?: string | null;
  lang: UILang;
  labels: {
    dashboard: string;
    newRecipe: string;
    settings: string;
    import: string;
    users: string;
    trash: string;
    language: string;
    signOut: string;
    userDefault: string;
  };
  children: React.ReactNode;
};

export function AppShell({ role, displayName, lang, labels, children }: AppShellProps) {
  const navItems = (
    <>
      <NavLink href="/dashboard">{labels.dashboard}</NavLink>
      {role !== "reviewer" ? <NavLink href="/recipes/new">{labels.newRecipe}</NavLink> : null}
      <NavLink href="/settings">{labels.settings}</NavLink>
      {role !== "reviewer" ? <NavLink href="/trash">{labels.trash}</NavLink> : null}
      {role === "admin" ? <NavLink href="/import">{labels.import}</NavLink> : null}
      {role === "admin" ? <NavLink href="/users">{labels.users}</NavLink> : null}
    </>
  );

  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/55 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-slate-900">Culinae Admin</p>
              <p className="truncate text-xs text-slate-500">
                {displayName || labels.userDefault} · {role}
              </p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <LanguageSwitcher lang={lang} label={labels.language} />
              <LogoutButton label={labels.signOut} />
            </div>
          </div>

          <nav className="mt-3 hidden min-w-0 items-center justify-center gap-1 border-t border-white/60 pt-3 sm:flex">
            {navItems}
          </nav>

          <div className="mt-3 space-y-2 sm:hidden">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">{navItems}</div>
            <div className="flex items-center justify-between gap-2 border-t border-white/60 pt-2">
              <LanguageSwitcher lang={lang} label={labels.language} />
              <LogoutButton label={labels.signOut} />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
