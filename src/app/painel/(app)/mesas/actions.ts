"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireUser } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/auth/types";
import { parseBRL } from "@/lib/money";
import { addItems, cancelTable, openTable, removeItem, setTableCount, TableError } from "@/lib/tables/tables";
import { payTable, type PayInput } from "@/lib/tables/payments";

export type MesaResult = { error?: string; closed?: boolean; remainingCents?: number };

async function run(fn: () => Promise<MesaResult | void>): Promise<MesaResult> {
  let r: MesaResult | void;
  try {
    r = await fn();
  } catch (e) {
    if (e instanceof TableError) return { error: e.message };
    if (e instanceof ForbiddenError) return { error: "Só a administradora pode fazer isso." };
    throw e;
  }
  revalidatePath("/painel/mesas", "layout");
  revalidatePath("/painel/producao");
  revalidatePath("/");
  return r ?? {};
}

export async function openTableAction(number: number): Promise<MesaResult> {
  const user = await requireUser();
  const r = await run(() => openTable(number, user).then(() => undefined));
  if (r.error) return r;
  redirect(`/painel/mesas/${number}`);
}

export async function addItemsAction(orderId: string, items: { productId: string; quantity: number; note?: string }[]): Promise<MesaResult> {
  const user = await requireUser();
  return run(() => addItems(orderId, items, user));
}

export async function removeItemAction(itemId: string, reason: string): Promise<MesaResult> {
  const user = await requireUser();
  return run(() => removeItem(itemId, reason, user));
}

export async function payAction(
  orderId: string,
  data: { tender: PayInput["tender"]; amount?: string; itemIds?: string[] },
): Promise<MesaResult> {
  const user = await requireUser();
  let input: PayInput;
  if (data.itemIds?.length) {
    input = { tender: data.tender, itemIds: data.itemIds };
  } else {
    const cents = parseBRL(data.amount ?? "");
    if (cents === null) return { error: "Valor inválido. Use o formato 43,00." };
    input = { tender: data.tender, amountCents: cents };
  }
  return run(() => payTable(orderId, input, user));
}

export async function cancelTableAction(orderId: string): Promise<MesaResult> {
  const user = await requireUser();
  const r = await run(() => cancelTable(orderId, user));
  if (r.error) return r;
  redirect("/painel/mesas");
}

export async function setTableCountAction(_prev: MesaResult, form: FormData): Promise<MesaResult> {
  const user = await requireRole("ADMIN");
  const n = Number(form.get("count"));
  return run(() => setTableCount(n, user));
}
