import { AppShell } from "@/components/app-shell";
import { getCurrentProfileOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { profile } = await getCurrentProfileOrRedirect();

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      {children}
    </AppShell>
  );
}
