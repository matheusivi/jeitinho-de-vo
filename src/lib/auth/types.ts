export type Role = "ADMIN" | "STAFF";
/** mfaEnabled: a pessoa tem o código no celular ativo (vem da sessão; objetos montados em testes podem omitir). */
export type SessionUser = { id: string; name: string; role: Role; mfaEnabled?: boolean };

export class ForbiddenError extends Error {
  constructor() {
    super("Sem permissão para esta ação.");
    this.name = "ForbiddenError";
  }
}

export function assertRole(user: SessionUser, role: "ADMIN"): void {
  if (user.role !== role) throw new ForbiddenError();
}
