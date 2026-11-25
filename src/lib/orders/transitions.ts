import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole, type SessionUser } from "@/lib/auth/types";
import { releaseForCancel } from "@/lib/stock/stock";

export type OrderStatus = (typeof schema.orderStatusEnum.enumValues)[number];

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

const NEXT: Record<"DELIVERY" | "PICKUP", Partial<Record<OrderStatus, OrderStatus>>> = {
  DELIVERY: { CONFIRMED: "PREPARING", PREPARING: "OUT_FOR_DELIVERY", OUT_FOR_DELIVERY: "DONE" },
  PICKUP: { CONFIRMED: "PREPARING", PREPARING: "READY_FOR_PICKUP", READY_FOR_PICKUP: "DONE" },
};

export function nextStatus(fulfillment: "DELIVERY" | "PICKUP", status: OrderStatus): OrderStatus | null {
  return NEXT[fulfillment][status] ?? null;
}

/** Leva o pedido ao próximo estado. Só aceita o passo seguinte do fluxo do pedido. */
export async function advanceOrder(orderId: string, to: OrderStatus, _user: SessionUser): Promise<void> {
  void _user; // dona e funcionário podem avançar; o login já foi exigido pela tela
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!o) throw new TransitionError("Pedido não encontrado.");
  if (o.fulfillment === "TABLE") throw new TransitionError("Pedido de mesa se fecha na tela Mesas.");
  if (nextStatus(o.fulfillment, o.status) !== to) throw new TransitionError("Este pedido não pode ir para esse passo agora.");
  const updated = await db
    .update(schema.orders)
    .set({ status: to })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, o.status)))
    .returning({ id: schema.orders.id });
  if (updated.length === 0) throw new TransitionError("O pedido mudou enquanto você mexia. Atualize a tela.");
}

/** Cancela o pedido e devolve o estoque. Trava a linha para que dois cliques não devolvam em dobro. */
export async function cancelOrder(orderId: string, user: SessionUser): Promise<void> {
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!o) throw new TransitionError("Pedido não encontrado.");
    if (o.fulfillment === "TABLE") throw new TransitionError("Pedido de mesa se cancela na tela Mesas.");
    if (o.status === "CANCELED") throw new TransitionError("Este pedido já foi cancelado.");
    if (o.status === "DONE") throw new TransitionError("Pedido concluído não pode ser cancelado.");
    await releaseForCancel(orderId, user.id, tx);
    await tx.update(schema.orders).set({ status: "CANCELED" }).where(eq(schema.orders.id, orderId));
  });
}

/** A administradora registra quanto recebeu no pagamento na entrega ou na retirada. */
export async function markReceived(orderId: string, receivedCents: number, user: SessionUser): Promise<void> {
  assertRole(user, "ADMIN");
  if (!Number.isInteger(receivedCents) || receivedCents < 0 || receivedCents > 10_000_000) {
    throw new TransitionError("Valor recebido inválido.");
  }
  const updated = await db
    .update(schema.orders)
    .set({ paymentStatus: "RECEIVED", receivedCents, receivedAt: new Date() })
    .where(
      and(
        eq(schema.orders.id, orderId),
        ne(schema.orders.fulfillment, "TABLE"),
        ne(schema.orders.status, "CANCELED"),
        eq(schema.orders.paymentStatus, "PENDING"),
      ),
    )
    .returning({ id: schema.orders.id });
  if (updated.length > 0) return;
  const [current] = await db
    .select({ status: schema.orders.status, paymentStatus: schema.orders.paymentStatus, fulfillment: schema.orders.fulfillment })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId));
  if (!current) throw new TransitionError("Pedido não encontrado.");
  if (current.fulfillment === "TABLE") throw new TransitionError("Pedido de mesa se recebe na tela Mesas.");
  if (current.status === "CANCELED") throw new TransitionError("Pedido cancelado não recebe pagamento.");
  throw new TransitionError("Este pedido já tem recebimento registrado.");
}
