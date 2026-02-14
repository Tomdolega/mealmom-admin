import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole, RecipeStatus } from "@/lib/types";

const recipeStatuses: RecipeStatus[] = ["draft", "in_review", "published", "archived"];
const editorAllowedStatuses: RecipeStatus[] = ["draft", "in_review", "archived"];

type BulkAction =
  | "trash"
  | "restore"
  | "delete_permanent"
  | "set_status"
  | "assign_label"
  | "remove_label";

type BulkRequestBody = {
  action?: BulkAction;
  recipeIds?: string[];
  status?: RecipeStatus;
  labelId?: string;
};

function uniqueIds(values: string[] = []) {
  return [...new Set(values.filter((item) => typeof item === "string" && item.length > 0))];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle<{ role: ProfileRole }>();

  if (!profile || profile.role === "reviewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as BulkRequestBody;
  const action = body.action;
  const recipeIds = uniqueIds(body.recipeIds);
  if (!action || recipeIds.length === 0) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: recipes, error: recipeError } = await admin
    .from("recipes")
    .select("id, created_by")
    .in("id", recipeIds)
    .returns<Array<{ id: string; created_by: string | null }>>();

  if (recipeError) {
    return NextResponse.json({ error: recipeError.message }, { status: 400 });
  }
  if (!recipes || recipes.length === 0) {
    return NextResponse.json({ error: "No recipes found for provided ids." }, { status: 404 });
  }

  if (profile.role === "editor") {
    const unauthorized = recipes.filter((recipe) => recipe.created_by !== session.user.id);
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { error: "Editors can manage only recipes they created." },
        { status: 403 },
      );
    }
  }

  if (action === "delete_permanent" && profile.role !== "admin") {
    return NextResponse.json({ error: "Only admin can permanently delete recipes." }, { status: 403 });
  }

  if (action === "set_status") {
    const nextStatus = body.status;
    if (!nextStatus || !recipeStatuses.includes(nextStatus)) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }
    if (profile.role === "editor" && !editorAllowedStatuses.includes(nextStatus)) {
      return NextResponse.json(
        { error: "Editors cannot bulk publish recipes." },
        { status: 403 },
      );
    }

    const { error } = await admin.from("recipes").update({ status: nextStatus }).in("id", recipeIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, affected: recipeIds.length });
  }

  if (action === "trash") {
    const { error } = await admin
      .from("recipes")
      .update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id })
      .in("id", recipeIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, affected: recipeIds.length });
  }

  if (action === "restore") {
    const { error } = await admin
      .from("recipes")
      .update({ deleted_at: null, deleted_by: null })
      .in("id", recipeIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, affected: recipeIds.length });
  }

  if (action === "delete_permanent") {
    const { error } = await admin.from("recipes").delete().in("id", recipeIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, affected: recipeIds.length });
  }

  if (action === "assign_label" || action === "remove_label") {
    if (!body.labelId) {
      return NextResponse.json({ error: "labelId is required." }, { status: 400 });
    }

    if (action === "assign_label") {
      const rows = recipeIds.map((recipeId) => ({ recipe_id: recipeId, label_id: body.labelId! }));
      const { error } = await admin.from("recipe_labels").upsert(rows, {
        onConflict: "recipe_id,label_id",
        ignoreDuplicates: true,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, affected: recipeIds.length });
    }

    const { error } = await admin
      .from("recipe_labels")
      .delete()
      .eq("label_id", body.labelId)
      .in("recipe_id", recipeIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, affected: recipeIds.length });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
