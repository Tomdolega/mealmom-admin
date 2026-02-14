"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { IngredientProductLinker } from "@/components/ingredient-product-linker";
import type {
  IngredientItem,
  IngredientSubstitution,
  NutritionRecord,
  NutritionValues,
  ProfileRole,
  RecipeRecord,
  RecipeStatus,
  StepItem,
  SubstitutionAlternative,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getRecipeStatusLabel } from "@/lib/recipe-status";
import { computeRecipeNutritionSummary, suggestSubstitutionsForIngredient } from "@/lib/nutrition";
import { getClientUILang, tr } from "@/lib/ui-language.client";

const allStatuses: RecipeStatus[] = ["draft", "in_review", "published", "archived"];
const imageBucket = process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET || "recipe-images";

type RecipeFormProps = {
  mode: "create" | "edit";
  role: ProfileRole;
  recipe?: RecipeRecord;
  translationGroupId?: string;
  language?: string;
  enabledLanguages: string[];
  enabledCuisines: string[];
  defaultLanguage: string;
};

type SaveKind = "manual" | "autosave";
type SaveToast = { type: "success" | "error"; message: string } | null;
type RecipePayload = {
  translation_group_id?: string;
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
  nutrition_summary: NonNullable<RecipeRecord["nutrition_summary"]>;
  substitutions: IngredientSubstitution[];
  image_urls: string[];
  ingredients: ReturnType<typeof normalizeIngredients>;
  steps: ReturnType<typeof normalizeSteps>;
};

const nutritionKeys: Array<keyof NutritionValues> = [
  "kcal",
  "protein_g",
  "fat_g",
  "carbs_g",
  "sugar_g",
  "fiber_g",
  "salt_g",
];

function toNutritionInput(values?: Partial<NutritionValues>) {
  return {
    kcal: values?.kcal != null ? String(values.kcal) : "",
    protein_g: values?.protein_g != null ? String(values.protein_g) : "",
    fat_g: values?.fat_g != null ? String(values.fat_g) : "",
    carbs_g: values?.carbs_g != null ? String(values.carbs_g) : "",
    sugar_g: values?.sugar_g != null ? String(values.sugar_g) : "",
    fiber_g: values?.fiber_g != null ? String(values.fiber_g) : "",
    salt_g: values?.salt_g != null ? String(values.salt_g) : "",
  };
}

function normalizeNutritionValues(input: Record<keyof NutritionValues, string>) {
  const values: Partial<NutritionValues> = {};
  for (const key of nutritionKeys) {
    const raw = input[key].trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      values[key] = parsed;
    }
  }
  return values;
}

function normalizeSubstitutions(items: IngredientSubstitution[]) {
  return items
    .map((item) => ({
      ingredient_key: item.ingredient_key.trim(),
      alternatives: (item.alternatives || [])
        .map((alt) => ({
          alt_name: alt.alt_name.trim(),
          ratio: alt.ratio?.trim() || undefined,
          note: alt.note?.trim() || undefined,
          dietary_tags: (alt.dietary_tags || []).map((tag) => tag.trim()).filter(Boolean),
        }))
        .filter((alt) => alt.alt_name.length > 0),
    }))
    .filter((item) => item.ingredient_key.length > 0 && item.alternatives.length > 0);
}

function statusOptionsForRole(role: ProfileRole, mode: "create" | "edit", currentStatus: RecipeStatus) {
  if (role === "admin") return allStatuses;
  if (role === "reviewer") {
    if (mode === "edit" && currentStatus === "in_review") {
      return ["draft", "published"] as RecipeStatus[];
    }
    return [currentStatus] as RecipeStatus[];
  }
  if (mode === "create") return ["draft"] as RecipeStatus[];
  return ["draft"] as RecipeStatus[];
}

function normalizeIngredients(items: IngredientItem[]) {
  return items
    .map((item) => ({
      ingredient_key: item.ingredient_key?.trim() || undefined,
      name: item.name.trim(),
      amount: item.amount.trim(),
      unit: item.unit.trim(),
      note: item.note?.trim() || "",
      off_barcode: item.off_barcode?.trim() || undefined,
      off_product_name: item.off_product_name?.trim() || undefined,
      off_nutrition_per_100g: item.off_nutrition_per_100g || undefined,
      off_image_url: item.off_image_url?.trim() || undefined,
      off_categories: Array.isArray(item.off_categories) ? item.off_categories.filter(Boolean) : undefined,
    }))
    .filter((item) => item.name.length > 0);
}

function normalizeSteps(items: StepItem[]) {
  return items
    .map((item, index) => ({
      step_number: index + 1,
      text: item.text.trim(),
      timer_seconds:
        item.timer_seconds === null || Number.isNaN(Number(item.timer_seconds))
          ? null
          : Number(item.timer_seconds),
    }))
    .filter((item) => item.text.length > 0);
}

function formatLastSaved(value: string | null, lang: "en" | "pl") {
  if (!value) return tr(lang, "Not saved yet", "Jeszcze nie zapisano");
  return new Date(value).toLocaleString();
}

function formatSupabaseError(error: { message: string; details?: string | null; hint?: string | null }) {
  const parts = [error.message];
  if (error.details) parts.push(`Details: ${error.details}`);
  if (error.hint) parts.push(`Hint: ${error.hint}`);
  return parts.join(" ");
}

export function RecipeForm({
  mode,
  role,
  recipe,
  translationGroupId,
  language,
  enabledLanguages,
  enabledCuisines,
  defaultLanguage,
}: RecipeFormProps) {
  const lang = getClientUILang();
  const tt = useCallback((en: string, pl: string) => tr(lang, en, pl), [lang]);
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState(recipe?.title || "");
  const [subtitle, setSubtitle] = useState(recipe?.subtitle || "");
  const [description, setDescription] = useState(recipe?.description || "");
  const [recipeLanguage, setRecipeLanguage] = useState(
    recipe?.language || language || defaultLanguage || enabledLanguages[0] || "en",
  );
  const [status, setStatus] = useState<RecipeStatus>(recipe?.status || (role === "reviewer" ? "in_review" : "draft"));
  const [primaryCuisine, setPrimaryCuisine] = useState(recipe?.primary_cuisine || "");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(recipe?.cuisines || []);
  const [tagsText, setTagsText] = useState((recipe?.tags || []).join(", "));
  const [servings, setServings] = useState(recipe?.servings?.toString() || "");
  const [totalMinutes, setTotalMinutes] = useState(recipe?.total_minutes?.toString() || "");
  const [difficulty, setDifficulty] = useState(recipe?.difficulty || "");
  const [nutritionPerServing, setNutritionPerServing] = useState<Record<keyof NutritionValues, string>>(
    toNutritionInput(recipe?.nutrition?.per_serving),
  );
  const [nutritionPer100g, setNutritionPer100g] = useState<Record<keyof NutritionValues, string>>(
    toNutritionInput(recipe?.nutrition?.per_100g),
  );
  const [substitutions, setSubstitutions] = useState<IngredientSubstitution[]>(
    Array.isArray(recipe?.substitutions) ? recipe!.substitutions : [],
  );
  const [imageUrls, setImageUrls] = useState<string[]>(recipe?.image_urls || []);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [ingredients, setIngredients] = useState<IngredientItem[]>(
    recipe?.ingredients?.length ? recipe.ingredients : [{ name: "", amount: "", unit: "", note: "" }],
  );
  const [steps, setSteps] = useState<StepItem[]>(
    recipe?.steps?.length ? recipe.steps : [{ step_number: 1, text: "", timer_seconds: null }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(role === "admin" || role === "editor");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<SaveToast>(null);
  const [lastPayloadDebug, setLastPayloadDebug] = useState<Record<string, unknown> | null>(null);
  const [lastErrorDebug, setLastErrorDebug] = useState<Record<string, unknown> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(recipe?.updated_at || null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>(() =>
    JSON.stringify({
      translation_group_id: recipe?.translation_group_id || translationGroupId,
      language: recipe?.language || language || defaultLanguage || enabledLanguages[0] || "en",
      title: recipe?.title || "",
      subtitle: recipe?.subtitle || null,
      description: recipe?.description || null,
      status: recipe?.status || (role === "reviewer" ? "in_review" : "draft"),
      primary_cuisine: recipe?.primary_cuisine || null,
      cuisines: recipe?.cuisines || [],
      tags: recipe?.tags || [],
      servings: recipe?.servings ?? null,
      total_minutes: recipe?.total_minutes ?? null,
      difficulty: recipe?.difficulty || null,
      nutrition: recipe?.nutrition || {},
      nutrition_summary: recipe?.nutrition_summary || {},
      substitutions: recipe?.substitutions || [],
      image_urls: recipe?.image_urls || [],
      ingredients: recipe?.ingredients || [],
      steps: recipe?.steps || [],
    }),
  );

  const canEditContent = role !== "reviewer";
  const canAutoSave = mode === "edit" && (role === "admin" || role === "editor");
  const reviewerStatusEditable = role === "reviewer" && mode === "edit" && recipe?.status === "in_review";
  const allowedStatuses = useMemo(() => statusOptionsForRole(role, mode, recipe?.status || status), [mode, recipe?.status, role, status]);
  const availableCuisineOptions = enabledCuisines.filter((item) => !selectedCuisines.includes(item));
  const nutritionSummary = useMemo(
    () => computeRecipeNutritionSummary(normalizeIngredients(ingredients), servings ? Number(servings) : null),
    [ingredients, servings],
  );

  const basePayload = useMemo(
    () => ({
      translation_group_id: recipe?.translation_group_id || translationGroupId,
      language: recipeLanguage,
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      description: description.trim() || null,
      status,
      primary_cuisine: primaryCuisine || null,
      cuisines: selectedCuisines,
      tags: tagsText,
      servings: servings,
      total_minutes: totalMinutes,
      difficulty: difficulty || null,
      nutrition: {
        per_serving: normalizeNutritionValues(nutritionPerServing),
        per_100g: normalizeNutritionValues(nutritionPer100g),
      },
      nutrition_summary: computeRecipeNutritionSummary(normalizeIngredients(ingredients), servings ? Number(servings) : null),
      substitutions: normalizeSubstitutions(substitutions),
      image_urls: imageUrls,
      ingredients: normalizeIngredients(ingredients),
      steps: normalizeSteps(steps),
    }),
    [
      description,
      difficulty,
      imageUrls,
      ingredients,
      nutritionPer100g,
      nutritionPerServing,
      primaryCuisine,
      recipe?.translation_group_id,
      recipeLanguage,
      selectedCuisines,
      servings,
      status,
      steps,
      subtitle,
      substitutions,
      tagsText,
      title,
      totalMinutes,
      translationGroupId,
    ],
  );

  const validatePayload = useCallback(
    (candidate: typeof basePayload): { payload: RecipePayload | null; message?: string } => {
      const nextLanguage = candidate.language.trim();
      const nextStatus = candidate.status;
      const nextTitle = candidate.title.trim();
      const nextCuisines = Array.isArray(candidate.cuisines)
        ? [...new Set(candidate.cuisines.map((item) => item.trim()).filter(Boolean))]
        : [];
      const nextTags = String(candidate.tags || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const nextIngredients = Array.isArray(candidate.ingredients) ? candidate.ingredients : [];
      const nextSteps = Array.isArray(candidate.steps) ? candidate.steps : [];
      const nextImageUrls = Array.isArray(candidate.image_urls)
        ? candidate.image_urls.map((item) => item.trim()).filter(Boolean)
        : [];
      const nextSubstitutions = Array.isArray(candidate.substitutions) ? candidate.substitutions : [];
      const nextNutrition: NutritionRecord =
        candidate.nutrition && typeof candidate.nutrition === "object"
          ? (candidate.nutrition as NutritionRecord)
          : {};

      const servingsNumber =
        candidate.servings && String(candidate.servings).trim() !== ""
          ? Number(candidate.servings)
          : null;
      const totalMinutesNumber =
        candidate.total_minutes && String(candidate.total_minutes).trim() !== ""
          ? Number(candidate.total_minutes)
          : null;
      const nextNutritionSummary =
        candidate.nutrition_summary && typeof candidate.nutrition_summary === "object"
          ? candidate.nutrition_summary
          : computeRecipeNutritionSummary(nextIngredients as IngredientItem[], servingsNumber);

      if (!nextTitle) {
        return { payload: null, message: tt("Title is required.", "Tytuł jest wymagany.") };
      }
      if (!enabledLanguages.includes(nextLanguage)) {
        return { payload: null, message: tt("Language must be selected from enabled languages.", "Język musi być wybrany z aktywnych języków.") };
      }
      if (!allStatuses.includes(nextStatus)) {
        return { payload: null, message: tt("Invalid recipe status.", "Nieprawidłowy status przepisu.") };
      }
      if (servingsNumber !== null && !Number.isFinite(servingsNumber)) {
        return { payload: null, message: tt("Servings must be a number or empty.", "Porcje muszą być liczbą lub puste.") };
      }
      if (totalMinutesNumber !== null && !Number.isFinite(totalMinutesNumber)) {
        return { payload: null, message: tt("Total minutes must be a number or empty.", "Czas całkowity musi być liczbą lub pusty.") };
      }
      for (const key of nutritionKeys) {
        const servingValue = nextNutrition.per_serving?.[key];
        const per100gValue = nextNutrition.per_100g?.[key];
        if (servingValue != null && (!Number.isFinite(servingValue) || servingValue < 0)) {
          return { payload: null, message: tt("Nutrition values must be numbers >= 0.", "Wartości nutrition muszą być liczbami >= 0.") };
        }
        if (per100gValue != null && (!Number.isFinite(per100gValue) || per100gValue < 0)) {
          return { payload: null, message: tt("Nutrition values must be numbers >= 0.", "Wartości nutrition muszą być liczbami >= 0.") };
        }
      }

      const payload: RecipePayload = {
        language: nextLanguage,
        title: nextTitle,
        subtitle: candidate.subtitle,
        description: candidate.description,
        status: nextStatus,
        primary_cuisine: candidate.primary_cuisine || null,
        cuisines: nextCuisines,
        tags: nextTags,
        servings: servingsNumber,
        total_minutes: totalMinutesNumber,
        difficulty: candidate.difficulty,
        nutrition: nextNutrition,
        nutrition_summary: nextNutritionSummary,
        substitutions: nextSubstitutions,
        image_urls: nextImageUrls,
        ingredients: nextIngredients,
        steps: nextSteps,
      };

      if (candidate.translation_group_id) {
        payload.translation_group_id = candidate.translation_group_id;
      }

      return { payload };
    },
    [enabledLanguages, tt],
  );

  const normalizedPayload = useMemo(() => {
    const result = validatePayload(basePayload);
    return result.payload;
  }, [basePayload, validatePayload]);

  const currentSnapshot = useMemo(() => JSON.stringify(normalizedPayload || {}), [normalizedPayload]);
  const isDirty = currentSnapshot !== lastSavedSnapshot;

  const saveRecipe = useCallback(
    async (kind: SaveKind) => {
      if (kind === "autosave" && (!canAutoSave || !autoSaveEnabled || status !== "draft" || !isDirty)) {
        return;
      }

      const validation = validatePayload(basePayload);
      if (!validation.payload) {
        setError(validation.message || tt("Could not validate recipe payload.", "Nie udało się zwalidować danych przepisu."));
        setToast({
          type: "error",
          message: validation.message || tt("Could not validate recipe payload.", "Nie udało się zwalidować danych przepisu."),
        });
        return;
      }
      const payload = validation.payload;

      setError(null);
      setLastErrorDebug(null);
      setLastPayloadDebug(payload);
      if (kind === "autosave") {
        setIsAutoSaving(true);
      } else {
        setSubmitting(true);
      }

      const supabase = createClient();

      const result =
        mode === "create"
          ? await supabase.from("recipes").insert(payload).select("id, updated_at").single<{ id: string; updated_at: string }>()
          : await supabase
              .from("recipes")
              .update(payload)
              .eq("id", recipe!.id)
              .select("id, updated_at")
              .single<{ id: string; updated_at: string }>();

      if (kind === "autosave") {
        setIsAutoSaving(false);
      } else {
        setSubmitting(false);
      }

      if (result.error) {
        const debugError = {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
          code: result.error.code,
        };
        console.error("Recipe save failed", { error: result.error, data: result.data, payload });
        const fullErrorMessage = formatSupabaseError(result.error);
        setLastErrorDebug(debugError);
        setError(fullErrorMessage);
        setToast({ type: "error", message: fullErrorMessage });
        return;
      }

      const translationStatus =
        payload.status === "published"
          ? "published"
          : payload.status === "in_review"
            ? "in_review"
            : "draft";
      const translationUpsert = await supabase.from("recipe_translations").upsert(
        {
          recipe_id: result.data.id,
          locale: payload.language,
          title: payload.title,
          short_phrase: payload.subtitle,
          joanna_says: payload.description,
          ingredients: payload.ingredients,
          steps: payload.steps,
          substitutions: payload.substitutions,
          translation_status: translationStatus,
        },
        { onConflict: "recipe_id,locale" },
      );

      if (translationUpsert.error) {
        console.warn("Recipe translation upsert after recipe save failed", {
          message: translationUpsert.error.message,
          code: translationUpsert.error.code,
          details: translationUpsert.error.details,
          hint: translationUpsert.error.hint,
          recipeId: result.data.id,
          locale: payload.language,
        });
      }

      let refreshedRecipe: RecipeRecord | null = null;
      if (result.data?.id) {
        const refetch = await supabase
          .from("recipes")
          .select(
            "id, translation_group_id, language, title, subtitle, description, status, primary_cuisine, cuisines, tags, servings, total_minutes, difficulty, nutrition, nutrition_summary, substitutions, image_urls, ingredients, steps, created_by, updated_by, created_at, updated_at, published_at",
          )
          .eq("id", result.data.id)
          .maybeSingle<RecipeRecord>();

        if (refetch.error) {
          console.error("Recipe refetch after save failed", {
            error: refetch.error,
            recipeId: result.data.id,
          });
        } else if (refetch.data) {
          refreshedRecipe = refetch.data;
          setTitle(refreshedRecipe.title || "");
          setSubtitle(refreshedRecipe.subtitle || "");
          setDescription(refreshedRecipe.description || "");
          setRecipeLanguage(refreshedRecipe.language || defaultLanguage || enabledLanguages[0] || "en");
          setStatus(refreshedRecipe.status);
          setPrimaryCuisine(refreshedRecipe.primary_cuisine || "");
          setSelectedCuisines(Array.isArray(refreshedRecipe.cuisines) ? refreshedRecipe.cuisines : []);
          setTagsText(Array.isArray(refreshedRecipe.tags) ? refreshedRecipe.tags.join(", ") : "");
          setServings(
            typeof refreshedRecipe.servings === "number" && Number.isFinite(refreshedRecipe.servings)
              ? String(refreshedRecipe.servings)
              : "",
          );
          setTotalMinutes(
            typeof refreshedRecipe.total_minutes === "number" && Number.isFinite(refreshedRecipe.total_minutes)
              ? String(refreshedRecipe.total_minutes)
              : "",
          );
          setDifficulty(refreshedRecipe.difficulty || "");
          setNutritionPerServing(toNutritionInput(refreshedRecipe.nutrition?.per_serving));
          setNutritionPer100g(toNutritionInput(refreshedRecipe.nutrition?.per_100g));
          setSubstitutions(Array.isArray(refreshedRecipe.substitutions) ? refreshedRecipe.substitutions : []);
          setImageUrls(Array.isArray(refreshedRecipe.image_urls) ? refreshedRecipe.image_urls : []);
          setIngredients(
            Array.isArray(refreshedRecipe.ingredients) && refreshedRecipe.ingredients.length > 0
              ? refreshedRecipe.ingredients
              : [{ name: "", amount: "", unit: "", note: "" }],
          );
          setSteps(
            Array.isArray(refreshedRecipe.steps) && refreshedRecipe.steps.length > 0
              ? refreshedRecipe.steps
              : [{ step_number: 1, text: "", timer_seconds: null }],
          );
          setLastSavedSnapshot(
            JSON.stringify({
              ...payload,
              ...{
                language: refreshedRecipe.language,
                title: refreshedRecipe.title,
                subtitle: refreshedRecipe.subtitle,
                description: refreshedRecipe.description,
                status: refreshedRecipe.status,
                primary_cuisine: refreshedRecipe.primary_cuisine,
                cuisines: refreshedRecipe.cuisines,
                tags: refreshedRecipe.tags,
                servings: refreshedRecipe.servings,
                total_minutes: refreshedRecipe.total_minutes,
                difficulty: refreshedRecipe.difficulty,
                nutrition: refreshedRecipe.nutrition,
                nutrition_summary:
                  refreshedRecipe.nutrition_summary ||
                  computeRecipeNutritionSummary(
                    (Array.isArray(refreshedRecipe.ingredients) ? refreshedRecipe.ingredients : []) as IngredientItem[],
                    refreshedRecipe.servings ?? null,
                  ),
                substitutions: refreshedRecipe.substitutions,
                image_urls: refreshedRecipe.image_urls,
                ingredients: refreshedRecipe.ingredients,
                steps: refreshedRecipe.steps,
              },
            }),
          );
          setLastSavedAt(refreshedRecipe.updated_at || new Date().toISOString());
        }
      }

      if (!refreshedRecipe) {
        setLastSavedSnapshot(JSON.stringify(payload));
        setLastSavedAt(result.data.updated_at || new Date().toISOString());
      }

      if (mode === "create") {
        router.push(`/recipes/${result.data.id}`);
        router.refresh();
        return;
      }

      if (kind === "manual") {
        setToast({
          type: "success",
          message: tt("Recipe saved.", "Przepis zapisany."),
        });
        router.refresh();
      }
    },
    [
      autoSaveEnabled,
      basePayload,
      canAutoSave,
      defaultLanguage,
      enabledLanguages,
      isDirty,
      mode,
      recipe,
      router,
      status,
      tt,
      validatePayload,
    ],
  );

  useEffect(() => {
    if (!canAutoSave || !autoSaveEnabled || status !== "draft" || !isDirty || submitting || isAutoSaving) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void saveRecipe("autosave");
    }, 1200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [autoSaveEnabled, canAutoSave, isAutoSaving, isDirty, saveRecipe, status, submitting]);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await saveRecipe("manual");
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    setError(null);

    const supabase = createClient();
    const uploaded: string[] = [];

    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `recipes/${recipe?.id || "draft"}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from(imageBucket).upload(path, file, {
        upsert: false,
      });

      if (uploadError) {
        const uploadDebug = uploadError.name
          ? `${uploadError.name}: ${uploadError.message}`
          : uploadError.message;
        setError(
          tt(
            `Could not upload one or more images. Ensure bucket '${imageBucket}' exists and has upload policies for authenticated users. (${uploadDebug})`,
            `Nie udało się wgrać jednego lub więcej zdjęć. Upewnij się, że bucket '${imageBucket}' istnieje i ma polityki uploadu dla zalogowanych użytkowników. (${uploadDebug})`,
          ),
        );
        continue;
      }

      const { data } = supabase.storage.from(imageBucket).getPublicUrl(path);
      if (data.publicUrl) uploaded.push(data.publicUrl);
    }

    if (uploaded.length > 0) {
      setImageUrls((prev) => [...prev, ...uploaded]);
    }

    setUploadingImages(false);
  }

  function addImageUrl() {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    if (imageUrls.includes(trimmed)) {
      setNewImageUrl("");
      return;
    }
    setImageUrls((prev) => [...prev, trimmed]);
    setNewImageUrl("");
  }

  function getIngredientSlotKey(item: IngredientItem, index: number) {
    const normalized = item.ingredient_key?.trim();
    return normalized && normalized.length > 0 ? normalized : `ingredient_${index + 1}`;
  }

  function getAlternativesForIngredient(slotKey: string): SubstitutionAlternative[] {
    const found = substitutions.find((item) => item.ingredient_key === slotKey);
    return found?.alternatives || [];
  }

  function addAlternative(slotKey: string) {
    setSubstitutions((prev) => {
      const existing = prev.find((item) => item.ingredient_key === slotKey);
      if (!existing) {
        return [
          ...prev,
          {
            ingredient_key: slotKey,
            alternatives: [{ alt_name: "", ratio: "", note: "", dietary_tags: [] }],
          },
        ];
      }
      return prev.map((item) =>
        item.ingredient_key === slotKey
          ? {
              ...item,
              alternatives: [...item.alternatives, { alt_name: "", ratio: "", note: "", dietary_tags: [] }],
            }
          : item,
      );
    });
  }

  function updateAlternative(
    slotKey: string,
    alternativeIndex: number,
    field: "alt_name" | "ratio" | "note" | "dietary_tags",
    value: string,
  ) {
    setSubstitutions((prev) =>
      prev.map((item) => {
        if (item.ingredient_key !== slotKey) return item;
        const alternatives = item.alternatives.map((alt, idx) => {
          if (idx !== alternativeIndex) return alt;
          if (field === "dietary_tags") {
            return {
              ...alt,
              dietary_tags: value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            };
          }
          return { ...alt, [field]: value };
        });
        return { ...item, alternatives };
      }),
    );
  }

  function removeAlternative(slotKey: string, alternativeIndex: number) {
    setSubstitutions((prev) =>
      prev
        .map((item) =>
          item.ingredient_key !== slotKey
            ? item
            : { ...item, alternatives: item.alternatives.filter((_, idx) => idx !== alternativeIndex) },
        )
        .filter((item) => item.alternatives.length > 0),
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{tt("Editing session", "Sesja edycji")}</h2>
            <p className="text-sm text-slate-600">{tt("Save manually at any time. Draft changes can auto-save.", "Możesz zapisywać ręcznie w dowolnym momencie. Szkice zapisują się też automatycznie.")}</p>
          </div>
          {canAutoSave ? (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(event) => setAutoSaveEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {tt("Auto-save draft", "Auto-zapis szkicu")}
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className={isDirty ? "text-amber-700" : "text-slate-600"}>{isDirty ? tt("Unsaved changes", "Niezapisane zmiany") : tt("All changes saved", "Wszystkie zmiany zapisane")}</span>
          <span className="text-slate-500">{tt("Last saved", "Ostatni zapis")}: {formatLastSaved(lastSavedAt, lang)}</span>
          {isAutoSaving ? <span className="text-slate-600">{tt("Auto-saving...", "Auto-zapis...")}</span> : null}
        </div>

        {role === "reviewer" ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {tt("Reviewer mode: content fields are read-only. You can only move recipes from in_review to draft or published.", "Tryb recenzenta: pola treści są tylko do odczytu. Możesz zmieniać status z in_review na draft lub published.")}
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
        <header className="space-y-1 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">{tt("Recipe details", "Szczegóły przepisu")}</h2>
          <p className="text-sm text-slate-600">{tt("Basic metadata used in search, lists, and workflow.", "Podstawowe metadane używane w wyszukiwaniu, listach i workflow.")}</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label={tt("Title", "Tytuł")}>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEditContent} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label={tt("Subtitle", "Podtytuł")}>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} disabled={!canEditContent} />
            </FormField>
          </div>
          <FormField label={tt("Language", "Język")}>
            <Select value={recipeLanguage} onChange={(e) => setRecipeLanguage(e.target.value)} disabled={!canEditContent}>
              {enabledLanguages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={tt("Status", "Status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as RecipeStatus)} disabled={role === "reviewer" ? !reviewerStatusEditable : false}>
              {allowedStatuses.map((item) => (
                <option key={item} value={item}>
                  {getRecipeStatusLabel(item, lang)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={tt("Primary cuisine", "Kuchnia główna")}>
            <Select value={primaryCuisine} onChange={(e) => setPrimaryCuisine(e.target.value)} disabled={!canEditContent}>
              <option value="">{tt("None", "Brak")}</option>
              {enabledCuisines.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={tt("Cuisines", "Kuchnie")}>
            <Select
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                setSelectedCuisines((prev) => [...prev, value]);
              }}
              disabled={!canEditContent}
            >
              <option value="">{tt("Add cuisine...", "Dodaj kuchnię...")}</option>
              {availableCuisineOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedCuisines.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                  {item}
                  {canEditContent ? (
                    <button
                      type="button"
                      className="text-slate-500 hover:text-slate-900"
                      onClick={() => setSelectedCuisines((prev) => prev.filter((value) => value !== item))}
                      aria-label={tt("Remove cuisine", "Usuń kuchnię")}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          </FormField>
          <FormField label={tt("Tags (comma-separated)", "Tagi (po przecinku)")}>
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder={tt("quick, family", "szybkie, rodzinne")} disabled={!canEditContent} />
          </FormField>
          <FormField label={tt("Servings", "Porcje")}>
            <Input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} disabled={!canEditContent} />
          </FormField>
          <FormField label={tt("Total minutes", "Czas całkowity (min)")}>
            <Input type="number" min={0} value={totalMinutes} onChange={(e) => setTotalMinutes(e.target.value)} disabled={!canEditContent} />
          </FormField>
          <FormField label={tt("Difficulty", "Poziom trudności")}>
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={!canEditContent}>
              <option value="">{tt("Select...", "Wybierz...")}</option>
              <option value="easy">{tt("easy", "łatwy")}</option>
              <option value="medium">{tt("medium", "średni")}</option>
              <option value="hard">{tt("hard", "trudny")}</option>
            </Select>
          </FormField>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
        <header className="space-y-1 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">{tt("Description", "Opis")}</h2>
          <p className="text-sm text-slate-600">{tt("Add a concise 1-2 sentence description for storefront and app preview.", "Dodaj krótki opis 1-2 zdania dla widoku w aplikacji.")}</p>
        </header>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={tt("A warming tomato soup with fresh basil and gentle acidity.", "Rozgrzewająca zupa pomidorowa ze świeżą bazylią i delikatną kwasowością.")}
          disabled={!canEditContent}
          className="min-h-24"
        />
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
        <header className="space-y-1 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">{tt("Nutrition", "Nutrition")}</h2>
          <p className="text-sm text-slate-600">{tt("Maintain nutrition per serving and per 100g. Values must be numbers >= 0.", "Uzupełnij nutrition na porcję i na 100g. Wartości muszą być liczbami >= 0.")}</p>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-700">{tt("Per serving", "Na porcję")}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {nutritionKeys.map((key) => (
                <FormField key={`per-serving-${key}`} label={key}>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={nutritionPerServing[key]}
                    disabled={!canEditContent}
                    onChange={(event) =>
                      setNutritionPerServing((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                  />
                </FormField>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-700">{tt("Per 100g", "Na 100g")}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {nutritionKeys.map((key) => (
                <FormField key={`per-100g-${key}`} label={key}>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={nutritionPer100g[key]}
                    disabled={!canEditContent}
                    onChange={(event) =>
                      setNutritionPer100g((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                  />
                </FormField>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">{tt("Auto nutrition summary from linked OFF products", "Automatyczne nutrition z podpiętych produktów OFF")}</h3>
            {canEditContent ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setNutritionPerServing({
                    kcal: nutritionSummary.per_serving?.kcal != null ? String(nutritionSummary.per_serving.kcal) : "",
                    protein_g: nutritionSummary.per_serving?.protein_g != null ? String(nutritionSummary.per_serving.protein_g) : "",
                    fat_g: nutritionSummary.per_serving?.fat_g != null ? String(nutritionSummary.per_serving.fat_g) : "",
                    carbs_g: nutritionSummary.per_serving?.carbs_g != null ? String(nutritionSummary.per_serving.carbs_g) : "",
                    sugar_g: nutritionSummary.per_serving?.sugar_g != null ? String(nutritionSummary.per_serving.sugar_g) : "",
                    fiber_g: nutritionSummary.per_serving?.fiber_g != null ? String(nutritionSummary.per_serving.fiber_g) : "",
                    salt_g: nutritionSummary.per_serving?.salt_g != null ? String(nutritionSummary.per_serving.salt_g) : "",
                  });
                  setNutritionPer100g({
                    kcal: nutritionSummary.per_100g?.kcal != null ? String(nutritionSummary.per_100g.kcal) : "",
                    protein_g: nutritionSummary.per_100g?.protein_g != null ? String(nutritionSummary.per_100g.protein_g) : "",
                    fat_g: nutritionSummary.per_100g?.fat_g != null ? String(nutritionSummary.per_100g.fat_g) : "",
                    carbs_g: nutritionSummary.per_100g?.carbs_g != null ? String(nutritionSummary.per_100g.carbs_g) : "",
                    sugar_g: nutritionSummary.per_100g?.sugar_g != null ? String(nutritionSummary.per_100g.sugar_g) : "",
                    fiber_g: nutritionSummary.per_100g?.fiber_g != null ? String(nutritionSummary.per_100g.fiber_g) : "",
                    salt_g: nutritionSummary.per_100g?.salt_g != null ? String(nutritionSummary.per_100g.salt_g) : "",
                  });
                }}
              >
                {tt("Apply to manual nutrition", "Przenieś do manual nutrition")}
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <p>kcal: {nutritionSummary.kcal || 0}</p>
            <p>protein_g: {nutritionSummary.protein_g || 0}</p>
            <p>fat_g: {nutritionSummary.fat_g || 0}</p>
            <p>carbs_g: {nutritionSummary.carbs_g || 0}</p>
            <p>sugar_g: {nutritionSummary.sugar_g || 0}</p>
            <p>fiber_g: {nutritionSummary.fiber_g || 0}</p>
            <p>salt_g: {nutritionSummary.salt_g || 0}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{tt("Product images", "Zdjęcia produktu")}</h2>
            <p className="text-sm text-slate-600">{tt("Add image URLs or upload files directly to Supabase Storage.", "Dodaj adresy URL zdjęć lub wgraj pliki bezpośrednio do Supabase Storage.")}</p>
          </div>
          {canEditContent ? (
            <div className="flex items-center gap-2">
              <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handleImageUpload(event.target.files)} />
              <Button type="button" variant="secondary" size="sm" onClick={() => uploadInputRef.current?.click()} disabled={uploadingImages}>
                {uploadingImages ? tt("Uploading...", "Wgrywanie...") : tt("Upload images", "Wgraj zdjęcia")}
              </Button>
            </div>
          ) : null}
        </header>

        {canEditContent ? (
          <div className="flex flex-wrap gap-2">
            <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://..." className="max-w-lg" />
            <Button type="button" variant="secondary" onClick={addImageUrl}>
              {tt("Add URL", "Dodaj URL")}
            </Button>
          </div>
        ) : null}

        {imageUrls.length === 0 ? (
          <p className="text-sm text-slate-500">{tt("No images yet.", "Brak zdjęć.")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {imageUrls.map((url) => (
              <div key={url} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="mb-2 aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
                  <Image src={url} alt="Recipe product" className="h-full w-full object-cover" width={480} height={360} unoptimized />
                </div>
                <p className="truncate text-xs text-slate-600">{url}</p>
                {canEditContent ? (
                  <Button type="button" variant="ghost" size="sm" className="mt-2 text-red-600 hover:bg-red-50" onClick={() => setImageUrls((prev) => prev.filter((item) => item !== url))}>
                    {tt("Remove", "Usuń")}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{tt("Ingredients", "Składniki")}</h2>
            <p className="text-sm text-slate-600">{tt("Capture each ingredient as a structured row.", "Każdy składnik zapisz jako osobny, uporządkowany wiersz.")}</p>
          </div>
          {canEditContent ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setIngredients((prev) => [...prev, { name: "", amount: "", unit: "", note: "" }])}>
              {tt("Add ingredient", "Dodaj składnik")}
            </Button>
          ) : null}
        </header>

        <div className="space-y-2">
          {ingredients.map((ingredient, index) => (
            <div key={`ingredient-${index}`} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2 sm:grid-cols-5">
                <Input placeholder={tt("ingredient_key (optional)", "ingredient_key (opcjonalnie)")} value={ingredient.ingredient_key || ""} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, ingredient_key: e.target.value } : item)))} />
                <Input placeholder={tt("Name", "Nazwa")} value={ingredient.name} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))} />
                <Input placeholder={tt("Amount", "Ilość")} value={ingredient.amount} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)))} />
                <Input placeholder={tt("Unit", "Jednostka")} value={ingredient.unit} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, unit: e.target.value } : item)))} />
                <Input placeholder={tt("Note (optional)", "Notatka (opcjonalnie)")} value={ingredient.note || ""} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, note: e.target.value } : item)))} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <IngredientProductLinker
                  disabled={!canEditContent}
                  onSelect={(product) => {
                    setIngredients((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              off_barcode: product.barcode,
                              off_product_name: product.name,
                              off_nutrition_per_100g: product.nutrition_per_100g,
                              off_image_url: product.image_url || undefined,
                              off_categories: product.categories || [],
                            }
                          : item,
                      ),
                    );
                  }}
                />
                {ingredient.off_product_name ? (
                  <span className="text-xs text-slate-600">
                    {ingredient.off_product_name} ({ingredient.off_barcode || "—"}) · {tt("kcal/100g", "kcal/100g")}: {ingredient.off_nutrition_per_100g?.kcal ?? "—"}
                  </span>
                ) : null}
                {canEditContent ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const suggestions = suggestSubstitutionsForIngredient(ingredient);
                      const slotKey = getIngredientSlotKey(ingredient, index);
                      setSubstitutions((prev) => {
                        const existing = prev.find((item) => item.ingredient_key === slotKey);
                        const mapped = suggestions.map((item) => ({
                          alt_name: item.alt_name,
                          ratio: "1:1",
                          note: item.note,
                          dietary_tags: [],
                        }));
                        if (!existing) {
                          return [...prev, { ingredient_key: slotKey, alternatives: mapped }];
                        }
                        return prev.map((item) =>
                          item.ingredient_key === slotKey ? { ...item, alternatives: [...item.alternatives, ...mapped] } : item,
                        );
                      });
                    }}
                  >
                    {tt("Suggest swaps", "Zasugeruj zamienniki")}
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tt("Substitutions", "Zamienniki")}</p>
                {getAlternativesForIngredient(getIngredientSlotKey(ingredient, index)).map((alternative, altIndex) => (
                  <div key={`alt-${index}-${altIndex}`} className="grid gap-2 sm:grid-cols-4">
                    <Input
                      placeholder={tt("Alternative name", "Nazwa zamiennika")}
                      value={alternative.alt_name}
                      disabled={!canEditContent}
                      onChange={(event) =>
                        updateAlternative(getIngredientSlotKey(ingredient, index), altIndex, "alt_name", event.target.value)
                      }
                    />
                    <Input
                      placeholder={tt("Ratio (e.g. 1:1)", "Proporcja (np. 1:1)")}
                      value={alternative.ratio || ""}
                      disabled={!canEditContent}
                      onChange={(event) =>
                        updateAlternative(getIngredientSlotKey(ingredient, index), altIndex, "ratio", event.target.value)
                      }
                    />
                    <Input
                      placeholder={tt("Dietary tags (comma)", "Tagi dietetyczne (po przecinku)")}
                      value={(alternative.dietary_tags || []).join(", ")}
                      disabled={!canEditContent}
                      onChange={(event) =>
                        updateAlternative(getIngredientSlotKey(ingredient, index), altIndex, "dietary_tags", event.target.value)
                      }
                    />
                    <Input
                      placeholder={tt("Note", "Notatka")}
                      value={alternative.note || ""}
                      disabled={!canEditContent}
                      onChange={(event) =>
                        updateAlternative(getIngredientSlotKey(ingredient, index), altIndex, "note", event.target.value)
                      }
                    />
                    {canEditContent ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-fit text-red-600 hover:bg-red-50"
                        onClick={() => removeAlternative(getIngredientSlotKey(ingredient, index), altIndex)}
                      >
                        {tt("Remove alternative", "Usuń zamiennik")}
                      </Button>
                    ) : null}
                  </div>
                ))}
                {canEditContent ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => addAlternative(getIngredientSlotKey(ingredient, index))}>
                    {tt("Add alternative", "Dodaj zamiennik")}
                  </Button>
                ) : null}
              </div>
              {canEditContent ? (
                <Button type="button" variant="ghost" size="sm" className="w-fit text-red-600 hover:bg-red-50" onClick={() => setIngredients((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}>
                  {tt("Remove ingredient", "Usuń składnik")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{tt("Steps", "Kroki")}</h2>
            <p className="text-sm text-slate-600">{tt("Keep instructions concise and ordered for easier review.", "Zachowaj krótkie i uporządkowane instrukcje dla łatwej recenzji.")}</p>
          </div>
          {canEditContent ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setSteps((prev) => [...prev, { step_number: prev.length + 1, text: "", timer_seconds: null }])}>
              {tt("Add step", "Dodaj krok")}
            </Button>
          ) : null}
        </header>

        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={`step-${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-5">
              <div className="flex h-9 items-center rounded-md bg-white px-3 text-sm text-slate-600">{tt("Step", "Krok")} {index + 1}</div>
              <Textarea placeholder={tt("Describe this step", "Opisz ten krok")} value={step.text} disabled={!canEditContent} onChange={(e) => setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, text: e.target.value } : item)))} className="sm:col-span-3 min-h-9" />
              <Input type="number" min={0} placeholder={tt("Timer sec", "Timer sek")} value={step.timer_seconds ?? ""} disabled={!canEditContent} onChange={(e) => setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, timer_seconds: e.target.value ? Number(e.target.value) : null } : item)))} />
              {canEditContent ? (
                <Button type="button" variant="ghost" size="sm" className="w-fit text-red-600 hover:bg-red-50" onClick={() => setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}>
                  {tt("Remove", "Usuń")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl">
        <header className="space-y-1 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">{tt("Recipe Preview", "Podgląd przepisu")}</h2>
          <p className="text-sm text-slate-600">{tt("Live preview for admin quality check before publishing.", "Podgląd na żywo do kontroli jakości przed publikacją.")}</p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
          <div className="space-y-3">
            <div className="aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              {imageUrls[0] ? (
                <Image src={imageUrls[0]} alt={title || "Recipe"} width={1200} height={675} className="h-full w-full object-cover" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">{tt("No hero image yet", "Brak zdjęcia głównego")}</div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">{title || tt("Untitled recipe", "Przepis bez tytułu")}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {description || subtitle || tt("Add a short description to improve recipe quality.", "Dodaj krótki opis, aby poprawić jakość przepisu.")}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">{tt("Nutrition", "Nutrition")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tt("Per serving", "Na porcję")}</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                    {nutritionKeys.map((key) => (
                      <li key={`preview-serving-${key}`}>{key}: {nutritionPerServing[key] || "-"}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tt("Per 100g", "Na 100g")}</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                    {nutritionKeys.map((key) => (
                      <li key={`preview-100g-${key}`}>{key}: {nutritionPer100g[key] || "-"}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-700">{tt("Ingredients", "Składniki")}</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {normalizeIngredients(ingredients).map((item, index) => (
                  <li key={`preview-ingredient-${index}`}>
                    {item.amount} {item.unit} {item.name} {item.note ? `(${item.note})` : ""}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-700">{tt("Steps", "Kroki")}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {normalizeSteps(steps).map((item) => (
                  <li key={`preview-step-${item.step_number}`}>
                    {item.text}{" "}
                    {item.timer_seconds ? <span className="text-slate-500">({item.timer_seconds}s)</span> : null}
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-700">{tt("Substitutions", "Zamienniki")}</p>
              {normalizeSubstitutions(substitutions).length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">{tt("No substitutions yet.", "Brak zamienników.")}</p>
              ) : (
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {normalizeSubstitutions(substitutions).map((item) => (
                    <div key={`preview-sub-${item.ingredient_key}`}>
                      <p className="font-medium">{item.ingredient_key}</p>
                      <ul className="pl-4">
                        {item.alternatives.map((alt, idx) => (
                          <li key={`preview-alt-${item.ingredient_key}-${idx}`} className="list-disc">
                            {alt.alt_name} {alt.ratio ? `(${alt.ratio})` : ""} {alt.note ? `- ${alt.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <Button disabled={submitting || isAutoSaving} type="submit">
            {submitting ? tt("Saving...", "Zapisywanie...") : tt("Save recipe", "Zapisz przepis")}
          </Button>
        </div>

        {process.env.NODE_ENV !== "production" ? (
          <section className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="mb-2 font-semibold">{tt("Debug panel (dev only)", "Panel debug (tylko dev)")}</p>
            <details>
              <summary className="cursor-pointer font-medium">{tt("Last payload JSON", "Ostatni payload JSON")}</summary>
              <pre className="mt-2 overflow-auto rounded bg-white p-2">{JSON.stringify(lastPayloadDebug, null, 2)}</pre>
            </details>
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">{tt("Last error JSON", "Ostatni błąd JSON")}</summary>
              <pre className="mt-2 overflow-auto rounded bg-white p-2">{JSON.stringify(lastErrorDebug, null, 2)}</pre>
            </details>
          </section>
        ) : null}
      </div>

      {toast ? (
        <div
          className={
            toast.type === "error"
              ? "fixed right-4 top-4 z-50 max-w-xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-md"
              : "fixed right-4 top-4 z-50 max-w-xl rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-md"
          }
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </form>
  );
}
