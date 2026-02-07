export type ProfileRole = "admin" | "editor" | "reviewer";
export type RecipeStatus = "draft" | "in_review" | "published" | "archived";

export type IngredientItem = {
  name: string;
  amount: string;
  unit: string;
  note?: string;
};

export type StepItem = {
  step_number: number;
  text: string;
  timer_seconds?: number | null;
};

export type RecipeRecord = {
  id: string;
  translation_group_id: string;
  language: string;
  title: string;
  subtitle: string | null;
  status: RecipeStatus;
  primary_cuisine: string | null;
  cuisines: string[];
  tags: string[];
  servings: number | null;
  total_minutes: number | null;
  difficulty: string | null;
  ingredients: IngredientItem[];
  steps: StepItem[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type ProfileRecord = {
  id: string;
  display_name: string | null;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
};
