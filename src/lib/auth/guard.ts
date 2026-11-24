import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE } from "./session";
import { assertRole, ForbiddenError, type SessionUser } from "./types";

export { assertRole, ForbiddenError };
export type { SessionUser };

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
}

/** Rota da tela onde se configura o código no celular. */
export const MFA_SETUP_PATH = "/painel/seguranca";

/** Administradora precisa do código no celular ativo para usar o painel. */
export function needsMfaSetup(user: SessionUser): boolean {
  return user.role === "ADMIN" && !user.mfaEnabled;
}

/**
 * Exige alguém logado; sem sessão, manda para a tela de login. Administradora sem código ativo
 * vai para a configuração: o redirecionamento também interrompe Server Actions.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/painel/login");
  if (needsMfaSetup(user)) redirect(MFA_SETUP_PATH);
  return user;
}

/** Só para a tela de configuração do código: aceita a administradora que ainda não ativou. */
export async function requireUserForSetup(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/painel/login");
  return user;
}

/**
 * Exige o papel informado. Papel insuficiente vai para a página de sem acesso; o redirecionamento
 * também interrompe Server Actions, então nada do que vem depois roda.
 */
export async function requireRole(role: "ADMIN"): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) redirect("/painel/sem-acesso");
  return user;
}
