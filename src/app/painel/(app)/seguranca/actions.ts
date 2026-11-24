"use server";

import { revalidatePath } from "next/cache";
import { requireUserForSetup } from "@/lib/auth/guard";
import { confirmEnrollment, disableMfa, MfaError, regenerateRecoveryCodes } from "@/lib/auth/mfa";

export type MfaState = { error?: string; codes?: string[]; ok?: string };

const code = (form: FormData) => String(form.get("code") ?? "");

/**
 * Ativar e gerar códigos não revalidam a página: a tela trocaria para o estado "ativo" e os
 * códigos de recuperação, que só existem na resposta, sumiriam antes de a pessoa ver.
 */
async function run(fn: () => Promise<MfaState>, revalidate = false): Promise<MfaState> {
  try {
    const r = await fn();
    if (revalidate) revalidatePath("/painel", "layout");
    return r;
  } catch (e) {
    if (e instanceof MfaError) return { error: e.message };
    throw e;
  }
}

export async function confirmAction(_p: MfaState, form: FormData): Promise<MfaState> {
  const user = await requireUserForSetup();
  return run(async () => ({ codes: await confirmEnrollment(user, code(form)) }));
}

export async function regenerateAction(_p: MfaState, form: FormData): Promise<MfaState> {
  const user = await requireUserForSetup();
  return run(async () => ({ codes: await regenerateRecoveryCodes(user, code(form)) }));
}

export async function disableAction(_p: MfaState, form: FormData): Promise<MfaState> {
  const user = await requireUserForSetup();
  return run(async () => {
    await disableMfa(user, code(form));
    return { ok: "Código no celular desativado. Você volta a entrar só com a senha." };
  }, true);
}
