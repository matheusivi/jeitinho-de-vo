import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { hashPassword } from "./password";
import { lockKeys } from "./rate-limit";
import { assertRole, type SessionUser } from "./types";

const userInput = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(200),
  role: z.enum(["ADMIN", "STAFF"]),
});

export type CreateUserResult = { ok: true; id: string } | { ok: false; message: string };

export async function createUser(input: z.input<typeof userInput>): Promise<CreateUserResult> {
  const parsed = userInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { name, email, password, role } = parsed.data;
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.email})`, email));
  if (existing) return { ok: false, message: "Já existe uma conta com este e-mail." };
  const [u] = await db
    .insert(schema.users)
    .values({ name, email, role, passwordHash: await hashPassword(password) })
    .returning({ id: schema.users.id });
  return { ok: true, id: u.id };
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  await db.update(schema.users).set({ active }).where(eq(schema.users.id, userId));
  if (!active) await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export function listUsers() {
  return db
    .select({
      id: schema.users.id, name: schema.users.name, email: schema.users.email,
      role: schema.users.role, active: schema.users.active,
      mfaEnabled: sql<boolean>`${schema.users.totpEnabledAt} IS NOT NULL`,
    })
    .from(schema.users)
    .orderBy(schema.users.name);
}

export class TeamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamError";
  }
}

/** Cria conta de funcionária ou de administradora. Só administradora cria contas. */
export async function createTeamMember(input: z.input<typeof userInput>, actor: SessionUser): Promise<CreateUserResult> {
  assertRole(actor, "ADMIN");
  return createUser(input);
}

/**
 * Ativa ou desativa uma conta. Regras: ninguém desativa a si mesma e sempre sobra pelo menos uma
 * administradora ativa. Um lock serializa as mudanças, para duas administradoras não se desativarem juntas.
 */
export async function changeUserActive(targetId: string, active: boolean, actor: SessionUser): Promise<void> {
  assertRole(actor, "ADMIN");
  if (targetId === actor.id && !active) throw new TeamError("Você não pode desativar a sua própria conta.");
  await db.transaction(async (tx) => {
    await lockKeys(tx, ["team-admins"]);
    const [me] = await tx.select().from(schema.users).where(eq(schema.users.id, actor.id));
    if (!me || !me.active || me.role !== "ADMIN") throw new TeamError("Sua conta não tem mais permissão para isso.");
    const [target] = await tx.select().from(schema.users).where(eq(schema.users.id, targetId));
    if (!target) throw new TeamError("Conta não encontrada.");
    if (!active && target.role === "ADMIN" && target.active) {
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(and(eq(schema.users.role, "ADMIN"), eq(schema.users.active, true)));
      if (r.n <= 1) throw new TeamError("Precisa sobrar pelo menos uma administradora ativa.");
    }
    await tx.update(schema.users).set({ active }).where(eq(schema.users.id, targetId));
    if (!active) await tx.delete(schema.sessions).where(eq(schema.sessions.userId, targetId));
  });
}
