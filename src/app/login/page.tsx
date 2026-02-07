import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { Card } from "@/components/ui/card";
import { getServerUILang, tr } from "@/lib/ui-language.server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
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

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md bg-white/70 backdrop-blur-xl">
        <h1 className="mb-1 text-2xl font-semibold">Culinae Admin</h1>
        <p className="mb-5 text-sm text-slate-600">
          {tr(lang, "Sign in with your email and password.", "Zaloguj się e-mailem i hasłem.")}
        </p>
        <LoginForm />
      </Card>
    </div>
  );
}
