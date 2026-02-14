import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole, RecipeTranslationRecord } from "@/lib/types";

type Body = {
  recipeId?: string;
  sourceLocale?: string;
  targetLocale?: string;
};

function hasTranslationApiKey() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.DEEPL_API_KEY);
}

async function translateWithOpenAI(source: Record<string, unknown>, sourceLocale: string, targetLocale: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    `Translate the recipe translation payload from ${sourceLocale} to ${targetLocale}.`,
    "Return ONLY valid JSON with keys: title, short_phrase, joanna_says, ingredients, steps, tips, substitutions.",
    "Keep ingredients and steps as arrays of objects and preserve structure. Do not add markdown.",
    `Payload: ${JSON.stringify(source)}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a translation engine returning JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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
  if (!profile || !["admin", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Body;
  if (!body.recipeId || !body.sourceLocale || !body.targetLocale) {
    return NextResponse.json({ error: "Missing recipeId/sourceLocale/targetLocale." }, { status: 400 });
  }
  if (!hasTranslationApiKey()) {
    return NextResponse.json({ error: "No translation API key configured." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: source, error: sourceError } = await admin
    .from("recipe_translations")
    .select("id, recipe_id, locale, title, short_phrase, joanna_says, ingredients, steps, tips, substitutions, translation_status, created_at, updated_at")
    .eq("recipe_id", body.recipeId)
    .eq("locale", body.sourceLocale)
    .maybeSingle<RecipeTranslationRecord>();

  if (sourceError || !source) {
    return NextResponse.json({ error: sourceError?.message || "Source translation not found." }, { status: 404 });
  }

  const translated =
    (await translateWithOpenAI(
      {
        title: source.title,
        short_phrase: source.short_phrase,
        joanna_says: source.joanna_says,
        ingredients: source.ingredients,
        steps: source.steps,
        tips: source.tips,
        substitutions: source.substitutions,
      },
      body.sourceLocale,
      body.targetLocale,
    )) || {};

  const payload = {
    recipe_id: body.recipeId,
    locale: body.targetLocale,
    title: (translated.title as string) || source.title || null,
    short_phrase: (translated.short_phrase as string) || source.short_phrase || null,
    joanna_says: (translated.joanna_says as string) || source.joanna_says || null,
    ingredients: (translated.ingredients as unknown[]) || source.ingredients || [],
    steps: (translated.steps as unknown[]) || source.steps || [],
    tips: (translated.tips as string) || source.tips || null,
    substitutions: (translated.substitutions as unknown[]) || source.substitutions || [],
    translation_status: "draft" as const,
  };

  const { data: target, error: upsertError } = await admin
    .from("recipe_translations")
    .upsert(payload, { onConflict: "recipe_id,locale" })
    .select("id, recipe_id, locale, title, short_phrase, joanna_says, ingredients, steps, tips, substitutions, translation_status, created_at, updated_at")
    .maybeSingle<RecipeTranslationRecord>();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  return NextResponse.json({ translation: target });
}
