import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export type PublicOrder = {
  code: string;
  status: (typeof schema.orderStatusEnum.enumValues)[number];
  fulfillment: "DELIVERY" | "PICKUP";
  firstName: string;
  neighborhoodName: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  createdAt: Date;
  items: { name: string; quantity: number; unitPriceCents: number }[];
};

/** O que a cliente pode ver do próprio pedido pelo código. Sem telefone e sem endereço. */
export async function getPublicOrder(rawCode: string): Promise<PublicOrder | null> {
  const code = rawCode.trim().toUpperCase();
  if (!CODE.test(code)) return null;
  const [o] = await db
    .select({ order: schema.orders, neighborhoodName: schema.neighborhoods.name })
    .from(schema.orders)
    .leftJoin(schema.neighborhoods, eq(schema.neighborhoods.id, schema.orders.neighborhoodId))
    .where(eq(schema.orders.code, code));
  if (!o) return null;
  const items = await db
    .select({ name: schema.orderItems.productName, quantity: schema.orderItems.quantity, unitPriceCents: schema.orderItems.unitPriceCents })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, o.order.id));
  return {
    code: o.order.code,
    status: o.order.status,
    fulfillment: o.order.fulfillment,
    firstName: o.order.customerName.split(/\s+/)[0],
    neighborhoodName: o.neighborhoodName,
    subtotalCents: o.order.subtotalCents,
    deliveryFeeCents: o.order.deliveryFeeCents,
    totalCents: o.order.totalCents,
    createdAt: o.order.createdAt,
    items,
  };
}
