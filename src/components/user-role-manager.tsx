"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRecord, ProfileRole } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type UserRoleManagerProps = {
  profiles: ProfileRecord[];
};

const roles: ProfileRole[] = ["admin", "editor", "reviewer"];

export function UserRoleManager({ profiles }: UserRoleManagerProps) {
  const [items, setItems] = useState(profiles);
  const [pendingRoles, setPendingRoles] = useState<Record<string, ProfileRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function applyRoleChange(id: string) {
    const nextRole = pendingRoles[id];
    const current = items.find((item) => item.id === id);
    if (!nextRole || !current || nextRole === current.role) return;

    const confirm = window.confirm(`Change role for ${current.display_name || current.id} to '${nextRole}'?`);
    if (!confirm) return;

    setSavingId(id);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.from("profiles").update({ role: nextRole }).eq("id", id);

    setSavingId(null);

    if (updateError) {
      setError("Could not update this role. Please try again.");
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, role: nextRole } : item)));
    setPendingRoles((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setMessage("Role updated.");
  }

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">User</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Current role</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">New role</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((profile) => {
              const selected = pendingRoles[profile.id] || profile.role;
              const changed = selected !== profile.role;

              return (
                <tr key={profile.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{profile.display_name || "No display name"}</p>
                    <p className="font-mono text-xs text-slate-500">{profile.id}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{profile.role}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={selected}
                      disabled={savingId === profile.id}
                      className="max-w-[180px]"
                      onChange={(e) =>
                        setPendingRoles((prev) => ({
                          ...prev,
                          [profile.id]: e.target.value as ProfileRole,
                        }))
                      }
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant={changed ? "primary" : "secondary"}
                      disabled={!changed || savingId === profile.id}
                      onClick={() => void applyRoleChange(profile.id)}
                    >
                      {savingId === profile.id ? "Saving..." : "Apply"}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-sm text-slate-500">
                  No user profiles found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
