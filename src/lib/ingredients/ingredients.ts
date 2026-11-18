import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/lib/db";
import { assertRole, type SessionUser } from "@/lib/auth/types";
import { formatQty, type BaseUnit } from "./units";

const { ingredients, ingredientMovements } = schema;
const MAX_MILLI = 10_000_000_000; // 10 toneladas, 10 mil litros ou 10 milhões de unidades
const MAX_CENTS = 10_000_000; // R$ 100 mil por lançamento

export class IngredientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngredientError";
  }
}

export type IngredientRow = typeof ingredients.$inferSelect;
export type StockStatus = "NEGATIVE" | "LOW" | "OK";
export type OutflowType = "LOSS" | "CONSUMPTION";

const ingredientInput = z.object({
  name: z.string().trim().min(1, "Informe o nome do insumo.").max(80, "Nome muito longo."),
  baseUnit: z.enum(["g", "ml", "un"], { message: "Escolha a unidade." }),
  packageName: z.string().trim().max(30).optional().nullable(),
  packageSizeMilli: z.number().int().optional().nullable(),
  minMilli: z.number().int().min(0).max(MAX_MILLI).optional(),
});
export type IngredientInput = z.input<typeof ingredientInput>;

function parseIngredient(input: IngredientInput) {
  const r = ingredientInput.safeParse(input);
  if (!r.success) throw new IngredientError(r.error.issues[0].message);
  const packageName = r.data.packageName ? r.data.packageName : null;
  let packageSizeMilli = r.data.packageSizeMilli ?? null;
  if (packageName) {
    if (!packageSizeMilli || packageSizeMilli <= 0 || packageSizeMilli > MAX_MILLI) {
      throw new IngredientError(`Informe o tamanho da embalagem (quanto tem em uma ${packageName}).`);
    }
  } else {
    packageSizeMilli = null;
  }
  return { name: r.data.name, baseUnit: r.data.baseUnit, packageName, packageSizeMilli, minMilli: r.data.minMilli };
}

async function assertUniqueName(name: string, exceptId?: string): Promise<void> {
  const where = exceptId
    ? and(sql`lower(${ingredients.name}) = lower(${name})`, ne(ingredients.id, exceptId))
    : sql`lower(${ingredients.name}) = lower(${name})`;
  const [dup] = await db.select({ id: ingredients.id }).from(ingredients).where(where);
  if (dup) throw new IngredientError("Já existe um insumo com esse nome.");
}

export async function createIngredient(input: IngredientInput, user: SessionUser): Promise<IngredientRow> {
  assertRole(user, "ADMIN");
  const data = parseIngredient(input);
  await assertUniqueName(data.name);
  const [row] = await db
    .insert(ingredients)
    .values({ ...data, minMilli: data.minMilli ?? 0 })
    .returning();
  return row;
}

export async function updateIngredient(
  id: string,
  input: IngredientInput & { active?: boolean },
  user: SessionUser,
): Promise<void> {
  assertRole(user, "ADMIN");
  const data = parseIngredient(input);
  const current = await getIngredient(id);
  if (current.baseUnit !== data.baseUnit) {
    const [used] = await db.select({ id: ingredientMovements.id }).from(ingredientMovements)
      .where(eq(ingredientMovements.ingredientId, id)).limit(1);
    const [inRecipe] = await db.select({ id: schema.recipeItems.id }).from(schema.recipeItems)
      .where(eq(schema.recipeItems.ingredientId, id)).limit(1);
    if (used || inRecipe) throw new IngredientError("Não dá para trocar a unidade de um insumo que já tem movimento ou está em receita.");
  }
  await assertUniqueName(data.name, id);
  await db
    .update(ingredients)
    .set({
      name: data.name,
      baseUnit: data.baseUnit,
      packageName: data.packageName,
      packageSizeMilli: data.packageSizeMilli,
      ...(data.minMilli !== undefined ? { minMilli: data.minMilli } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    })
    .where(eq(ingredients.id, id));
}

export async function getIngredient(id: string, tx: DbOrTx = db): Promise<IngredientRow> {
  const [row] = await tx.select().from(ingredients).where(eq(ingredients.id, id));
  if (!row) throw new IngredientError("Insumo não encontrado.");
  return row;
}

function assertMilli(q: number): void {
  if (!Number.isInteger(q) || q <= 0 || q > MAX_MILLI) throw new IngredientError("Informe uma quantidade maior que zero.");
}

/** Custo estimado de uma quantidade pelo custo médio; nulo quando o insumo nunca foi comprado. */
export function costOf(qtyMilli: number, avgCostCentsPerBase: number | null): number | null {
  if (avgCostCentsPerBase === null) return null;
  return Math.round((Math.abs(qtyMilli) / 1000) * avgCostCentsPerBase);
}

async function lockIngredient(id: string, tx: DbOrTx): Promise<IngredientRow> {
  const [row] = await tx.select().from(ingredients).where(eq(ingredients.id, id)).for("update");
  if (!row) throw new IngredientError("Insumo não encontrado.");
  return row;
}

/**
 * Compra: soma ao estoque e recalcula o custo médio ponderado. Se o estoque estava zerado ou
 * negativo, o custo passa a ser o da compra, para um estoque "devido" não distorcer a média.
 */
export async function purchase(
  ingredientId: string,
  qtyMilli: number,
  paidCents: number,
  user: SessionUser,
  note?: string,
): Promise<void> {
  assertRole(user, "ADMIN");
  assertMilli(qtyMilli);
  if (!Number.isInteger(paidCents) || paidCents <= 0 || paidCents > MAX_CENTS) {
    throw new IngredientError("Informe o valor pago.");
  }
  await db.transaction(async (tx) => {
    const row = await lockIngredient(ingredientId, tx);
    const stockBase = row.stockMilli / 1000;
    const boughtBase = qtyMilli / 1000;
    const avg =
      stockBase > 0 && row.avgCostCentsPerBase !== null
        ? (stockBase * row.avgCostCentsPerBase + paidCents) / (stockBase + boughtBase)
        : paidCents / boughtBase;
    await tx
      .update(ingredients)
      .set({ stockMilli: sql`${ingredients.stockMilli} + ${qtyMilli}`, avgCostCentsPerBase: avg })
      .where(eq(ingredients.id, ingredientId));
    await tx.insert(ingredientMovements).values({
      ingredientId, type: "PURCHASE", qtyMilli, costCents: paidCents, reason: note?.trim() || null, userId: user.id,
    });
  });
}

/** Perda ou consumo avulso. Qualquer pessoa da equipe pode lançar; o custo fica guardado para o relatório. */
export async function recordOutflow(
  ingredientId: string,
  qtyMilli: number,
  type: OutflowType,
  reason: string,
  user: SessionUser,
): Promise<void> {
  assertMilli(qtyMilli);
  const motivo = reason.trim();
  if (!motivo) throw new IngredientError("Informe o motivo.");
  if (motivo.length > 200) throw new IngredientError("Motivo muito longo.");
  await db.transaction(async (tx) => {
    const row = await lockIngredient(ingredientId, tx);
    await tx
      .update(ingredients)
      .set({ stockMilli: sql`${ingredients.stockMilli} - ${qtyMilli}` })
      .where(eq(ingredients.id, ingredientId));
    await tx.insert(ingredientMovements).values({
      ingredientId, type, qtyMilli: -qtyMilli, costCents: costOf(qtyMilli, row.avgCostCentsPerBase), reason: motivo, userId: user.id,
    });
  });
}

/** Contagem da prateleira: a dona informa quanto tem e o sistema lança a diferença. */
export async function recordCount(ingredientId: string, countedMilli: number, user: SessionUser): Promise<void> {
  assertRole(user, "ADMIN");
  if (!Number.isInteger(countedMilli) || countedMilli < 0 || countedMilli > MAX_MILLI) {
    throw new IngredientError("Informe a quantidade contada.");
  }
  await db.transaction(async (tx) => {
    const row = await lockIngredient(ingredientId, tx);
    const delta = countedMilli - row.stockMilli;
    if (delta === 0) throw new IngredientError("A contagem é igual ao estoque do sistema; nada a corrigir.");
    await tx.update(ingredients).set({ stockMilli: countedMilli }).where(eq(ingredients.id, ingredientId));
    await tx.insert(ingredientMovements).values({
      ingredientId, type: "COUNT", qtyMilli: delta, costCents: costOf(delta, row.avgCostCentsPerBase),
      reason: "Contagem de estoque", userId: user.id,
    });
  });
}

export async function setMinimum(ingredientId: string, minMilli: number, user: SessionUser): Promise<void> {
  assertRole(user, "ADMIN");
  if (!Number.isInteger(minMilli) || minMilli < 0 || minMilli > MAX_MILLI) throw new IngredientError("Mínimo inválido.");
  const updated = await db.update(ingredients).set({ minMilli }).where(eq(ingredients.id, ingredientId)).returning({ id: ingredients.id });
  if (updated.length === 0) throw new IngredientError("Insumo não encontrado.");
}

export function statusOf(row: { stockMilli: number; minMilli: number }): StockStatus {
  if (row.stockMilli < 0) return "NEGATIVE";
  if (row.minMilli > 0 && row.stockMilli <= row.minMilli) return "LOW";
  return "OK";
}

/** Insumos ativos no mínimo ou abaixo, com os negativos primeiro e depois os mais apertados. */
export async function lowStockAlerts(): Promise<{ id: string; name: string; baseUnit: BaseUnit; stockMilli: number; minMilli: number; status: StockStatus }[]> {
  const rows = await db
    .select({ id: ingredients.id, name: ingredients.name, baseUnit: ingredients.baseUnit, stockMilli: ingredients.stockMilli, minMilli: ingredients.minMilli })
    .from(ingredients)
    .where(and(eq(ingredients.active, true), sql`(${ingredients.stockMilli} < 0 OR (${ingredients.minMilli} > 0 AND ${ingredients.stockMilli} <= ${ingredients.minMilli}))`));
  const ratio = (r: { stockMilli: number; minMilli: number }) => (r.stockMilli < 0 ? -Infinity : r.stockMilli / r.minMilli);
  return rows
    .map((r) => ({ ...r, status: statusOf(r) }))
    .sort((a, b) => ratio(a) - ratio(b) || a.name.localeCompare(b.name, "pt-BR"));
}

export const MIN_WINDOW_DAYS = 30;
export const MIN_COVER_DAYS = 7;

/** Sugestão de mínimo: consumo médio por dia nos últimos 30 dias vezes 7 dias de cobertura. */
export async function suggestMinimum(ingredientId: string, now = new Date()) {
  const row = await getIngredient(ingredientId);
  const since = new Date(now.getTime() - MIN_WINDOW_DAYS * 24 * 3600 * 1000);
  const [r] = await db
    .select({ total: sql<string>`coalesce(sum(-${ingredientMovements.qtyMilli}), 0)` })
    .from(ingredientMovements)
    .where(
      and(
        eq(ingredientMovements.ingredientId, ingredientId),
        inArray(ingredientMovements.type, ["PRODUCTION", "LOSS", "CONSUMPTION"]),
        lt(ingredientMovements.qtyMilli, 0),
        gte(ingredientMovements.createdAt, since),
      ),
    );
  const consumedMilli = Number(r.total);
  const suggestedMilli = Math.ceil((consumedMilli / MIN_WINDOW_DAYS) * MIN_COVER_DAYS);
  const explanation =
    consumedMilli === 0
      ? `Ainda não houve saída nos últimos ${MIN_WINDOW_DAYS} dias. Defina o mínimo pelo que você usa em uma semana.`
      : `Nos últimos ${MIN_WINDOW_DAYS} dias saíram ${formatQty(consumedMilli, row.baseUnit)}, cerca de ${formatQty(Math.round(consumedMilli / MIN_WINDOW_DAYS), row.baseUnit)} por dia. Para ${MIN_COVER_DAYS} dias de folga até a próxima compra, o mínimo fica em ${formatQty(suggestedMilli, row.baseUnit)}.`;
  return { consumedMilli, windowDays: MIN_WINDOW_DAYS, coverDays: MIN_COVER_DAYS, suggestedMilli, explanation };
}

type StaffIngredient = {
  id: string; name: string; baseUnit: BaseUnit; packageName: string | null; packageSizeMilli: number | null;
  stockMilli: number; minMilli: number; active: boolean; status: StockStatus;
};
export type AdminIngredient = StaffIngredient & { avgCostCentsPerBase: number | null; stockValueCents: number | null };

/** Lista para o painel. Funcionária recebe objetos sem nenhum campo de dinheiro. */
export async function listIngredients(user: SessionUser): Promise<StaffIngredient[] | AdminIngredient[]> {
  const rows = await db.select().from(ingredients).orderBy(desc(ingredients.active), asc(ingredients.name));
  const base = (r: IngredientRow): StaffIngredient => ({
    id: r.id, name: r.name, baseUnit: r.baseUnit, packageName: r.packageName, packageSizeMilli: r.packageSizeMilli,
    stockMilli: r.stockMilli, minMilli: r.minMilli, active: r.active, status: statusOf(r),
  });
  if (user.role !== "ADMIN") return rows.map(base);
  return rows.map((r) => ({
    ...base(r),
    avgCostCentsPerBase: r.avgCostCentsPerBase,
    stockValueCents: r.stockMilli > 0 ? costOf(r.stockMilli, r.avgCostCentsPerBase) : 0,
  }));
}

export type MovementView = {
  id: string; type: string; qtyMilli: number; reason: string | null; userName: string | null; createdAt: Date; costCents?: number | null;
};

/** Últimos movimentos de um insumo; o custo só vai para a dona. */
export async function listMovements(ingredientId: string, user: SessionUser, limit = 30): Promise<MovementView[]> {
  const rows = await db
    .select({
      id: ingredientMovements.id, type: ingredientMovements.type, qtyMilli: ingredientMovements.qtyMilli,
      reason: ingredientMovements.reason, createdAt: ingredientMovements.createdAt, costCents: ingredientMovements.costCents,
      userName: schema.users.name,
    })
    .from(ingredientMovements)
    .leftJoin(schema.users, eq(schema.users.id, ingredientMovements.userId))
    .where(eq(ingredientMovements.ingredientId, ingredientId))
    .orderBy(desc(ingredientMovements.createdAt))
    .limit(limit);
  return rows.map(({ costCents, ...r }) => (user.role === "ADMIN" ? { ...r, costCents } : r));
}
