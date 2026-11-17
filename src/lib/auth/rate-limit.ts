import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, schema, type DbOrTx } from "@/lib/db";

/** Quantas tentativas a chave tem dentro da janela. */
export async function countAttempts(key: string, windowMinutes: number, tx: DbOrTx = db): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.key, key), gt(schema.loginAttempts.createdAt, since)));
  return row.n;
}

/** true quando ainda há tentativas disponíveis para a chave dentro da janela. */
export async function checkRateLimit(key: string, max: number, windowMinutes: number, tx: DbOrTx = db): Promise<boolean> {
  return (await countAttempts(key, windowMinutes, tx)) < max;
}

export async function recordAttempt(key: string, tx: DbOrTx = db): Promise<void> {
  await tx.insert(schema.loginAttempts).values({ key });
  // limpeza oportunista do que já não conta para nenhuma janela
  await tx
    .delete(schema.loginAttempts)
    .where(lt(schema.loginAttempts.createdAt, new Date(Date.now() - 24 * 3600_000)));
}

/**
 * Trava as chaves até o fim da transação. Duas requisições com a mesma chave passam uma de cada vez,
 * então "conferir o limite e depois registrar" não deixa várias passarem juntas.
 */
export async function lockKeys(tx: DbOrTx, keys: string[]): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
  }
}
