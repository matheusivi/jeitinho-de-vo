import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/types";
import { lockOpenTable, TableError } from "./tables";

/** Divide o total em partes iguais; os centavos que sobram vão para as primeiras partes. */
export function splitEqual(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1 || parts > 50) throw new TableError("Divida entre 1 e 50 pessoas.");
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new TableError("Total inválido.");
  const base = Math.floor(totalCents / parts);
  const extra = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

const input = z.union([
  z.object({ tender: z.enum(["CASH", "PIX", "CARD"]), amountCents: z.number().int(), itemIds: z.undefined().optional() }),
  z.object({ tender: z.enum(["CASH", "PIX", "CARD"]), itemIds: z.array(z.string().min(1).max(64)).min(1).max(100), amountCents: z.undefined().optional() }),
]);
export type PayInput = { tender: "CASH" | "PIX" | "CARD"; amountCents?: number; itemIds?: string[] };

/**
 * Registra um pagamento da mesa: um valor (conta inteira ou parte igual) ou os itens de uma pessoa.
 * Não aceita mais do que falta. Quando zera, a mesa fecha e o total entra como recebido no dia.
 */
export async function payTable(orderId: string, data: PayInput, user: SessionUser): Promise<{ closed: boolean; remainingCents: number }> {
  const parsed = input.safeParse(data);
  if (!parsed.success) throw new TableError("Pagamento inválido.");
  const p = parsed.data;
  return db.transaction(async (tx) => {
    const order = await lockOpenTable(orderId, tx);
    if (order.totalCents <= 0) throw new TableError("A mesa não tem itens para pagar.");
    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${schema.orderPayments.amountCents}), 0)::int` })
      .from(schema.orderPayments)
      .where(eq(schema.orderPayments.orderId, orderId));
    const remaining = order.totalCents - paid;

    let amount: number;
    let itemIds: string[] = [];
    if (p.itemIds) {
      itemIds = [...new Set(p.itemIds)];
      const items = await tx
        .select()
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.orderId, orderId), inArray(schema.orderItems.id, itemIds)));
      if (items.length !== itemIds.length) throw new TableError("Um dos itens não é desta mesa.");
      const already = await tx
        .select({ id: schema.orderPaymentItems.orderItemId })
        .from(schema.orderPaymentItems)
        .where(inArray(schema.orderPaymentItems.orderItemId, itemIds));
      if (already.length) throw new TableError("Um dos itens já foi pago.");
      amount = items.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0);
    } else {
      amount = p.amountCents!;
    }
    if (amount <= 0) throw new TableError("Informe um valor maior que zero.");
    if (amount > remaining) {
      throw new TableError(`O valor passa do que falta (R$ ${(remaining / 100).toFixed(2).replace(".", ",")}).`);
    }

    const [pay] = await tx
      .insert(schema.orderPayments)
      .values({ orderId, tender: p.tender, amountCents: amount, receivedBy: user.id })
      .returning({ id: schema.orderPayments.id });
    if (itemIds.length) await tx.insert(schema.orderPaymentItems).values(itemIds.map((orderItemId) => ({ paymentId: pay.id, orderItemId })));

    const left = remaining - amount;
    if (left === 0) {
      const now = new Date();
      await tx
        .update(schema.orders)
        .set({ status: "DONE", paymentStatus: "RECEIVED", receivedCents: order.totalCents, receivedAt: now, closedBy: user.id, closedAt: now })
        .where(eq(schema.orders.id, orderId));
    }
    return { closed: left === 0, remainingCents: left };
  });
}
