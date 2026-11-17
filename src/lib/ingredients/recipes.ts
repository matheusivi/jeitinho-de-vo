import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/lib/db";
import { assertRole, type SessionUser } from "@/lib/auth/types";
import { costOf } from "./ingredients";
import type { BaseUnit } from "./units";

const { recipes, recipeItems, ingredients, ingredientMovements } = schema;

export class RecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeError";
  }
}

const recipeInput = z.object({
  yieldQty: z.number().int("O rendimento precisa ser um número inteiro.").min(1, "Informe o rendimento (quantas unidades a receita faz).").max(10_000, "Rendimento muito alto."),
  notes: z.string().trim().max(2000, "Observação muito longa.").optional(),
  items: z
    .array(z.object({ ingredientId: z.string().min(1), qtyMilli: z.number().int().positive("Toda quantidade precisa ser maior que zero.").max(10_000_000_000) }))
    .min(1, "Adicione pelo menos um insumo.")
    .max(60, "Receita com insumos demais."),
});
export type RecipeInput = z.input<typeof recipeInput>;

export type RecipeItemView = {
  ingredientId: string; name: string; baseUnit: BaseUnit; packageName: string | null; packageSizeMilli: number | null;
  qtyMilli: number; avgCostCentsPerBase: number | null; active: boolean;
};
export type RecipeView = { id: string; productId: string; yieldQty: number; notes: string; items: RecipeItemView[] };

export async function saveRecipe(productId: string, input: RecipeInput, user: SessionUser): Promise<void> {
  assertRole(user, "ADMIN");
  const r = recipeInput.safeParse(input);
  if (!r.success) throw new RecipeError(r.error.issues[0].message);
  const data = r.data;
  const ids = data.items.map((i) => i.ingredientId);
  if (new Set(ids).size !== ids.length) throw new RecipeError("Há insumo repetido na receita; junte as quantidades em uma linha.");
  const [product] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, productId));
  if (!product) throw new RecipeError("Produto não encontrado.");
  const found = await db.select({ id: ingredients.id }).from(ingredients).where(inArray(ingredients.id, ids));
  if (found.length !== ids.length) throw new RecipeError("Algum insumo da receita não existe mais.");
  await db.transaction(async (tx) => {
    const [rec] = await tx
      .insert(recipes)
      .values({ productId, yieldQty: data.yieldQty, notes: data.notes ?? "" })
      .onConflictDoUpdate({ target: recipes.productId, set: { yieldQty: data.yieldQty, notes: data.notes ?? "", updatedAt: new Date() } })
      .returning({ id: recipes.id });
    await tx.delete(recipeItems).where(eq(recipeItems.recipeId, rec.id));
    await tx.insert(recipeItems).values(data.items.map((i) => ({ recipeId: rec.id, ingredientId: i.ingredientId, qtyMilli: i.qtyMilli })));
  });
}

export async function deleteRecipe(productId: string, user: SessionUser): Promise<void> {
  assertRole(user, "ADMIN");
  await db.delete(recipes).where(eq(recipes.productId, productId));
}

/** Receitas de vários produtos de uma vez (para custo do cardápio e relatórios). */
export async function getRecipes(productIds: string[], tx: DbOrTx = db): Promise<Map<string, RecipeView>> {
  const out = new Map<string, RecipeView>();
  if (productIds.length === 0) return out;
  const recs = await tx.select().from(recipes).where(inArray(recipes.productId, productIds));
  if (recs.length === 0) return out;
  const items = await tx
    .select({
      recipeId: recipeItems.recipeId, ingredientId: recipeItems.ingredientId, qtyMilli: recipeItems.qtyMilli,
      name: ingredients.name, baseUnit: ingredients.baseUnit, packageName: ingredients.packageName,
      packageSizeMilli: ingredients.packageSizeMilli, avgCostCentsPerBase: ingredients.avgCostCentsPerBase, active: ingredients.active,
    })
    .from(recipeItems)
    .innerJoin(ingredients, eq(ingredients.id, recipeItems.ingredientId))
    .where(inArray(recipeItems.recipeId, recs.map((r) => r.id)))
    .orderBy(asc(ingredients.name));
  for (const rec of recs) {
    out.set(rec.productId, {
      id: rec.id, productId: rec.productId, yieldQty: rec.yieldQty, notes: rec.notes,
      items: items.filter((i) => i.recipeId === rec.id).map(({ recipeId: _r, ...i }) => i),
    });
  }
  return out;
}

export async function getRecipe(productId: string): Promise<RecipeView | null> {
  return (await getRecipes([productId])).get(productId) ?? null;
}

export type ConsumeResult = {
  hasRecipe: boolean;
  negatives: { ingredientId: string; name: string; baseUnit: BaseUnit; stockMilli: number }[];
};

/**
 * Baixa os insumos de uma produção pela receita, na proporção do rendimento. Roda dentro da
 * transação da produção. Insumo pode ficar negativo: a produção não trava, e o retorno avisa.
 */
export async function consumeForProduction(
  productId: string,
  quantity: number,
  stockMovementId: string,
  userId: string,
  tx: DbOrTx,
): Promise<ConsumeResult> {
  const recipe = (await getRecipes([productId], tx)).get(productId);
  if (!recipe) return { hasRecipe: false, negatives: [] };
  const negatives: ConsumeResult["negatives"] = [];
  // ordem fixa por id evita deadlock entre produções simultâneas com insumos em comum
  for (const item of [...recipe.items].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))) {
    const qty = Math.round((item.qtyMilli * quantity) / recipe.yieldQty);
    if (qty <= 0) continue;
    const [row] = await tx
      .update(ingredients)
      .set({ stockMilli: sql`${ingredients.stockMilli} - ${qty}` })
      .where(eq(ingredients.id, item.ingredientId))
      .returning({ stockMilli: ingredients.stockMilli, avg: ingredients.avgCostCentsPerBase, name: ingredients.name, baseUnit: ingredients.baseUnit });
    await tx.insert(ingredientMovements).values({
      ingredientId: item.ingredientId, type: "PRODUCTION", qtyMilli: -qty, costCents: costOf(qty, row.avg), stockMovementId, userId,
    });
    if (row.stockMilli < 0) {
      negatives.push({ ingredientId: item.ingredientId, name: row.name, baseUnit: row.baseUnit, stockMilli: row.stockMilli });
    }
  }
  negatives.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { hasRecipe: true, negatives };
}
