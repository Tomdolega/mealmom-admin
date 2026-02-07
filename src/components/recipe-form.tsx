"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { IngredientItem, ProfileRole, RecipeRecord, RecipeStatus, StepItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getRecipeStatusLabel } from "@/lib/recipe-status";
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
      name: item.name.trim(),
      amount: item.amount.trim(),
      unit: item.unit.trim(),
      note: item.note?.trim() || "",
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(recipe?.updated_at || null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>(() =>
    JSON.stringify({
      translation_group_id: recipe?.translation_group_id || translationGroupId,
      language: recipe?.language || language || defaultLanguage || enabledLanguages[0] || "en",
      title: recipe?.title || "",
      subtitle: recipe?.subtitle || null,
      status: recipe?.status || (role === "reviewer" ? "in_review" : "draft"),
      primary_cuisine: recipe?.primary_cuisine || null,
      cuisines: recipe?.cuisines || [],
      tags: recipe?.tags || [],
      servings: recipe?.servings ?? null,
      total_minutes: recipe?.total_minutes ?? null,
      difficulty: recipe?.difficulty || null,
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

  const payload = useMemo(
    () => ({
      translation_group_id: recipe?.translation_group_id || translationGroupId,
      language: recipeLanguage,
      title,
      subtitle: subtitle || null,
      status,
      primary_cuisine: primaryCuisine || null,
      cuisines: selectedCuisines,
      tags: tagsText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      servings: servings ? Number(servings) : null,
      total_minutes: totalMinutes ? Number(totalMinutes) : null,
      difficulty: difficulty || null,
      image_urls: imageUrls,
      ingredients: normalizeIngredients(ingredients),
      steps: normalizeSteps(steps),
    }),
    [
      difficulty,
      imageUrls,
      ingredients,
      primaryCuisine,
      recipe?.translation_group_id,
      recipeLanguage,
      selectedCuisines,
      servings,
      status,
      steps,
      subtitle,
      tagsText,
      title,
      totalMinutes,
      translationGroupId,
    ],
  );

  const currentSnapshot = useMemo(() => JSON.stringify(payload), [payload]);
  const isDirty = currentSnapshot !== lastSavedSnapshot;

  const saveRecipe = useCallback(
    async (kind: SaveKind) => {
      if (kind === "autosave" && (!canAutoSave || !autoSaveEnabled || status !== "draft" || !isDirty)) {
        return;
      }

      setError(null);
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
        setError(tt("Could not save this recipe. Check required fields and try again.", "Nie udało się zapisać przepisu. Sprawdź wymagane pola i spróbuj ponownie."));
        return;
      }

      setLastSavedSnapshot(JSON.stringify(payload));
      setLastSavedAt(result.data.updated_at || new Date().toISOString());

      if (mode === "create") {
        router.push(`/recipes/${result.data.id}`);
        router.refresh();
        return;
      }

      if (kind === "manual") {
        router.refresh();
      }
    },
    [autoSaveEnabled, canAutoSave, isDirty, mode, payload, recipe, router, status, tt],
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
        setError(
          tt(
            `Could not upload one or more images. Ensure bucket '${imageBucket}' exists and has upload policies for authenticated users.`,
            `Nie udało się wgrać jednego lub więcej zdjęć. Upewnij się, że bucket '${imageBucket}' istnieje i ma polityki uploadu dla zalogowanych użytkowników.`,
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
            <div key={`ingredient-${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
              <Input placeholder={tt("Name", "Nazwa")} value={ingredient.name} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))} />
              <Input placeholder={tt("Amount", "Ilość")} value={ingredient.amount} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)))} />
              <Input placeholder={tt("Unit", "Jednostka")} value={ingredient.unit} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, unit: e.target.value } : item)))} />
              <Input placeholder={tt("Note (optional)", "Notatka (opcjonalnie)")} value={ingredient.note || ""} disabled={!canEditContent} onChange={(e) => setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, note: e.target.value } : item)))} />
              {canEditContent ? (
                <Button type="button" variant="ghost" size="sm" className="w-fit text-red-600 hover:bg-red-50" onClick={() => setIngredients((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}>
                  {tt("Remove", "Usuń")}
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

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex items-center justify-end">
        <Button disabled={submitting || isAutoSaving} type="submit">
          {submitting ? tt("Saving...", "Zapisywanie...") : tt("Save recipe", "Zapisz przepis")}
        </Button>
      </div>
    </form>
  );
}
