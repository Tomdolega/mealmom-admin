export type ProfileRole = "admin" | "editor" | "reviewer";
export type RecipeStatus = "draft" | "in_review" | "published" | "archived";
export type UiDensity = "comfortable" | "compact";
export type TranslationStatus = "draft" | "in_review" | "published";

export type IngredientItem = {
  ingredient_key?: string;
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

export type NutritionValues = {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  salt_g: number | null;
};

export type NutritionRecord = {
  per_serving?: Partial<NutritionValues>;
  per_100g?: Partial<NutritionValues>;
};

export type SubstitutionAlternative = {
  alt_name: string;
  ratio?: string;
  note?: string;
  dietary_tags?: string[];
};

export type IngredientSubstitution = {
  ingredient_key: string;
  alternatives: SubstitutionAlternative[];
};

export type RecipeRecord = {
  id: string;
  translation_group_id: string;
  language: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  status: RecipeStatus;
  primary_cuisine: string | null;
  cuisines: string[];
  tags: string[];
  servings: number | null;
  total_minutes: number | null;
  difficulty: string | null;
  nutrition: NutritionRecord;
  substitutions: IngredientSubstitution[];
  image_urls: string[];
  ingredients: IngredientItem[];
  steps: StepItem[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type RecipeTranslationRecord = {
  id: string;
  recipe_id: string;
  locale: string;
  title: string | null;
  short_phrase: string | null;
  joanna_says: string | null;
  ingredients: IngredientItem[];
  steps: StepItem[];
  tips: string | null;
  substitutions: IngredientSubstitution[];
  translation_status: TranslationStatus;
  created_at: string;
  updated_at: string;
};

export type LabelRecord = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type RecipeLabelRecord = {
  recipe_id: string;
  label_id: string;
  created_at: string;
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
