import { RecipeForm } from "@/components/recipe-form";
import { getCurrentProfileOrRedirect } from "@/lib/auth";

type NewRecipeProps = {
  searchParams: Promise<{ translation_group_id?: string; language?: string }>;
};

export default async function NewRecipePage({ searchParams }: NewRecipeProps) {
  const { profile } = await getCurrentProfileOrRedirect();
  const params = await searchParams;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Create Recipe</h1>
      <RecipeForm
        mode="create"
        role={profile.role}
        translationGroupId={params.translation_group_id}
        language={params.language}
      />
    </div>
  );
}
