export type ProfileRole = "admin" | "editor" | "reviewer";
export type RecipeStatus = "draft" | "in_review" | "published" | "archived";
export type UiDensity = "comfortable" | "compact";

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

export type AppSettingsRecord = {
  id: number;
  default_language: string;
  enabled_languages: string[];
  enabled_cuisines: string[];
  created_at: string;
  updated_at: string;
};

export type UserSettingsRecord = {
  user_id: string;
  preferred_language: string | null;
  preferred_cuisines: string[];
  ui_density: UiDensity;
  created_at: string;
  updated_at: string;
};
