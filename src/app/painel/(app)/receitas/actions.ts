"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { db, schema } from "@/lib/db";
import { deleteRecipe, RecipeError, saveRecipe } from "@/lib/ingredients/recipes";
import { isInputUnit, parseQtyInput, toMilli, UnitError } from "@/lib/ingredients/units";
import { setCmvTargetBps } from "@/lib/settings";

export type RecipeState = { error?: string; ok?: string };

export async function saveRecipeAction(_p: RecipeState, form: FormData): Promise<RecipeState> {
  const user = await requireRole("ADMIN");
  const productId = String(form.get("productId") ?? "");
  const ids = form.getAll("ingredientId").map(String);
  const qtys = form.getAll("qty").map(String);
  const units = form.getAll("unit").map(String);
  const yieldQty = Number(String(form.get("yieldQty") ?? "").trim());
  try {
    const found = ids.length
      ? await db.select().from(schema.ingredients).where(inArray(schema.ingredients.id, ids))
      : [];
    const byId = new Map(found.map((i) => [i.id, i]));
    const items = ids.map((id, i) => {
      const ing = byId.get(id);
      if (!ing) throw new RecipeError(`Escolha o insumo da linha ${i + 1}.`);
      const unit = units[i];
      if (!isInputUnit(unit)) throw new UnitError(`Escolha a unidade de ${ing.name}.`);
      try {
        return { ingredientId: id, qtyMilli: toMilli(parseQtyInput(qtys[i] ?? ""), unit, ing) };
      } catch (e) {
        if (e instanceof UnitError) throw new UnitError(`${ing.name}: ${e.message}`);
        throw e;
      }
    });
    await saveRecipe(productId, { yieldQty, notes: String(form.get("notes") ?? ""), items }, user);
  } catch (e) {
    if (e instanceof RecipeError || e instanceof UnitError) return { error: e.message };
    throw e;
  }
  revalidatePath("/painel/receitas");
  revalidatePath(`/painel/receitas/${productId}`);
  return { ok: "Receita salva. O custo abaixo já está atualizado." };
}

export async function deleteRecipeAction(form: FormData): Promise<void> {
  const user = await requireRole("ADMIN");
  const productId = String(form.get("productId") ?? "");
  await deleteRecipe(productId, user);
  revalidatePath("/painel/receitas");
  revalidatePath(`/painel/receitas/${productId}`);
}

export async function setCmvTargetAction(_p: RecipeState, form: FormData): Promise<RecipeState> {
  const user = await requireRole("ADMIN");
  const pct = Number(String(form.get("pct") ?? "").replace(",", "."));
  if (!Number.isFinite(pct)) return { error: "Informe a meta em porcentagem, por exemplo 35." };
  try {
    await setCmvTargetBps(Math.round(pct * 100), user);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Meta inválida." };
  }
  revalidatePath("/painel/receitas", "layout");
  return { ok: "Meta salva." };
}
