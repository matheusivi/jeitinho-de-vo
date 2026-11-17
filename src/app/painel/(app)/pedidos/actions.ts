"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth/guard";
import { parseBRL } from "@/lib/money";
import { advanceOrder, cancelOrder, markReceived, TransitionError, type OrderStatus } from "@/lib/orders/transitions";

export type PanelActionResult = { error?: string };

const STATUSES = new Set<OrderStatus>(["PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DONE"]);

async function run(fn: () => Promise<void>): Promise<PanelActionResult> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TransitionError) return { error: e.message };
    throw e;
  }
  revalidatePath("/painel/pedidos");
  revalidatePath("/painel/producao");
  revalidatePath("/");
  return {};
}

export async function advanceAction(orderId: string, to: string): Promise<PanelActionResult> {
  const user = await requireUser();
  if (!STATUSES.has(to as OrderStatus)) return { error: "Passo inválido." };
  return run(() => advanceOrder(orderId, to as OrderStatus, user));
}

export async function cancelAction(orderId: string): Promise<PanelActionResult> {
  const user = await requireUser();
  return run(() => cancelOrder(orderId, user));
}

export async function receivedAction(orderId: string, amount: string): Promise<PanelActionResult> {
  const user = await requireRole("ADMIN");
  const cents = parseBRL(amount);
  if (cents === null) return { error: "Valor inválido. Use o formato 43,00." };
  return run(() => markReceived(orderId, cents, user));
}
