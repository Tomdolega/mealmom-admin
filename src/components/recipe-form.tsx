"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { IngredientItem, ProfileRole, RecipeRecord, RecipeStatus, StepItem } from "@/lib/types";

const allStatuses: RecipeStatus[] = ["draft", "in_review", "published", "archived"];

type RecipeFormProps = {
  mode: "create" | "edit";
  role: ProfileRole;
  recipe?: RecipeRecord;
  translationGroupId?: string;
  language?: string;
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

export function RecipeForm({ mode, role, recipe, translationGroupId, language }: RecipeFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(recipe?.title || "");
  const [subtitle, setSubtitle] = useState(recipe?.subtitle || "");
  const [recipeLanguage, setRecipeLanguage] = useState(recipe?.language || language || "en");
  const [status, setStatus] = useState<RecipeStatus>(recipe?.status || (role === "reviewer" ? "in_review" : "draft"));
  const [primaryCuisine, setPrimaryCuisine] = useState(recipe?.primary_cuisine || "");
  const [cuisinesText, setCuisinesText] = useState((recipe?.cuisines || []).join(", "));
  const [tagsText, setTagsText] = useState((recipe?.tags || []).join(", "));
  const [servings, setServings] = useState(recipe?.servings?.toString() || "");
  const [totalMinutes, setTotalMinutes] = useState(recipe?.total_minutes?.toString() || "");
  const [difficulty, setDifficulty] = useState(recipe?.difficulty || "");
  const [ingredients, setIngredients] = useState<IngredientItem[]>(
    recipe?.ingredients?.length
      ? recipe.ingredients
      : [{ name: "", amount: "", unit: "", note: "" }],
  );
  const [steps, setSteps] = useState<StepItem[]>(
    recipe?.steps?.length
      ? recipe.steps
      : [{ step_number: 1, text: "", timer_seconds: null }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedStatuses = useMemo(() => statusOptionsForRole(role, mode), [mode, role]);

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
      cuisines: cuisinesText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
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

    const nextId = result.data.id;
    router.push(`/recipes/${nextId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-4 text-lg font-semibold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Subtitle</label>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Language</label>
            <input
              required
              value={recipeLanguage}
              onChange={(e) => setRecipeLanguage(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="en"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RecipeStatus)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {allowedStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Primary cuisine</label>
            <input
              value={primaryCuisine}
              onChange={(e) => setPrimaryCuisine(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Italian"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Cuisines (comma-separated)</label>
            <input
              value={cuisinesText}
              onChange={(e) => setCuisinesText(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Italian, Mediterranean"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="quick, family"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Servings</label>
            <input
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Total minutes</label>
            <input
              type="number"
              min={0}
              value={totalMinutes}
              onChange={(e) => setTotalMinutes(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Select...</option>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm"
            onClick={() =>
              setIngredients((prev) => [...prev, { name: "", amount: "", unit: "", note: "" }])
            }
          >
            Add ingredient
          </button>
        </div>

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <div key={`ingredient-${index}`} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-4">
              <input
                placeholder="Name"
                value={ingredient.name}
                onChange={(e) =>
                  setIngredients((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)),
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                placeholder="Amount"
                value={ingredient.amount}
                onChange={(e) =>
                  setIngredients((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)),
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                placeholder="Unit"
                value={ingredient.unit}
                onChange={(e) =>
                  setIngredients((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, unit: e.target.value } : item)),
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                placeholder="Note (optional)"
                value={ingredient.note || ""}
                onChange={(e) =>
                  setIngredients((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, note: e.target.value } : item)),
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2"
              />
              <button
                type="button"
                className="w-fit rounded-md border border-red-200 px-3 py-1 text-sm text-red-600"
                onClick={() =>
                  setIngredients((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Steps</h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm"
            onClick={() =>
              setSteps((prev) => [...prev, { step_number: prev.length + 1, text: "", timer_seconds: null }])
            }
          >
            Add step
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={`step-${index}`} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-5">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">Step {index + 1}</div>
              <input
                placeholder="Step text"
                value={step.text}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, text: e.target.value } : item)),
                  )
                }
                className="sm:col-span-3 rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                type="number"
                min={0}
                placeholder="Timer (sec)"
                value={step.timer_seconds ?? ""}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((item, i) =>
                      i === index
                        ? { ...item, timer_seconds: e.target.value ? Number(e.target.value) : null }
                        : item,
                    ),
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2"
              />
              <button
                type="button"
                className="w-fit rounded-md border border-red-200 px-3 py-1 text-sm text-red-600"
                onClick={() => setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        disabled={submitting}
        type="submit"
        className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {submitting ? "Saving..." : mode === "create" ? "Create recipe" : "Save changes"}
      </button>
    </form>
  );
}
