import { notFound } from "next/navigation";
import { TranslationsPanel } from "@/components/translations-panel";
import { getCurrentProfileOrRedirect } from "@/lib/auth";
import type { RecipeRecord } from "@/lib/types";

type RecipeTranslationsProps = {
  params: Promise<{ id: string }>;
};

type TranslationListItem = Pick<RecipeRecord, "id" | "language" | "title" | "status" | "updated_at">;

export default async function RecipeTranslationsPage({ params }: RecipeTranslationsProps) {
  const { supabase } = await getCurrentProfileOrRedirect();
  const { id } = await params;

  const { data: rootRecipe } = await supabase
    .from("recipes")
    .select("id, translation_group_id")
    .eq("id", id)
    .maybeSingle<{ id: string; translation_group_id: string }>();

  if (!rootRecipe) {
    notFound();
  }

  const { data: translations } = await supabase
    .from("recipes")
    .select("id, language, title, status, updated_at")
    .eq("translation_group_id", rootRecipe.translation_group_id)
    .order("language", { ascending: true })
    .returns<TranslationListItem[]>();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Translations</h1>
      <TranslationsPanel translationGroupId={rootRecipe.translation_group_id} recipes={translations || []} />
    </div>
  );
}
