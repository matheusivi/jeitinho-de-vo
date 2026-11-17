"use server";

import { createOrder, type CreateOrderInput, type CreateOrderResult } from "@/lib/orders/create";
import { clientIp } from "@/lib/http";
import { getFreshProducts } from "@/lib/store/menu";
import type { FreshProduct } from "@/lib/store/bag";

export async function refreshBagAction(ids: string[]): Promise<FreshProduct[]> {
  if (!Array.isArray(ids)) return [];
  return getFreshProducts(ids.filter((i) => typeof i === "string").slice(0, 30));
}

export async function placeOrderAction(input: CreateOrderInput): Promise<CreateOrderResult> {
  return createOrder(input, { now: new Date(), ip: await clientIp() });
}
