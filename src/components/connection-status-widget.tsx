"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type State = "idle" | "loading" | "ok" | "error";

export function ConnectionStatusWidget() {
  const lang = getClientUILang();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>(
    tr(lang, "Run a quick check to confirm Supabase availability.", "Uruchom szybki test połączenia z Supabase."),
  );

  async function checkConnection() {
    setState("loading");
    setMessage(tr(lang, "Checking connection...", "Sprawdzanie połączenia..."));

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setState("error");
        setMessage(tr(lang, "Session is unavailable. Please sign in again.", "Sesja jest niedostępna. Zaloguj się ponownie."));
        return;
      }

      const { error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();

      if (error) {
        setState("error");
        setMessage(tr(lang, "Connection failed. Please retry in a moment.", "Połączenie nieudane. Spróbuj ponownie za chwilę."));
        return;
      }

      setState("ok");
      setMessage(tr(lang, "Connection OK. Database queries are responding.", "Połączenie OK. Zapytania do bazy działają."));
    } catch {
      setState("error");
      setMessage(tr(lang, "Connection check failed unexpectedly.", "Nieoczekiwany błąd podczas sprawdzania połączenia."));
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tr(lang, "System connection", "Połączenie systemowe")}</h3>
          <p className={state === "error" ? "mt-1 text-sm text-red-700" : "mt-1 text-sm text-slate-600"}>{message}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={checkConnection} disabled={state === "loading"}>
          {state === "loading" ? tr(lang, "Checking...", "Sprawdzanie...") : tr(lang, "Check", "Sprawdź")}
        </Button>
      </div>
    </section>
  );
}
