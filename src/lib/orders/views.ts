import { and, desc, eq, gte, inArray, lt, notInArray, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/types";
import { localDayRange } from "@/lib/store/hours";
import type { OrderStatus } from "./transitions";

type Base = {
  id: string;
  code: string;
  status: OrderStatus;
  fulfillment: "DELIVERY" | "PICKUP";
  customerName: string;
  customerPhone: string;
  addressLine: string | null;
  neighborhoodName: string | null;
  notes: string | null;
  createdAt: Date;
  items: { name: string; quantity: number }[];
};
export type StaffOrder = Base;
export type AdminOrder = Base & {
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentStatus: "PENDING" | "RECEIVED";
  receivedCents: number | null;
};
export type PanelOrder = StaffOrder | AdminOrder;

/**
 * Pedidos do dia para o painel, mais os de dias anteriores que ainda pedem ação: em andamento
 * (todos veem) ou, para a dona, concluídos sem o recebimento registrado.
 * Para funcionário, o objeto devolvido não tem nenhum campo de dinheiro, então nada disso chega à tela.
 */
export async function listOrdersForPanel(user: SessionUser, filter: { day: Date }): Promise<PanelOrder[]> {
  const { start, end } = localDayRange(filter.day);
  const rows = await db
    .select({ order: schema.orders, neighborhoodName: schema.neighborhoods.name })
    .from(schema.orders)
    .leftJoin(schema.neighborhoods, eq(schema.neighborhoods.id, schema.orders.neighborhoodId))
    .where(
      or(
        and(gte(schema.orders.createdAt, start), lt(schema.orders.createdAt, end)),
        and(lt(schema.orders.createdAt, start), notInArray(schema.orders.status, ["DONE", "CANCELED"])),
        user.role === "ADMIN"
          ? and(lt(schema.orders.createdAt, start), eq(schema.orders.status, "DONE"), eq(schema.orders.paymentStatus, "PENDING"))
          : undefined,
      ),
    )
    .orderBy(desc(schema.orders.createdAt));
  if (rows.length === 0) return [];

  const items = await db
    .select({ orderId: schema.orderItems.orderId, name: schema.orderItems.productName, quantity: schema.orderItems.quantity })
    .from(schema.orderItems)
    .where(inArray(schema.orderItems.orderId, rows.map((r) => r.order.id)));

  return rows.map(({ order: o, neighborhoodName }) => {
    const base: Base = {
      id: o.id,
      code: o.code,
      status: o.status,
      fulfillment: o.fulfillment,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      addressLine: o.addressLine,
      neighborhoodName,
      notes: o.notes,
      createdAt: o.createdAt,
      items: items.filter((i) => i.orderId === o.id).map(({ name, quantity }) => ({ name, quantity })),
    };
    if (user.role !== "ADMIN") return base;
    return {
      ...base,
      subtotalCents: o.subtotalCents,
      deliveryFeeCents: o.deliveryFeeCents,
      totalCents: o.totalCents,
      paymentStatus: o.paymentStatus,
      receivedCents: o.receivedCents,
    };
  });
}

const MESSAGES: Partial<Record<OrderStatus, (n: string, c: string) => string>> = {
  CONFIRMED: (n, c) => `Oi, ${n}! Recebemos seu pedido ${c} na Jeitinho de Vó.`,
  PREPARING: (n, c) => `Oi, ${n}! Seu pedido ${c} já está sendo preparado.`,
  OUT_FOR_DELIVERY: (n, c) => `Oi, ${n}! Seu pedido ${c} saiu para entrega e chega já já.`,
  READY_FOR_PICKUP: (n, c) => `Oi, ${n}! Seu pedido ${c} está pronto para retirar na loja.`,
  DONE: (n, c) => `Oi, ${n}! Obrigada pelo pedido ${c}. Bom apetite!`,
};

export function whatsappStatusLink(o: { customerPhone: string; code: string; status: OrderStatus; customerName: string }): string {
  const digits = o.customerPhone.replace(/\D/g, "");
  const phone = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  const first = o.customerName.trim().split(/\s+/)[0];
  const text = (MESSAGES[o.status] ?? MESSAGES.CONFIRMED!)(first, o.code);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
