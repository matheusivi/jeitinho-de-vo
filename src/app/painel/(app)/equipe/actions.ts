"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { createUser, setUserActive } from "@/lib/auth/users";

export type TeamState = { error?: string; ok?: string };

export async function createStaffAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  await requireRole("ADMIN");
  const result = await createUser({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    role: "STAFF",
  });
  if (!result.ok) return { error: result.message };
  revalidatePath("/painel/equipe");
  return { ok: "Conta criada. Passe o e-mail e a senha para a pessoa." };
}

export async function setActiveAction(form: FormData): Promise<void> {
  const me = await requireRole("ADMIN");
  const id = String(form.get("id") ?? "");
  if (id === me.id) return; // ninguém desativa a própria conta
  await setUserActive(id, form.get("active") === "true");
  revalidatePath("/painel/equipe");
}
