"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type State = "idle" | "loading" | "ok" | "error";

export function ConnectionStatusWidget() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>("Run a quick check to confirm Supabase availability.");

  async function checkConnection() {
    setState("loading");
    setMessage("Checking connection...");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setState("error");
        setMessage("Session is unavailable. Please sign in again.");
        return;
      }

      const { error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();

      if (error) {
        setState("error");
        setMessage("Connection failed. Please retry in a moment.");
        return;
      }

      setState("ok");
      setMessage("Connection OK. Database queries are responding.");
    } catch {
      setState("error");
      setMessage("Connection check failed unexpectedly.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">System connection</h3>
          <p className={state === "error" ? "mt-1 text-sm text-red-700" : "mt-1 text-sm text-slate-600"}>{message}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={checkConnection} disabled={state === "loading"}>
          {state === "loading" ? "Checking..." : "Check"}
        </Button>
      </div>
    </section>
  );
}
