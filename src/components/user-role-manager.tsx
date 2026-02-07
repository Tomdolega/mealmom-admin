"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRecord, ProfileRole } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type UserRoleManagerProps = {
  profiles: ProfileRecord[];
};

const roles: ProfileRole[] = ["admin", "editor", "reviewer"];

export function UserRoleManager({ profiles }: UserRoleManagerProps) {
  const [items, setItems] = useState(profiles);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(id: string, role: ProfileRole) {
    setSavingId(id);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.from("profiles").update({ role }).eq("id", id);

    setSavingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, role } : item)));
  }

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Card className="overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">User ID</th>
              <th className="px-4 py-3 text-left font-medium">Display Name</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((profile) => (
              <tr key={profile.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-mono text-xs">{profile.id}</td>
                <td className="px-4 py-3">{profile.display_name || "-"}</td>
                <td className="px-4 py-3">
                  <Select
                    value={profile.role}
                    disabled={savingId === profile.id}
                    className="max-w-[180px]"
                    onChange={(e) => updateRole(profile.id, e.target.value as ProfileRole)}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
