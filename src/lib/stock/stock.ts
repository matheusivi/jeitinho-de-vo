import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema, type DbOrTx } from "@/lib/db";

const { products, stockMovements, orderItems } = schema;
const MAX_QTY = 100_000;

export class StockError extends Error {
  constructor(
    public code: "ESGOTADO" | "INSUFICIENTE" | "INVALIDO",
    public productId?: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "StockError";
  }
}

export function available(p: { stockOnHand: number; stockReserved: number }): number {
  return p.stockOnHand - p.stockReserved;
}

function assertQuantity(q: number): void {
  if (!Number.isInteger(q) || q < 1 || q > MAX_QTY) {
    throw new StockError("INVALIDO", undefined, "Quantidade inválida.");
  }
}

/** Lança a produção: soma no estoque do produto pronto. */
export async function produce(productId: string, quantity: number, userId: string, tx: DbOrTx = db): Promise<void> {
  assertQuantity(quantity);
  const updated = await tx
    .update(products)
    .set({ stockOnHand: sql`${products.stockOnHand} + ${quantity}` })
    .where(eq(products.id, productId))
    .returning({ id: products.id });
  if (updated.length === 0) throw new StockError("INVALIDO", productId, "Produto não encontrado.");
  await tx.insert(stockMovements).values({ productId, type: "PRODUCTION", quantity, userId });
}

/** Ajuste manual (perda, consumo, correção). Nunca deixa o estoque abaixo do que já está reservado. */
export async function adjust(
  productId: string,
  delta: number,
  reason: string,
  userId: string,
  tx: DbOrTx = db,
): Promise<void> {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_QTY) {
    throw new StockError("INVALIDO", productId, "Quantidade inválida.");
  }
  const motivo = reason.trim();
  if (!motivo) throw new StockError("INVALIDO", productId, "Informe o motivo do ajuste.");
  const updated = await tx
    .update(products)
    .set({ stockOnHand: sql`${products.stockOnHand} + ${delta}` })
    .where(and(eq(products.id, productId), gte(sql`${products.stockOnHand} + ${delta}`, products.stockReserved)))
    .returning({ id: products.id });
  if (updated.length === 0) {
    throw new StockError("INSUFICIENTE", productId, "Não há estoque livre suficiente para este ajuste.");
  }
  await tx.insert(stockMovements).values({ productId, type: "ADJUSTMENT", quantity: delta, reason: motivo, userId });
}

/**
 * Reserva os itens de um pedido. Deve rodar dentro de uma transação: se um item falhar,
 * o erro desfaz as reservas anteriores. O UPDATE condicional é atômico, então duas
 * compras simultâneas da última unidade não passam as duas.
 */
export async function reserve(items: { productId: string; quantity: number }[], tx: DbOrTx): Promise<void> {
  const totals = new Map<string, number>();
  for (const it of items) {
    assertQuantity(it.quantity);
    totals.set(it.productId, (totals.get(it.productId) ?? 0) + it.quantity);
  }
  // ordem fixa evita deadlock entre pedidos com os mesmos produtos
  for (const [productId, quantity] of [...totals].sort(([a], [b]) => a.localeCompare(b))) {
    const updated = await tx
      .update(products)
      .set({ stockReserved: sql`${products.stockReserved} + ${quantity}` })
      .where(
        and(
          eq(products.id, productId),
          eq(products.active, true),
          gte(sql`${products.stockOnHand} - ${products.stockReserved}`, quantity),
        ),
      )
      .returning({ id: products.id });
    if (updated.length === 0) throw new StockError("ESGOTADO", productId, "Este produto acabou de esgotar.");
  }
}

/** Efetiva a venda de um pedido já reservado: sai do estoque e da reserva. */
export async function commitSale(orderId: string, tx: DbOrTx): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    await tx
      .update(products)
      .set({
        stockOnHand: sql`${products.stockOnHand} - ${it.quantity}`,
        stockReserved: sql`${products.stockReserved} - ${it.quantity}`,
      })
      .where(eq(products.id, it.productId));
    await tx.insert(stockMovements).values({ productId: it.productId, type: "SALE", quantity: -it.quantity, orderId });
  }
}

/** Devolve ao estoque os itens de um pedido cancelado. Só devolve uma vez por pedido. */
export async function releaseForCancel(orderId: string, userId: string | null, tx: DbOrTx): Promise<void> {
  const movements = await tx.select().from(stockMovements).where(eq(stockMovements.orderId, orderId));
  if (movements.some((m) => m.type === "CANCEL_RETURN")) {
    throw new StockError("INVALIDO", undefined, "O estoque deste pedido já foi devolvido.");
  }
  const sold = movements.some((m) => m.type === "SALE");
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    if (sold) {
      await tx
        .update(products)
        .set({ stockOnHand: sql`${products.stockOnHand} + ${it.quantity}` })
        .where(eq(products.id, it.productId));
      await tx
        .insert(stockMovements)
        .values({ productId: it.productId, type: "CANCEL_RETURN", quantity: it.quantity, orderId, userId });
    } else {
      await tx
        .update(products)
        .set({ stockReserved: sql`${products.stockReserved} - ${it.quantity}` })
        .where(eq(products.id, it.productId));
    }
  }
}
