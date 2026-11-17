import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { hashPassword } from "./password";

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
    })
    .from(schema.users)
    .orderBy(schema.users.name);
}
