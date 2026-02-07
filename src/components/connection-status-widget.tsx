"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type State = "idle" | "loading" | "ok" | "error";

export function ConnectionStatusWidget() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>("Not checked yet.");

  async function checkConnection() {
    setState("loading");
    setMessage("Checking Supabase connection...");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setState("error");
        setMessage(userError?.message || "No active session.");
        return;
      }

      const { error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();

      if (error) {
        setState("error");
        setMessage(error.message);
        return;
      }

      setState("ok");
      setMessage("Connection OK. Supabase query succeeded.");
    } catch {
      setState("error");
      setMessage("Unexpected connection error.");
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Connection status</h2>
        <p className="text-sm text-slate-600">Quick check using your profile query.</p>
      </div>
      <p
        className={
          state === "ok"
            ? "text-sm text-emerald-700"
            : state === "error"
              ? "text-sm text-red-700"
              : "text-sm text-slate-600"
        }
      >
        {message}
      </p>
      <Button variant="secondary" size="sm" onClick={checkConnection} disabled={state === "loading"}>
        {state === "loading" ? "Checking..." : "Check connection"}
      </Button>
    </Card>
  );
}
