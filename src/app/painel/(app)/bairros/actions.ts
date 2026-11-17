"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { parseBRL } from "@/lib/money";
import { saveNeighborhood } from "@/lib/orders/fees";

export type NbState = { error?: string; ok?: string };

export async function saveNeighborhoodAction(_p: NbState, form: FormData): Promise<NbState> {
  await requireRole("ADMIN");
  const fee = parseBRL(String(form.get("fee") ?? ""));
  if (fee === null) return { error: "Taxa inválida. Use o formato 7,00." };
  const r = await saveNeighborhood({
    id: String(form.get("id") ?? "") || undefined,
    name: String(form.get("name") ?? ""),
    feeCents: fee,
    active: form.get("id") ? form.get("active") === "on" : true,
  });
  if (!r.ok) return { error: r.message };
  revalidatePath("/painel/bairros");
  return { ok: "Salvo." };
}
