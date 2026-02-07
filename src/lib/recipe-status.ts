import type { RecipeStatus } from "@/lib/types";

type UILang = "en" | "pl";

const statusLabels: Record<RecipeStatus, { en: string; pl: string }> = {
  draft: { en: "Draft", pl: "Szkic" },
  in_review: { en: "In review", pl: "W recenzji" },
  published: { en: "Published", pl: "Opublikowany" },
  archived: { en: "Archived", pl: "Archiwalny" },
};

export function getRecipeStatusLabel(status: RecipeStatus, lang: UILang) {
  return statusLabels[status][lang];
}
