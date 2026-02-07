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
    language: string;
    signOut: string;
    userDefault: string;
  };
  children: React.ReactNode;
};

export function AppShell({ role, displayName, lang, labels, children }: AppShellProps) {
  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/55 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-slate-900">Culinae Admin</p>
            <p className="truncate text-xs text-slate-500">
              {displayName || labels.userDefault} · {role}
            </p>
          </div>

          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 border-x border-white/60 px-4">
            <NavLink href="/dashboard">{labels.dashboard}</NavLink>
            {role !== "reviewer" ? <NavLink href="/recipes/new">{labels.newRecipe}</NavLink> : null}
            <NavLink href="/settings">{labels.settings}</NavLink>
            {role === "admin" ? <NavLink href="/import">{labels.import}</NavLink> : null}
            {role === "admin" ? <NavLink href="/users">{labels.users}</NavLink> : null}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher lang={lang} label={labels.language} />
            <LogoutButton label={labels.signOut} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
