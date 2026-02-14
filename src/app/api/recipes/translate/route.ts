import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole, RecipeRecord } from "@/lib/types";

type TranslateRequest = {
  recipeId: string;
  targetLanguage: string;
  mode?: "create_empty" | "copy_from_pl" | "auto_translate" | "autofill_from_pl";
};

type RecipeForCopy = Pick<
  RecipeRecord,
  | "id"
  | "translation_group_id"
  | "language"
  | "title"
  | "subtitle"
  | "description"
  | "status"
  | "primary_cuisine"
  | "cuisines"
  | "tags"
  | "servings"
  | "total_minutes"
  | "difficulty"
  | "nutrition"
  | "ingredients"
  | "steps"
  | "substitutions"
  | "image_urls"
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

  const mode = body.mode || "copy_from_pl";

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Missing Supabase admin configuration." }, { status: 500 });
  }

  const { data: baseRecipe, error: baseError } = await admin
    .from("recipes")
    .select(
      "id, translation_group_id, language, title, subtitle, description, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, nutrition, ingredients, steps, substitutions, image_urls",
    )
    .eq("id", body.recipeId)
    .maybeSingle<RecipeForCopy>();

  if (baseError || !baseRecipe) {
    return NextResponse.json({ error: baseError?.message || "Base recipe not found." }, { status: 404 });
  }

  const { data: existingInLanguage } = await admin
    .from("recipes")
    .select("id")
    .eq("translation_group_id", baseRecipe.translation_group_id)
    .eq("language", body.targetLanguage)
    .maybeSingle<{ id: string }>();

  const { data: plSource } = await admin
    .from("recipes")
    .select(
      "id, translation_group_id, language, title, subtitle, description, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, nutrition, ingredients, steps, substitutions, image_urls",
    )
    .eq("translation_group_id", baseRecipe.translation_group_id)
    .in("language", ["pl-PL", "pl"])
    .order("language", { ascending: true })
    .limit(1)
    .maybeSingle<RecipeForCopy>();

  if (existingInLanguage?.id && mode === "autofill_from_pl") {
    const source = plSource || baseRecipe;
    const { data: existingVariant, error: existingVariantError } = await admin
      .from("recipes")
      .select(
        "id, title, subtitle, description, ingredients, steps, substitutions",
      )
      .eq("id", existingInLanguage.id)
      .maybeSingle<Pick<RecipeForCopy, "id" | "title" | "subtitle" | "description" | "ingredients" | "steps" | "substitutions">>();

    if (existingVariantError || !existingVariant) {
      return NextResponse.json({ error: existingVariantError?.message || "Target language variant not found." }, { status: 404 });
    }

    const patch = {
      title: existingVariant.title?.trim() ? existingVariant.title : source.title,
      subtitle: existingVariant.subtitle?.trim() ? existingVariant.subtitle : source.subtitle,
      description: existingVariant.description?.trim() ? existingVariant.description : source.description,
      ingredients:
        Array.isArray(existingVariant.ingredients) && existingVariant.ingredients.length > 0
          ? existingVariant.ingredients
          : source.ingredients,
      steps:
        Array.isArray(existingVariant.steps) && existingVariant.steps.length > 0
          ? existingVariant.steps
          : source.steps,
      substitutions:
        Array.isArray(existingVariant.substitutions) && existingVariant.substitutions.length > 0
          ? existingVariant.substitutions
          : source.substitutions,
      status: "draft",
      updated_by: session.user.id,
    };

    const { error: updateError } = await admin.from("recipes").update(patch).eq("id", existingInLanguage.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      recipeId: existingInLanguage.id,
      mode,
      copiedFromLanguage: source.language,
      autoTranslateReady: Boolean(process.env.OPENAI_API_KEY || process.env.DEEPL_API_KEY),
    });
  }

  if (existingInLanguage?.id) {
    return NextResponse.json({ recipeId: existingInLanguage.id, mode, reused: true });
  }

  const source = plSource || baseRecipe;

  const copiedContent = mode === "create_empty"
    ? {
        title: "",
        subtitle: null,
        description: null,
        ingredients: [],
        steps: [],
        substitutions: [],
      }
    : {
        title: source.title,
        subtitle: source.subtitle,
        description: source.description,
        ingredients: source.ingredients,
        steps: source.steps,
        substitutions: source.substitutions,
      };

  const { data: created, error: createError } = await admin
    .from("recipes")
    .insert({
      translation_group_id: source.translation_group_id,
      language: body.targetLanguage,
      title: copiedContent.title || `Draft ${body.targetLanguage}`,
      subtitle: copiedContent.subtitle,
      description: copiedContent.description,
      status: "draft",
      primary_cuisine: source.primary_cuisine,
      cuisines: source.cuisines || [],
      tags: source.tags || [],
      servings: source.servings,
      total_minutes: source.total_minutes,
      difficulty: source.difficulty,
      nutrition: source.nutrition || {},
      ingredients: copiedContent.ingredients,
      steps: copiedContent.steps,
      substitutions: copiedContent.substitutions,
      image_urls: source.image_urls || [],
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (createError || !created) {
    return NextResponse.json({ error: createError?.message || "Could not create language variant." }, { status: 400 });
  }

  return NextResponse.json({
    recipeId: created.id,
    mode,
    copiedFromLanguage: source.language,
    autoTranslateReady: Boolean(process.env.OPENAI_API_KEY || process.env.DEEPL_API_KEY),
    note:
      mode === "auto_translate" && !(process.env.OPENAI_API_KEY || process.env.DEEPL_API_KEY)
        ? "Auto-translate API key missing; copied source content as draft."
        : undefined,
  });
}
