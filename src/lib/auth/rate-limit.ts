import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** true quando ainda há tentativas disponíveis para a chave dentro da janela. */
export async function checkRateLimit(key: string, max: number, windowMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.key, key), gt(schema.loginAttempts.createdAt, since)));
  return row.n < max;
}

export async function recordAttempt(key: string): Promise<void> {
  await db.insert(schema.loginAttempts).values({ key });
  // limpeza oportunista do que já não conta para nenhuma janela
  await db
    .delete(schema.loginAttempts)
    .where(lt(schema.loginAttempts.createdAt, new Date(Date.now() - 24 * 3600_000)));
}
