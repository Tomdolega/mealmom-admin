import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import type { RecipeRecord } from "@/lib/types";

type RecipeEditProps = {
  params: Promise<{ id: string }>;
};

export default async function RecipeEditPage({ params }: RecipeEditProps) {
  const { supabase, profile } = await getCurrentProfileOrRedirect();
  const { id } = await params;

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select(
      "id, translation_group_id, language, title, subtitle, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, ingredients, steps, created_by, updated_by, created_at, updated_at, published_at",
    )
    .eq("id", id)
    .maybeSingle<RecipeRecord>();

  if (error || !recipe) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Edit Recipe</h1>
        <Link
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          href={`/recipes/${recipe.id}/translations`}
        >
          Manage translations
        </Link>
      </div>
      <RecipeForm mode="edit" role={profile.role} recipe={recipe} />
    </div>
  );
}
