import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveTranslateProvider, translateTextBatch } from "@/lib/translation-provider";
import type { IngredientItem, ProfileRole, RecipeRecord, StepItem } from "@/lib/types";

type TranslateMode = "copy_from_pl" | "translate_from_pl";

type TranslateRequest = {
  recipeId: string;
  targetLanguage: string;
  mode?: TranslateMode;
};

type RecipeSourceRow = Pick<
  RecipeRecord,
  | "id"
  | "translation_group_id"
  | "language"
  | "title"
  | "subtitle"
  | "description"
  | "ingredients"
  | "steps"
  | "updated_at"
>;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: ProfileRole }>();
  if (!profile || profile.role === "reviewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as TranslateRequest | null;
  if (!body?.recipeId || !body?.targetLanguage) {
    return NextResponse.json({ error: "recipeId and targetLanguage are required." }, { status: 400 });
  }

  const mode: TranslateMode = body.mode === "copy_from_pl" ? "copy_from_pl" : "translate_from_pl";
  const targetLanguage = body.targetLanguage.trim();
  const provider = getActiveTranslateProvider();

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const { data: currentRecipe, error: currentRecipeError } = await admin
    .from("recipes")
    .select("id, translation_group_id, language, title, subtitle, description, ingredients, steps, updated_at")
    .eq("id", body.recipeId)
    .maybeSingle<RecipeSourceRow>();
  if (currentRecipeError || !currentRecipe) {
    return NextResponse.json({ error: currentRecipeError?.message || "Recipe not found." }, { status: 404 });
  }

  if (currentRecipe.language !== targetLanguage) {
    return NextResponse.json(
      { error: "Target language must match the currently opened language tab." },
      { status: 400 },
    );
  }

  if (targetLanguage === "pl" || targetLanguage === "pl-PL") {
    return NextResponse.json({ error: "PL is the source language and cannot be translated from itself." }, { status: 400 });
  }

  const { data: sourceRecipe, error: sourceRecipeError } = await admin
    .from("recipes")
    .select("id, translation_group_id, language, title, subtitle, description, ingredients, steps, updated_at")
    .eq("translation_group_id", currentRecipe.translation_group_id)
    .in("language", ["pl-PL", "pl"])
    .order("language", { ascending: true })
    .limit(1)
    .maybeSingle<RecipeSourceRow>();

  if (sourceRecipeError || !sourceRecipe) {
    return NextResponse.json({ error: sourceRecipeError?.message || "PL source variant not found." }, { status: 404 });
  }

  let nextTitle = sourceRecipe.title || "";
  let nextSubtitle = sourceRecipe.subtitle || "";
  let nextDescription = sourceRecipe.description || "";
  let nextIngredients = Array.isArray(sourceRecipe.ingredients) ? [...sourceRecipe.ingredients] : [];
  let nextSteps = Array.isArray(sourceRecipe.steps) ? [...sourceRecipe.steps] : [];
  const warnings: string[] = [];

  if (mode === "translate_from_pl" && provider !== "none") {
    const titleResult = await translateTextBatch([nextTitle], sourceRecipe.language, targetLanguage);
    if (titleResult.errors.length > 0) warnings.push(...titleResult.errors);
    nextTitle = titleResult.results[0] || nextTitle;

    const subtitleResult = await translateTextBatch([nextSubtitle], sourceRecipe.language, targetLanguage);
    if (subtitleResult.errors.length > 0) warnings.push(...subtitleResult.errors);
    nextSubtitle = subtitleResult.results[0] || nextSubtitle;

    const descriptionResult = await translateTextBatch([nextDescription], sourceRecipe.language, targetLanguage);
    if (descriptionResult.errors.length > 0) warnings.push(...descriptionResult.errors);
    nextDescription = descriptionResult.results[0] || nextDescription;

    const ingredientRows = nextIngredients as IngredientItem[];
    const ingredientNames = ingredientRows.map((item) => item.name || "");
    const ingredientNotes = ingredientRows.map((item) => item.note || "");

    const translatedIngredientNames = await translateTextBatch(ingredientNames, sourceRecipe.language, targetLanguage);
    if (translatedIngredientNames.errors.length > 0) warnings.push(...translatedIngredientNames.errors);
    const translatedIngredientNotes = await translateTextBatch(ingredientNotes, sourceRecipe.language, targetLanguage);
    if (translatedIngredientNotes.errors.length > 0) warnings.push(...translatedIngredientNotes.errors);

    nextIngredients = ingredientRows.map((item, index) => ({
      ...item,
      name: translatedIngredientNames.results[index] || item.name,
      note: translatedIngredientNotes.results[index] || item.note,
    }));

    const stepRows = nextSteps as StepItem[];
    const stepTexts = stepRows.map((item) => item.text || "");
    const translatedSteps = await translateTextBatch(stepTexts, sourceRecipe.language, targetLanguage);
    if (translatedSteps.errors.length > 0) warnings.push(...translatedSteps.errors);
    nextSteps = stepRows.map((item, index) => ({
      ...item,
      text: translatedSteps.results[index] || item.text,
    }));
  } else if (mode === "translate_from_pl" && provider === "none") {
    warnings.push("Translation provider is set to none. Source content was copied from PL.");
  }

  const patch = {
    title: nextTitle || currentRecipe.title,
    subtitle: nextSubtitle || null,
    description: nextDescription || null,
    ingredients: nextIngredients,
    steps: nextSteps,
    updated_by: session.user.id,
  };

  const { error: updateError } = await admin.from("recipes").update(patch).eq("id", currentRecipe.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    recipeId: currentRecipe.id,
    language: targetLanguage,
    provider,
    mode,
    translatedAt: new Date().toISOString(),
    warning: warnings.length > 0 ? warnings[0] : null,
    warningsCount: warnings.length,
  });
}
