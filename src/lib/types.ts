export type ProfileRole = "admin" | "editor" | "reviewer";
export type RecipeStatus = "draft" | "in_review" | "published" | "archived";
export type UiDensity = "comfortable" | "compact";
export type TranslationStatus = "draft" | "in_review" | "published";
export type IngredientUnitCode =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "pcs"
  | "tsp"
  | "tbsp"
  | "cup"
  | "pinch"
  | "slice"
  | "clove"
  | "pack";

export type IngredientItem = {
  ingredient_key?: string;
  name: string;
  amount: string;
  unit_code?: IngredientUnitCode;
  unit: string;
  note?: string;
  product_id?: string;
  off_barcode?: string;
  off_product_name?: string;
  off_nutrition_per_100g?: {
    kcal?: number | null;
    protein_g?: number | null;
    fat_g?: number | null;
    carbs_g?: number | null;
    sugar_g?: number | null;
    fiber_g?: number | null;
    salt_g?: number | null;
  };
  off_image_url?: string;
  off_categories?: string[];
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
  sugar_g?: number | null;
};

export type NutritionRecord = {
  per_serving?: Partial<NutritionValues>;
  per_100g?: Partial<NutritionValues>;
};

export type RecipeNutritionSummary = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sugar_g: number;
  fiber_g: number;
  salt_g: number;
  per_serving?: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    sugar_g: number;
    fiber_g: number;
    salt_g: number;
  };
  per_100g?: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    sugar_g: number;
    fiber_g: number;
    salt_g: number;
  };
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
  description_short?: string | null;
  description_full?: string | null;
  status: RecipeStatus;
  primary_cuisine: string | null;
  cuisines: string[];
  tags: string[];
  servings: number | null;
  total_minutes: number | null;
  difficulty: string | null;
  nutrition: NutritionRecord;
  nutrition_total?: Partial<NutritionValues>;
  nutrition_per_serving?: Partial<NutritionValues>;
  nutrition_summary?: RecipeNutritionSummary;
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

export type FoodProductRecord = {
  id: string;
  source: string;
  source_id: string;
  barcode: string | null;
  name_pl: string;
  name_en: string | null;
  brand: string | null;
  categories: string[] | null;
  nutriments: Record<string, unknown>;
  kcal_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  carbs_100g: number | null;
  sugar_100g: number | null;
  fiber_100g: number | null;
  salt_100g: number | null;
  created_at: string;
  updated_at: string;
};

export type TagType =
  | "diet"
  | "cuisine"
  | "time"
  | "difficulty"
  | "allergen"
  | "goal"
  | "meal_type"
  | "equipment"
  | "custom";

export type TagRecord = {
  id: string;
  slug: string;
  name_pl: string;
  name_en: string | null;
  type: TagType | string;
  created_at: string;
  updated_at?: string;
};

export type RecipeTagRecord = {
  recipe_id: string;
  tag_id: string;
  created_at: string;
};

export type RecipeIngredientRecord = {
  id: string;
  recipe_id: string;
  display_name: string;
  product_id: string | null;
  qty: number;
  unit: string;
  note: string | null;
  sort_order: number;
  substitutions: unknown;
  computed: unknown;
  created_at: string;
  updated_at: string;
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
