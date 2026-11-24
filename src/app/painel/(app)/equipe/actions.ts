"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { changeUserActive, createTeamMember, TeamError } from "@/lib/auth/users";
import { MfaError, resetMfaFor } from "@/lib/auth/mfa";

export type TeamState = { error?: string; ok?: string };

export async function createStaffAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const me = await requireRole("ADMIN");
  const role = form.get("role") === "ADMIN" ? "ADMIN" : "STAFF";
  const result = await createTeamMember(
    {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      role,
    },
    me,
  );
  if (!result.ok) return { error: result.message };
  revalidatePath("/painel/equipe");
  return {
    ok: role === "ADMIN"
      ? "Administradora criada. No primeiro acesso ela vai configurar o código no celular."
      : "Conta criada. Passe o e-mail e a senha para a pessoa.",
  };
}

export async function setActiveAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const me = await requireRole("ADMIN");
  try {
    await changeUserActive(String(form.get("id") ?? ""), form.get("active") === "true", me);
  } catch (e) {
    if (e instanceof TeamError) return { error: e.message };
    throw e;
  }
  revalidatePath("/painel/equipe");
  return {};
}

export async function resetMfaAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const me = await requireRole("ADMIN");
  try {
    await resetMfaFor(String(form.get("id") ?? ""), me);
  } catch (e) {
    if (e instanceof MfaError) return { error: e.message };
    throw e;
  }
  revalidatePath("/painel/equipe");
  return { ok: "Código zerado. Ela entra só com a senha e pode configurar de novo em Segurança." };
}
