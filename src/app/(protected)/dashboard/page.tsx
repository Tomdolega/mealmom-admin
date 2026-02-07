import Link from "next/link";
import { ExportPublishedPackButton } from "@/components/export-published-pack-button";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import type { AppSettingsRecord, RecipeRecord, RecipeStatus } from "@/lib/types";

type DashboardProps = {
  searchParams: Promise<{
    status?: RecipeStatus;
    language?: string;
    cuisine?: string;
    search?: string;
    mine?: string;
  }>;
};

function buildHref(params: URLSearchParams, updates: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  const query = next.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const { supabase, session } = await getCurrentProfileOrRedirect();
  const params = await searchParams;

  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
    .eq("id", 1)
    .maybeSingle<AppSettingsRecord>();

  const normalizedSettings = normalizeAppSettings(appSettings);
  const enabledLanguages = normalizedSettings.enabled_languages;

  let query = supabase
    .from("recipes")
    .select(
      "id, translation_group_id, language, title, subtitle, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, ingredients, steps, created_by, updated_by, created_at, updated_at, published_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (params.status) query = query.eq("status", params.status);
  if (params.language) query = query.eq("language", params.language);
  if (params.cuisine) query = query.or(`primary_cuisine.eq.${params.cuisine},cuisines.cs.{${params.cuisine}}`);
  if (params.search) query = query.ilike("title", `%${params.search}%`);
  if (params.mine === "1") query = query.eq("created_by", session.user.id).eq("status", "draft");

  const { data: recipes, error } = await query.returns<RecipeRecord[]>();
  const translationGroupIds = [...new Set((recipes || []).map((recipe) => recipe.translation_group_id))];

  const translationMap = new Map<string, string[]>();
  if (translationGroupIds.length > 0) {
    const { data: translations } = await supabase
      .from("recipes")
      .select("translation_group_id, language")
      .in("translation_group_id", translationGroupIds)
      .returns<Array<{ translation_group_id: string; language: string }>>();

    for (const item of translations || []) {
      const current = translationMap.get(item.translation_group_id) || [];
      translationMap.set(item.translation_group_id, [...new Set([...current, item.language])]);
    }
  }

  const activeParams = new URLSearchParams();
  if (params.status) activeParams.set("status", params.status);
  if (params.language) activeParams.set("language", params.language);
  if (params.cuisine) activeParams.set("cuisine", params.cuisine);
  if (params.search) activeParams.set("search", params.search);
  if (params.mine) activeParams.set("mine", params.mine);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-slate-600">Filter and manage recipe lifecycle.</p>
        </div>
        <ExportPublishedPackButton language={params.language} cuisine={params.cuisine} />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status:</span>
          {["draft", "in_review", "published", "archived"].map((status) => {
            const active = params.status === status;
            return (
              <Link key={status} href={buildHref(activeParams, { status: active ? null : status })}>
                <Button type="button" variant={active ? "primary" : "secondary"} size="sm">
                  {status}
                </Button>
              </Link>
            );
          })}
          <Link href={buildHref(activeParams, { status: null })}>
            <Button type="button" variant={!params.status ? "primary" : "ghost"} size="sm">
              all
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Language:</span>
          {enabledLanguages.map((language) => {
            const active = params.language === language;
            return (
              <Link key={language} href={buildHref(activeParams, { language: active ? null : language })}>
                <Button type="button" variant={active ? "primary" : "secondary"} size="sm">
                  {language}
                </Button>
              </Link>
            );
          })}
          <Link href={buildHref(activeParams, { language: null })}>
            <Button type="button" variant={!params.language ? "primary" : "ghost"} size="sm">
              all
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={buildHref(activeParams, { mine: params.mine === "1" ? null : "1" })}>
            <Button type="button" variant={params.mine === "1" ? "primary" : "secondary"} size="sm">
              My drafts
            </Button>
          </Link>
        </div>

        <form className="grid gap-3 sm:grid-cols-4">
          <FormField label="Cuisine">
            <Select name="cuisine" defaultValue={params.cuisine || ""}>
              <option value="">All cuisines</option>
              {normalizedSettings.enabled_cuisines.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Search title">
            <Input name="search" defaultValue={params.search || ""} placeholder="pasta" />
          </FormField>
          <input type="hidden" name="status" value={params.status || ""} />
          <input type="hidden" name="language" value={params.language || ""} />
          <input type="hidden" name="mine" value={params.mine || ""} />
          <div className="flex items-end gap-2">
            <Button type="submit">Apply</Button>
            <Link href="/dashboard">
              <Button type="button" variant="secondary">
                Reset
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error.message}</p> : null}

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Recipe</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Primary cuisine</th>
              <th className="px-4 py-3 text-left font-medium">Languages</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(recipes || []).map((recipe) => (
              <tr key={recipe.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{recipe.title}</p>
                  <p className="text-xs text-slate-500">{recipe.language}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={recipe.status} />
                </td>
                <td className="px-4 py-3">{recipe.primary_cuisine || "-"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {(translationMap.get(recipe.translation_group_id) || [recipe.language]).join(", ")}
                </td>
                <td className="px-4 py-3">{new Date(recipe.updated_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/recipes/${recipe.id}`}>
                      <Button type="button" variant="secondary" size="sm">
                        Open
                      </Button>
                    </Link>
                    <Link href={`/recipes/${recipe.id}/translations`}>
                      <Button type="button" variant="ghost" size="sm">
                        Translations
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
