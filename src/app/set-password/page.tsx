import { SetPasswordForm } from "@/components/set-password-form";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { Card } from "@/components/ui/card";
import { getServerUILang, tr } from "@/lib/ui-language.server";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const lang = await getServerUILang();

  if (!hasSupabaseEnv()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-xl space-y-3 bg-white/70 backdrop-blur-xl">
          <h1 className="text-2xl font-semibold text-slate-900">
            {tr(lang, "Supabase environment is not configured", "Środowisko Supabase nie jest skonfigurowane")}
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            {tr(
              lang,
              "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the app.",
              "Dodaj NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY do .env.local, a następnie uruchom aplikację ponownie.",
            )}
          </p>
        </Card>
      </div>
    );
  }

  return <SetPasswordForm />;
}
