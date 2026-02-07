"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRecord, ProfileRole } from "@/lib/types";

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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">User ID</th>
              <th className="px-3 py-2 text-left font-medium">Display Name</th>
              <th className="px-3 py-2 text-left font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((profile) => (
              <tr key={profile.id}>
                <td className="px-3 py-2 font-mono text-xs">{profile.id}</td>
                <td className="px-3 py-2">{profile.display_name || "-"}</td>
                <td className="px-3 py-2">
                  <select
                    value={profile.role}
                    disabled={savingId === profile.id}
                    className="rounded-md border border-slate-300 px-2 py-1"
                    onChange={(e) => updateRole(profile.id, e.target.value as ProfileRole)}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
