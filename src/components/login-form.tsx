"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryError =
    searchParams.get("error") === "profile_missing"
      ? "Your account has no profile row yet. Ask an admin to create or sync your profile."
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <FormField label="Email">
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
        />
      </FormField>
      <FormField label="Password">
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>

      {queryError ? <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">{queryError}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
