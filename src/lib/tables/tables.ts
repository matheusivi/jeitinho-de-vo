import { randomInt } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/lib/db";
import { assertRole, ForbiddenError, type SessionUser } from "@/lib/auth/types";
import { unitCostsFor } from "@/lib/ingredients/costing";
import { enqueue } from "@/lib/printing/jobs";
import { returnItem, sellNow, StockError } from "@/lib/stock/stock";

export class TableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TableError";
  }
}

const MAX_TABLES = 50;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type TableSummary = {
  number: number;
  orderId: string | null;
  openedAt: Date | null;
  openedByName: string | null;
  totalCents: number;
  itemCount: number;
};

export type TableItem = {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  note: string | null;
  addedByName: string | null;
  addedAt: Date | null;
  paid: boolean;
};

export type TablePayment = { id: string; tender: "CASH" | "PIX" | "CARD"; amountCents: number; receivedByName: string; itemNames: string[]; createdAt: Date };

export type TableDetail = {
  orderId: string;
  number: number;
  code: string;
  openedAt: Date;
  openedByName: string | null;
  items: TableItem[];
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  payments: TablePayment[];
};

function newCode(): string {
  let c = "M";
  for (let i = 0; i < 5; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return c;
}

/** Mesas ativas, com a comanda aberta de cada uma. Também lista mesa desativada que ainda está ocupada. */
export async function listTables(_user: SessionUser): Promise<TableSummary[]> {
  void _user;
  const open = await db
    .select({ order: schema.orders, openedByName: schema.users.name })
    .from(schema.orders)
    .leftJoin(schema.users, eq(schema.users.id, schema.orders.openedBy))
    .where(and(isNotNull(schema.orders.tableNumber), eq(schema.orders.status, "CONFIRMED")));
  const counts = open.length
    ? await db
        .select({ orderId: schema.orderItems.orderId, n: sql<number>`sum(${schema.orderItems.quantity})::int` })
        .from(schema.orderItems)
        .where(inArray(schema.orderItems.orderId, open.map((o) => o.order.id)))
        .groupBy(schema.orderItems.orderId)
    : [];
  const tables = await db.select().from(schema.diningTables).orderBy(asc(schema.diningTables.number));
  const byNumber = new Map(open.map((o) => [o.order.tableNumber!, o]));
  return tables
    .filter((t) => t.active || byNumber.has(t.number))
    .map((t) => {
      const o = byNumber.get(t.number);
      return {
        number: t.number,
        orderId: o?.order.id ?? null,
        openedAt: o?.order.createdAt ?? null,
        openedByName: o?.openedByName ?? null,
        totalCents: o?.order.totalCents ?? 0,
        itemCount: counts.find((c) => c.orderId === o?.order.id)?.n ?? 0,
      };
    });
}

/** Abre a mesa. Se outra pessoa abriu ao mesmo tempo, devolve a comanda que ficou aberta. */
export async function openTable(number: number, user: SessionUser): Promise<{ orderId: string; created: boolean }> {
  if (!Number.isInteger(number)) throw new TableError("Mesa inválida.");
  const [t] = await db.select().from(schema.diningTables).where(eq(schema.diningTables.number, number));
  if (!t || !t.active) throw new TableError(`A mesa ${number} não existe.`);
  const existing = async () => {
    const [o] = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(and(eq(schema.orders.tableNumber, number), eq(schema.orders.status, "CONFIRMED")));
    return o?.id ?? null;
  };
  const already = await existing();
  if (already) return { orderId: already, created: false };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [o] = await db
        .insert(schema.orders)
        .values({
          code: newCode(), fulfillment: "TABLE", status: "CONFIRMED", customerName: `Mesa ${number}`, customerPhone: "",
          subtotalCents: 0, deliveryFeeCents: 0, totalCents: 0, paymentMethod: "IN_STORE", tableNumber: number, openedBy: user.id,
        })
        .returning({ id: schema.orders.id });
      return { orderId: o.id, created: true };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const winner = await existing();
      if (winner) return { orderId: winner, created: false };
      // colisão do código (raro): tenta outro
    }
  }
  throw new TableError("Não foi possível abrir a mesa. Tente de novo.");
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/** Trava a comanda da mesa e confere que ainda está aberta. */
export async function lockOpenTable(orderId: string, tx: DbOrTx) {
  const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
  if (!o || o.fulfillment !== "TABLE") throw new TableError("Mesa não encontrada.");
  if (o.status !== "CONFIRMED") throw new TableError("Esta mesa já foi fechada.");
  return o;
}

async function recalc(orderId: string, tx: DbOrTx): Promise<number> {
  const [r] = await tx
    .select({ total: sql<number>`coalesce(sum(${schema.orderItems.unitPriceCents} * ${schema.orderItems.quantity}), 0)::int` })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));
  await tx.update(schema.orders).set({ subtotalCents: r.total, totalCents: r.total }).where(eq(schema.orders.id, orderId));
  return r.total;
}

const itemsInput = z
  .array(
    z.object({
      productId: z.string().min(1).max(64),
      quantity: z.number().int().min(1).max(50),
      note: z.string().trim().max(120).optional(),
    }),
  )
  .min(1, "Escolha pelo menos um item.")
  .max(30, "Itens demais num lançamento.");

const time = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Campo_Grande" });

/** Lança itens na mesa: baixa o estoque, soma na conta e manda a comanda só com estes itens. Tudo ou nada. */
export async function addItems(
  orderId: string,
  input: { productId: string; quantity: number; note?: string }[],
  user: SessionUser,
): Promise<void> {
  const parsed = itemsInput.safeParse(input);
  if (!parsed.success) throw new TableError(parsed.error.issues[0].message);
  const items = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const order = await lockOpenTable(orderId, tx);
      const ids = [...new Set(items.map((i) => i.productId))];
      const products = (
        await tx
          .select({ product: schema.products })
          .from(schema.products)
          .innerJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
          .where(and(inArray(schema.products.id, ids), eq(schema.products.active, true), eq(schema.categories.active, true)))
      ).map((r) => r.product);
      if (products.length !== ids.length) throw new TableError("Um dos produtos não está mais à venda.");
      const byId = new Map(products.map((p) => [p.id, p]));
      await sellNow(items, orderId, user.id, tx);
      const costs = await unitCostsFor(ids, tx);
      const now = new Date();
      await tx.insert(schema.orderItems).values(
        items.map((i) => {
          const p = byId.get(i.productId)!;
          return {
            orderId, productId: p.id, productName: p.name, unitPriceCents: p.priceCents, unitCostCents: costs.get(p.id) ?? null,
            quantity: i.quantity, note: i.note || null, addedBy: user.id, addedAt: now,
          };
        }),
      );
      await recalc(orderId, tx);
      await enqueue("TABLE", orderId, {
        title: `MESA ${order.tableNumber}`,
        subtitle: `${user.name} · ${time(now)}`,
        lines: items.map((i) => ({ quantity: i.quantity, name: byId.get(i.productId)!.name, ...(i.note ? { note: i.note } : {}) })),
        createdAt: now.toISOString(),
      }, tx);
    });
  } catch (e) {
    if (e instanceof StockError) {
      const [p] = e.productId ? await db.select({ name: schema.products.name }).from(schema.products).where(eq(schema.products.id, e.productId)) : [];
      throw new TableError(`${p?.name ?? "Um produto"} acabou no estoque. Nada foi lançado.`);
    }
    throw e;
  }
}

async function paidItemIds(orderId: string, tx: DbOrTx): Promise<Set<string>> {
  const rows = await tx
    .select({ id: schema.orderPaymentItems.orderItemId })
    .from(schema.orderPaymentItems)
    .innerJoin(schema.orderPayments, eq(schema.orderPayments.id, schema.orderPaymentItems.paymentId))
    .where(eq(schema.orderPayments.orderId, orderId));
  return new Set(rows.map((r) => r.id));
}

/** Tira um item da mesa aberta: o estoque volta e a cozinha recebe o aviso. Exige motivo. */
export async function removeItem(orderItemId: string, reason: string, user: SessionUser): Promise<void> {
  const motivo = reason.trim().slice(0, 200);
  if (!motivo) throw new TableError("Informe o motivo para tirar o item.");
  await db.transaction(async (tx) => {
    const [item] = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.id, orderItemId));
    if (!item) throw new TableError("Item não encontrado.");
    const order = await lockOpenTable(item.orderId, tx);
    if ((await paidItemIds(item.orderId, tx)).has(item.id)) throw new TableError("Este item já foi pago e não pode sair da conta.");
    await tx.delete(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    await returnItem(item, item.orderId, user.id, motivo, tx);
    const total = await recalc(item.orderId, tx);
    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${schema.orderPayments.amountCents}), 0)::int` })
      .from(schema.orderPayments)
      .where(eq(schema.orderPayments.orderId, item.orderId));
    if (paid > total) throw new TableError("Já pagaram mais do que ficaria a conta. Tire o item antes de receber.");
    await enqueue("TABLE_REMOVAL", item.orderId, {
      title: `MESA ${order.tableNumber} · CANCELADO`,
      subtitle: `${user.name} · ${time(new Date())}`,
      lines: [{ quantity: item.quantity, name: item.productName }],
      footer: `Motivo: ${motivo}`,
      createdAt: new Date().toISOString(),
    }, tx);
  });
}

/** Cancela a mesa aberta por engano. Com itens, só a administradora, e o estoque volta. */
export async function cancelTable(orderId: string, user: SessionUser): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOpenTable(orderId, tx);
    const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    if (items.length > 0 && user.role !== "ADMIN") throw new ForbiddenError();
    const [pay] = await tx.select({ id: schema.orderPayments.id }).from(schema.orderPayments).where(eq(schema.orderPayments.orderId, orderId)).limit(1);
    if (pay) throw new TableError("A mesa já tem pagamento registrado; não pode ser cancelada.");
    for (const it of items) await returnItem(it, orderId, user.id, "mesa cancelada", tx);
    await tx.update(schema.orders).set({ status: "CANCELED", closedBy: user.id, closedAt: new Date() }).where(eq(schema.orders.id, orderId));
  });
}

/** Detalhe da mesa aberta, com preços (a equipe vê valores só aqui). */
export async function getTable(number: number, _user: SessionUser): Promise<TableDetail | null> {
  void _user;
  const [row] = await db
    .select({ order: schema.orders, openedByName: schema.users.name })
    .from(schema.orders)
    .leftJoin(schema.users, eq(schema.users.id, schema.orders.openedBy))
    .where(and(eq(schema.orders.tableNumber, number), eq(schema.orders.status, "CONFIRMED")));
  if (!row) return null;
  return tableDetail(row.order, row.openedByName);
}

async function tableDetail(order: typeof schema.orders.$inferSelect, openedByName: string | null): Promise<TableDetail> {
  const items = await db
    .select({ item: schema.orderItems, addedByName: schema.users.name })
    .from(schema.orderItems)
    .leftJoin(schema.users, eq(schema.users.id, schema.orderItems.addedBy))
    .where(eq(schema.orderItems.orderId, order.id))
    .orderBy(asc(schema.orderItems.addedAt), asc(schema.orderItems.productName));
  const payments = await db
    .select({ p: schema.orderPayments, by: schema.users.name })
    .from(schema.orderPayments)
    .innerJoin(schema.users, eq(schema.users.id, schema.orderPayments.receivedBy))
    .where(eq(schema.orderPayments.orderId, order.id))
    .orderBy(asc(schema.orderPayments.createdAt));
  const links = payments.length
    ? await db.select().from(schema.orderPaymentItems).where(inArray(schema.orderPaymentItems.paymentId, payments.map((p) => p.p.id)))
    : [];
  const paidSet = new Set(links.map((l) => l.orderItemId));
  const nameOf = new Map(items.map((i) => [i.item.id, i.item.productName]));
  const paidCents = payments.reduce((n, p) => n + p.p.amountCents, 0);
  return {
    orderId: order.id,
    number: order.tableNumber!,
    code: order.code,
    openedAt: order.createdAt,
    openedByName,
    items: items.map(({ item, addedByName }) => ({
      id: item.id, name: item.productName, quantity: item.quantity, unitPriceCents: item.unitPriceCents, note: item.note,
      addedByName, addedAt: item.addedAt, paid: paidSet.has(item.id),
    })),
    totalCents: order.totalCents,
    paidCents,
    remainingCents: order.totalCents - paidCents,
    payments: payments.map(({ p, by }) => ({
      id: p.id, tender: p.tender, amountCents: p.amountCents, receivedByName: by, createdAt: p.createdAt,
      itemNames: links.filter((l) => l.paymentId === p.id).map((l) => nameOf.get(l.orderItemId) ?? "item"),
    })),
  };
}

/** A dona define quantas mesas o salão tem. Mesa ocupada não sai até fechar. */
export async function setTableCount(count: number, user: SessionUser): Promise<void> {
  assertRole(user, "ADMIN");
  if (!Number.isInteger(count) || count < 1 || count > MAX_TABLES) throw new TableError(`Escolha de 1 a ${MAX_TABLES} mesas.`);
  await db.transaction(async (tx) => {
    const busy = await tx
      .select({ n: schema.orders.tableNumber })
      .from(schema.orders)
      .where(and(isNotNull(schema.orders.tableNumber), eq(schema.orders.status, "CONFIRMED"), sql`${schema.orders.tableNumber} > ${count}`));
    if (busy.length) {
      const nums = busy.map((b) => b.n).sort((a, b) => a! - b!).join(", ");
      throw new TableError(`Feche antes a mesa ${nums}.`);
    }
    for (let n = 1; n <= count; n++) {
      await tx.insert(schema.diningTables).values({ number: n, active: true }).onConflictDoUpdate({ target: schema.diningTables.number, set: { active: true } });
    }
    await tx.update(schema.diningTables).set({ active: false }).where(sql`${schema.diningTables.number} > ${count}`);
  });
}

export async function activeTableCount(): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.diningTables).where(eq(schema.diningTables.active, true));
  return r?.n ?? 0;
}

export { tableDetail as _tableDetail };
