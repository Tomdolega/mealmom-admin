"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { getClientUILang, tr } from "@/lib/ui-language.client";

export function SetPasswordForm() {
  const lang = getClientUILang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const inviteAccepted = useMemo(() => searchParams.get("invite") === "accepted", [searchParams]);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    }

    void checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError(tr(lang, "Password must be at least 8 characters.", "Hasło musi mieć co najmniej 8 znaków."));
      return;
    }
    if (password !== confirmPassword) {
      setError(tr(lang, "Passwords do not match.", "Hasła nie są takie same."));
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(
      tr(
        lang,
        "Password updated successfully. Redirecting to dashboard...",
        "Hasło zostało zapisane. Przekierowanie do panelu...",
      ),
    );
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 600);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-6 sm:py-10">
      <Card className="w-full max-w-md bg-white/70 backdrop-blur-xl">
        <h1 className="mb-1 text-2xl font-semibold">{tr(lang, "Set password", "Ustaw hasło")}</h1>
        <p className="mb-5 text-sm text-slate-600">
          {inviteAccepted
            ? tr(lang, "Invite accepted, set your password.", "Zaproszenie zaakceptowane, ustaw hasło.")
            : tr(lang, "Set a new password to continue.", "Ustaw nowe hasło, aby kontynuować.")}
        </p>

        {checkingSession ? (
          <p className="text-sm text-slate-600">{tr(lang, "Checking session...", "Sprawdzanie sesji...")}</p>
        ) : hasSession ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormField label={tr(lang, "New password", "Nowe hasło")}>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            <FormField label={tr(lang, "Confirm password", "Potwierdź hasło")}>
              <Input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </FormField>

            {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
            {message ? <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}

            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? tr(lang, "Saving password...", "Zapisywanie hasła...")
                : tr(lang, "Save password", "Zapisz hasło")}
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">
              {tr(
                lang,
                "No active invite session. Open the invite link from your email again.",
                "Brak aktywnej sesji zaproszenia. Otwórz ponownie link z e-maila.",
              )}
            </p>
            <Button type="button" variant="secondary" className="w-full" onClick={() => router.push("/login")}>
              {tr(lang, "Go to login", "Przejdź do logowania")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
