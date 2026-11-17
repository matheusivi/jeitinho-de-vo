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

/** Exige alguém logado; sem sessão, manda para a tela de login. */
export async function requireUser(): Promise<SessionUser> {
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
