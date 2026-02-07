import { cn } from "@/lib/cn";
import { getRecipeStatusLabel } from "@/lib/recipe-status";
import type { RecipeStatus } from "@/lib/types";

const statusClasses: Record<RecipeStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  in_review: "bg-amber-50 text-amber-700 border-amber-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

export function StatusBadge({ status, lang = "en" }: { status: RecipeStatus; lang?: "en" | "pl" }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", statusClasses[status])}>
      {getRecipeStatusLabel(status, lang)}
    </span>
  );
}
