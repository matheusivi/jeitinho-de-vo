export type Role = "ADMIN" | "STAFF";
export type SessionUser = { id: string; name: string; role: Role };

export class ForbiddenError extends Error {
  constructor() {
    super("Sem permissão para esta ação.");
    this.name = "ForbiddenError";
  }
}

export function assertRole(user: SessionUser, role: "ADMIN"): void {
  if (user.role !== role) throw new ForbiddenError();
}
