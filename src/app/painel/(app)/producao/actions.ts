"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guard";
import { adjust, produce, StockError } from "@/lib/stock/stock";

export type StockState = { error?: string; ok?: string };

function done(): void {
  revalidatePath("/painel/producao");
  revalidatePath("/");
}

export async function produceAction(_p: StockState, form: FormData): Promise<StockState> {
  const user = await requireUser();
  const quantity = Number(String(form.get("quantity") ?? "").trim());
  try {
    await produce(String(form.get("productId") ?? ""), quantity, user.id);
  } catch (e) {
    if (e instanceof StockError) return { error: "Informe uma quantidade inteira maior que zero." };
    throw e;
  }
  done();
  return { ok: `+${quantity} lançado` };
}

export async function adjustAction(_p: StockState, form: FormData): Promise<StockState> {
  const user = await requireUser();
  const amount = Number(String(form.get("quantity") ?? "").trim());
  const delta = form.get("direction") === "add" ? amount : -amount;
  try {
    await adjust(String(form.get("productId") ?? ""), delta, String(form.get("reason") ?? ""), user.id);
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
  done();
  return { ok: "Ajuste registrado." };
}
