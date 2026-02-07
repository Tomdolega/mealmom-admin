import { AppShell } from "@/components/app-shell";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { getServerUILang, uiDict } from "@/lib/ui-language";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ profile }, lang] = await Promise.all([getCurrentProfileOrRedirect(), getServerUILang()]);

  return (
    <AppShell role={profile.role} displayName={profile.display_name} lang={lang} labels={uiDict[lang].nav}>
      {children}
    </AppShell>
  );
}
