import { asc } from "drizzle-orm";
import { db, schema, type DbOrTx } from "@/lib/db";
import { assertRole, type SessionUser } from "@/lib/auth/types";
import { getCmvTargetBps } from "@/lib/settings";
import { getRecipes, type RecipeView } from "./recipes";

export type CostLine = {
  ingredientId: string; name: string; qtyMilli: number; baseUnit: RecipeView["items"][number]["baseUnit"];
  lineCostCents: number | null; sharePct: number;
};
export type RecipeCost = {
  complete: boolean;
  /** Custo da receita inteira (fornada), em centavos. Nulo se algum insumo não tem preço. */
  batchCostCents: number | null;
  /** Custo de uma unidade do produto, em centavos. Nulo se incompleto. */
  unitCostCents: number | null;
  /** Soma do que tem preço, para mostrar mesmo quando incompleto. */
  knownCostCents: number;
  missing: string[];
  lines: CostLine[];
  yieldQty: number;
};

/** Custo pela ficha técnica: Σ(quantidade × custo médio) ÷ rendimento, com o peso de cada insumo. */
export function costRecipe(recipe: RecipeView): RecipeCost {
  const raw = recipe.items.map((i) => ({
    ingredientId: i.ingredientId, name: i.name, qtyMilli: i.qtyMilli, baseUnit: i.baseUnit,
    exact: i.avgCostCentsPerBase === null ? null : (i.qtyMilli / 1000) * i.avgCostCentsPerBase,
  }));
  const known = raw.reduce((n, l) => n + (l.exact ?? 0), 0);
  const missing = raw.filter((l) => l.exact === null).map((l) => l.name);
  const lines: CostLine[] = raw
    .map((l) => ({
      ingredientId: l.ingredientId, name: l.name, qtyMilli: l.qtyMilli, baseUnit: l.baseUnit,
      lineCostCents: l.exact === null ? null : Math.round(l.exact),
      sharePct: l.exact === null || known === 0 ? 0 : (l.exact / known) * 100,
    }))
    .sort((a, b) => (b.lineCostCents ?? -1) - (a.lineCostCents ?? -1) || a.name.localeCompare(b.name, "pt-BR"));
  const complete = missing.length === 0;
  return {
    complete,
    batchCostCents: complete ? Math.round(known) : null,
    unitCostCents: complete ? Math.round(known / recipe.yieldQty) : null,
    knownCostCents: Math.round(known),
    missing,
    lines,
    yieldQty: recipe.yieldQty,
  };
}

export type MarginAnalysis = {
  /** Parte do preço que paga os insumos, em %. */
  cmvPct: number;
  /** Margem bruta (1 − CMV), em %. Ainda precisa pagar aluguel, luz, gás, mão de obra e lucro. */
  marginPct: number;
  /** Preço ÷ custo. */
  markup: number;
  grossProfitCents: number;
  aboveTarget: boolean;
  /** Preço mínimo para o CMV ficar na meta. */
  priceForTargetCents: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function analyzeMargin(priceCents: number, unitCostCents: number | null, targetBps: number): MarginAnalysis | null {
  if (unitCostCents === null || priceCents <= 0) return null;
  const cmv = unitCostCents / priceCents;
  return {
    cmvPct: round1(cmv * 100),
    marginPct: round1((1 - cmv) * 100),
    markup: unitCostCents > 0 ? Math.round((priceCents / unitCostCents) * 100) / 100 : 0,
    grossProfitCents: priceCents - unitCostCents,
    aboveTarget: cmv * 10000 > targetBps,
    priceForTargetCents: Math.ceil(unitCostCents / (targetBps / 10000)),
  };
}

/** Custo unitário atual de cada produto (nulo sem receita ou com custo incompleto), para guardar na venda. */
export async function unitCostsFor(productIds: string[], tx: DbOrTx = db): Promise<Map<string, number | null>> {
  const recipes = await getRecipes(productIds, tx);
  return new Map(productIds.map((id) => {
    const r = recipes.get(id);
    return [id, r ? costRecipe(r).unitCostCents : null];
  }));
}

export type ProductCostRow = {
  productId: string; name: string; priceCents: number; active: boolean; hasRecipe: boolean;
  cost: RecipeCost | null; margin: MarginAnalysis | null;
};

/** Custo e margem de todos os produtos. Só a dona. */
export async function listProductCosts(user: SessionUser): Promise<ProductCostRow[]> {
  assertRole(user, "ADMIN");
  const products = await db.select().from(schema.products).orderBy(asc(schema.products.name));
  const recipes = await getRecipes(products.map((p) => p.id));
  const target = await getCmvTargetBps();
  return products.map((p) => {
    const r = recipes.get(p.id);
    const cost = r ? costRecipe(r) : null;
    return {
      productId: p.id, name: p.name, priceCents: p.priceCents, active: p.active, hasRecipe: !!r,
      cost, margin: cost ? analyzeMargin(p.priceCents, cost.unitCostCents, target) : null,
    };
  });
}
