import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!hasSupabaseEnv()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-xl space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">Supabase environment is not configured</h1>
          <p className="text-sm leading-6 text-slate-600">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in
            <code> .env.local</code>, then restart the app.
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
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-semibold">MealMom Admin Login</h1>
        <p className="mb-5 text-sm text-slate-600">Sign in with your email and password.</p>
        <LoginForm />
      </Card>
    </div>
  );
}
