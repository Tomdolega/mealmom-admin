"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRecord, ProfileRole } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClientUILang, tr } from "@/lib/ui-language.client";

type UserRoleManagerProps = {
  profiles: ProfileRecord[];
};

const roles: ProfileRole[] = ["admin", "editor", "reviewer"];

export function UserRoleManager({ profiles }: UserRoleManagerProps) {
  const lang = getClientUILang();
  const [items, setItems] = useState(profiles);
  const [pendingRoles, setPendingRoles] = useState<Record<string, ProfileRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ProfileRole>("editor");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function applyRoleChange(id: string) {
    const nextRole = pendingRoles[id];
    const current = items.find((item) => item.id === id);
    if (!nextRole || !current || nextRole === current.role) return;

    const confirm = window.confirm(
      tr(
        lang,
        `Change role for ${current.display_name || current.id} to '${nextRole}'?`,
        `Zmienić rolę użytkownika ${current.display_name || current.id} na '${nextRole}'?`,
      ),
    );
    if (!confirm) return;

    setSavingId(id);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.from("profiles").update({ role: nextRole }).eq("id", id);

    setSavingId(null);

    if (updateError) {
      setError(tr(lang, "Could not update this role. Please try again.", "Nie udało się zaktualizować roli. Spróbuj ponownie."));
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, role: nextRole } : item)));
    setPendingRoles((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setMessage(tr(lang, "Role updated.", "Rola została zaktualizowana."));
  }

  async function inviteUser() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setError(tr(lang, "Enter email before inviting.", "Podaj e-mail przed wysłaniem zaproszenia."));
      return;
    }

    setInviting(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        role: inviteRole,
        display_name: inviteDisplayName.trim() || undefined,
      }),
    });

    const payload = (await response.json()) as { error?: string; profile?: ProfileRecord };
    setInviting(false);

    if (!response.ok) {
      setError(payload.error || tr(lang, "Could not invite user.", "Nie udało się zaprosić użytkownika."));
      return;
    }

    if (payload.profile) {
      setItems((prev) => {
        const exists = prev.some((item) => item.id === payload.profile!.id);
        if (exists) {
          return prev.map((item) => (item.id === payload.profile!.id ? payload.profile! : item));
        }
        return [...prev, payload.profile!];
      });
    }

    setInviteEmail("");
    setInviteDisplayName("");
    setInviteRole("editor");
    setMessage(tr(lang, "Invitation sent and role saved.", "Zaproszenie wysłane, rola zapisana."));
  }

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{tr(lang, "Invite user", "Zaproś użytkownika")}</h2>
        <p className="text-sm text-slate-600">
          {tr(lang, "Send invite email and set role automatically in Supabase.", "Wyślij zaproszenie e-mail i automatycznie ustaw rolę w Supabase.")}
        </p>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            type="email"
            placeholder={tr(lang, "email@company.com", "email@firma.com")}
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            disabled={inviting}
            className="sm:col-span-2"
          />
          <Input
            placeholder={tr(lang, "Display name (optional)", "Nazwa użytkownika (opcjonalnie)")}
            value={inviteDisplayName}
            onChange={(event) => setInviteDisplayName(event.target.value)}
            disabled={inviting}
          />
          <Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as ProfileRole)} disabled={inviting}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={() => void inviteUser()} disabled={inviting}>
            {inviting ? tr(lang, "Inviting...", "Wysyłanie...") : tr(lang, "Send invite", "Wyślij zaproszenie")}
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="divide-y divide-slate-100 md:hidden">
          {items.map((profile) => {
            const selected = pendingRoles[profile.id] || profile.role;
            const changed = selected !== profile.role;
            return (
              <article key={`mobile-${profile.id}`} className="space-y-3 px-4 py-4">
                <div>
                  <p className="font-medium text-slate-900">{profile.display_name || tr(lang, "No display name", "Brak nazwy")}</p>
                  <p className="font-mono text-xs text-slate-500">{profile.id}</p>
                </div>
                <p className="text-sm text-slate-600">{tr(lang, "Current role", "Aktualna rola")}: {profile.role}</p>
                <Select
                  value={selected}
                  disabled={savingId === profile.id}
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
                <Button
                  type="button"
                  variant={changed ? "primary" : "secondary"}
                  disabled={!changed || savingId === profile.id}
                  className="w-full"
                  onClick={() => void applyRoleChange(profile.id)}
                >
                  {savingId === profile.id ? tr(lang, "Saving...", "Zapisywanie...") : tr(lang, "Apply", "Zastosuj")}
                </Button>
              </article>
            );
          })}
          {items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              {tr(lang, "No user profiles found.", "Nie znaleziono profili użytkowników.")}
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "User", "Użytkownik")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Current role", "Aktualna rola")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "New role", "Nowa rola")}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{tr(lang, "Action", "Akcja")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((profile) => {
              const selected = pendingRoles[profile.id] || profile.role;
              const changed = selected !== profile.role;

              return (
                <tr key={profile.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{profile.display_name || tr(lang, "No display name", "Brak nazwy")}</p>
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
                      {savingId === profile.id ? tr(lang, "Saving...", "Zapisywanie...") : tr(lang, "Apply", "Zastosuj")}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-sm text-slate-500">
                  {tr(lang, "No user profiles found.", "Nie znaleziono profili użytkowników.")}
                </td>
              </tr>
            ) : null}
          </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
