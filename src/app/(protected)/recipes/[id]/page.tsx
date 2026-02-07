import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form";
import { RecipeThumbnail } from "@/components/recipe-thumbnail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import { normalizeAppSettings } from "@/lib/settings";
import { getServerUILang, tr } from "@/lib/ui-language.server";
import type { AppSettingsRecord, RecipeRecord } from "@/lib/types";

type RecipeEditProps = {
  params: Promise<{ id: string }>;
};

type TranslationSummaryItem = Pick<RecipeRecord, "id" | "language" | "status" | "title" | "image_urls">;
type RecipeCoreRow = Pick<
  RecipeRecord,
  | "id"
  | "translation_group_id"
  | "language"
  | "title"
  | "subtitle"
  | "status"
  | "primary_cuisine"
  | "cuisines"
  | "tags"
  | "servings"
  | "total_minutes"
  | "difficulty"
  | "ingredients"
  | "steps"
  | "created_by"
  | "updated_by"
  | "created_at"
  | "updated_at"
  | "published_at"
>;

const RECIPE_EDIT_CORE_COLUMNS =
  "id, translation_group_id, language, title, subtitle, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, ingredients, steps, created_by, updated_by, created_at, updated_at, published_at";

export default async function RecipeEditPage({ params }: RecipeEditProps) {
  const [{ supabase, profile }, { id }, lang] = await Promise.all([getCurrentProfileOrRedirect(), params, getServerUILang()]);
  const debugId = `recipe-edit-${id.slice(0, 8)}`;

  const [{ data: recipeCore, error: coreError }, { data: appSettings }] = await Promise.all([
    supabase
      .from("recipes")
      // Keep this query schema-stable: avoid optional migrated columns causing false 404s.
      .select(RECIPE_EDIT_CORE_COLUMNS)
      .eq("id", id)
      .maybeSingle<RecipeCoreRow>(),
    supabase
      .from("app_settings")
      .select("id, default_language, enabled_languages, enabled_cuisines, created_at, updated_at")
      .eq("id", 1)
      .maybeSingle<AppSettingsRecord>(),
  ]);

  if (coreError || !recipeCore) {
    if (coreError) {
      console.error(`[${debugId}] Recipe edit core query failed`, {
        message: coreError.message,
        code: coreError.code,
        details: coreError.details,
        hint: coreError.hint,
      });
    }
    notFound();
  }

  // Optional migration fields: fetch separately so missing columns do not break edit page.
  const [{ data: imageData, error: imageError }, { data: descriptionData, error: descriptionError }, { data: nutritionData, error: nutritionError }, { data: substitutionsData, error: substitutionsError }] = await Promise.all([
    supabase
      .from("recipes")
      .select("image_urls")
      .eq("id", id)
      .maybeSingle<{ image_urls: string[] | null }>(),
    supabase
      .from("recipes")
      .select("description")
      .eq("id", id)
      .maybeSingle<{ description: string | null }>(),
    supabase
      .from("recipes")
      .select("nutrition")
      .eq("id", id)
      .maybeSingle<{ nutrition: RecipeRecord["nutrition"] | null }>(),
    supabase
      .from("recipes")
      .select("substitutions")
      .eq("id", id)
      .maybeSingle<{ substitutions: RecipeRecord["substitutions"] | null }>(),
  ]);

  if (imageError) {
    console.warn(`[${debugId}] Optional image_urls unavailable; continuing without images.`, {
      message: imageError.message,
      code: imageError.code,
      details: imageError.details,
      hint: imageError.hint,
    });
  }
  if (descriptionError) {
    console.warn(`[${debugId}] Optional description unavailable; using subtitle as fallback.`, {
      message: descriptionError.message,
      code: descriptionError.code,
      details: descriptionError.details,
      hint: descriptionError.hint,
    });
  }
  if (nutritionError) {
    console.warn(`[${debugId}] Optional nutrition unavailable; continuing with empty nutrition.`, {
      message: nutritionError.message,
      code: nutritionError.code,
      details: nutritionError.details,
      hint: nutritionError.hint,
    });
  }
  if (substitutionsError) {
    console.warn(`[${debugId}] Optional substitutions unavailable; continuing with empty substitutions.`, {
      message: substitutionsError.message,
      code: substitutionsError.code,
      details: substitutionsError.details,
      hint: substitutionsError.hint,
    });
  }

  const recipe: RecipeRecord = {
    ...recipeCore,
    description: descriptionData?.description ?? recipeCore.subtitle ?? null,
    nutrition: nutritionData?.nutrition || {},
    substitutions: substitutionsData?.substitutions || [],
    image_urls: imageData?.image_urls || [],
  };

  const { data: translationsCoreList } = await supabase
    .from("recipes")
    .select("id, language, status, title")
    .eq("translation_group_id", recipe.translation_group_id)
    .order("language", { ascending: true })
    .returns<Array<{ id: string; language: string; status: RecipeRecord["status"]; title: string }>>();

  const translationIds = (translationsCoreList || []).map((item) => item.id);
  const translationImageMap = new Map<string, string[]>();
  if (translationIds.length > 0) {
    const { data: translationImages, error: translationImagesError } = await supabase
      .from("recipes")
      .select("id, image_urls")
      .in("id", translationIds)
      .returns<Array<{ id: string; image_urls: string[] | null }>>();

    if (translationImagesError) {
      console.warn(`[${debugId}] Optional translation image_urls unavailable; continuing without translation thumbnails.`, {
        message: translationImagesError.message,
        code: translationImagesError.code,
        details: translationImagesError.details,
        hint: translationImagesError.hint,
      });
    } else {
      for (const row of translationImages || []) {
        translationImageMap.set(row.id, row.image_urls || []);
      }
    }
  }

  const translations: TranslationSummaryItem[] = (translationsCoreList || []).map((item) => ({
    ...item,
    image_urls: translationImageMap.get(item.id) || [],
  }));

  const normalizedSettings = normalizeAppSettings(appSettings);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tr(lang, "Edit recipe", "Edytuj przepis")}</h1>
            <p className="mt-1 text-sm text-slate-600">{tr(lang, "Update content, review status, and translation coverage.", "Aktualizuj treść, status i kompletność tłumaczeń.")}</p>
          </div>
          <Link href={`/recipes/${recipe.id}/translations`}>
            <Button type="button" variant="secondary">
              {tr(lang, "Manage translations", "Zarządzaj tłumaczeniami")}
            </Button>
          </Link>
        </div>
      </section>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tr(lang, "Translations summary", "Podsumowanie tłumaczeń")}</h2>
        <div className="flex flex-wrap gap-2">
          {(translations || []).map((translation) => (
            <Link
              key={translation.id}
              href={`/recipes/${translation.id}`}
              className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RecipeThumbnail imageUrl={translation.image_urls?.[0] || null} title={translation.title} size="sm" />
              <span>{translation.language}</span>
              <StatusBadge status={translation.status} lang={lang} />
            </Link>
          ))}
        </div>
      </Card>

      <RecipeForm
        mode="edit"
        role={profile.role}
        recipe={recipe}
        enabledLanguages={normalizedSettings.enabled_languages}
        enabledCuisines={normalizedSettings.enabled_cuisines}
        defaultLanguage={normalizedSettings.default_language}
      />
    </div>
  );
}
