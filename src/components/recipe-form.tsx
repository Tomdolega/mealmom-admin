"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { IngredientItem, ProfileRole, RecipeRecord, RecipeStatus, StepItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const allStatuses: RecipeStatus[] = ["draft", "in_review", "published", "archived"];

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

function statusOptionsForRole(role: ProfileRole, mode: "create" | "edit") {
  if (role === "admin") return allStatuses;
  if (role === "reviewer") return ["in_review", "published"];
  if (mode === "create") return ["draft"];
  return ["draft"];
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
  const router = useRouter();

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
  const [ingredients, setIngredients] = useState<IngredientItem[]>(
    recipe?.ingredients?.length ? recipe.ingredients : [{ name: "", amount: "", unit: "", note: "" }],
  );
  const [steps, setSteps] = useState<StepItem[]>(
    recipe?.steps?.length ? recipe.steps : [{ step_number: 1, text: "", timer_seconds: null }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedStatuses = useMemo(() => statusOptionsForRole(role, mode), [mode, role]);
  const availableCuisineOptions = enabledCuisines.filter((item) => !selectedCuisines.includes(item));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    const payload = {
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
      ingredients: normalizeIngredients(ingredients),
      steps: normalizeSteps(steps),
    };

    const result =
      mode === "create"
        ? await supabase.from("recipes").insert(payload).select("id").single()
        : await supabase.from("recipes").update(payload).eq("id", recipe!.id).select("id").single();

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push(`/recipes/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Title">
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Subtitle">
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Language">
            <Select value={recipeLanguage} onChange={(e) => setRecipeLanguage(e.target.value)}>
              {enabledLanguages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as RecipeStatus)}>
              {allowedStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Primary cuisine">
            <Select value={primaryCuisine} onChange={(e) => setPrimaryCuisine(e.target.value)}>
              <option value="">None</option>
              {enabledCuisines.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Cuisines">
            <Select
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                setSelectedCuisines((prev) => [...prev, value]);
              }}
            >
              <option value="">Add cuisine...</option>
              {availableCuisineOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedCuisines.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {item}
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-900"
                    onClick={() => setSelectedCuisines((prev) => prev.filter((value) => value !== item))}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </FormField>
          <FormField label="Tags (comma-separated)">
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="quick, family" />
          </FormField>
          <FormField label="Servings">
            <Input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
          </FormField>
          <FormField label="Total minutes">
            <Input type="number" min={0} value={totalMinutes} onChange={(e) => setTotalMinutes(e.target.value)} />
          </FormField>
          <FormField label="Difficulty">
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Select...</option>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIngredients((prev) => [...prev, { name: "", amount: "", unit: "", note: "" }])}
          >
            Add ingredient
          </Button>
        </div>

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <div key={`ingredient-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
              <Input
                placeholder="Name"
                value={ingredient.name}
                onChange={(e) =>
                  setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))
                }
              />
              <Input
                placeholder="Amount"
                value={ingredient.amount}
                onChange={(e) =>
                  setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)))
                }
              />
              <Input
                placeholder="Unit"
                value={ingredient.unit}
                onChange={(e) =>
                  setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, unit: e.target.value } : item)))
                }
              />
              <Input
                placeholder="Note (optional)"
                value={ingredient.note || ""}
                onChange={(e) =>
                  setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, note: e.target.value } : item)))
                }
              />
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="w-fit"
                onClick={() => setIngredients((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Steps</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSteps((prev) => [...prev, { step_number: prev.length + 1, text: "", timer_seconds: null }])}
          >
            Add step
          </Button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={`step-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-5">
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                Step {index + 1}
              </div>
              <Textarea
                placeholder="Step text"
                value={step.text}
                onChange={(e) => setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, text: e.target.value } : item)))}
                className="sm:col-span-3 min-h-10"
              />
              <Input
                type="number"
                min={0}
                placeholder="Timer (sec)"
                value={step.timer_seconds ?? ""}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, timer_seconds: e.target.value ? Number(e.target.value) : null } : item,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="w-fit"
                onClick={() => setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <Button disabled={submitting} type="submit">
        {submitting ? "Saving..." : mode === "create" ? "Create recipe" : "Save changes"}
      </Button>
    </form>
  );
}
