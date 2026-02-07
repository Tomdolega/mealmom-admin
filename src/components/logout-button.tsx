"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  label: string;
};

export function LogoutButton({ label }: LogoutButtonProps) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
