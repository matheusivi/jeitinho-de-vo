import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema, type DbOrTx } from "@/lib/db";

/** O que vai no papel. Nunca leva telefone, endereço nem valores: é para a cozinha. */
export type PrintTicket = {
  title: string;
  subtitle?: string;
  lines: { quantity: number; name: string; note?: string }[];
  footer?: string;
  createdAt: string;
};
export type PrintKind = (typeof schema.printKindEnum.enumValues)[number];
export type PrintJob = { id: string; kind: PrintKind; ticket: PrintTicket; createdAt: Date; printedAt: Date | null };

/** Reserva sem impressão confirmada volta para a fila depois disso (página fechou no meio). */
const CLAIM_TIMEOUT_MS = 2 * 60_000;
/** Comanda esperando há mais que isso indica que a página de comandas não está aberta. */
const STALE_MS = 60_000;

export async function enqueue(kind: PrintKind, orderId: string | null, ticket: PrintTicket, tx: DbOrTx = db): Promise<void> {
  await tx.insert(schema.printJobs).values({ kind, orderId, content: JSON.stringify(ticket) });
}

const toJob = (r: typeof schema.printJobs.$inferSelect): PrintJob => ({
  id: r.id, kind: r.kind, ticket: JSON.parse(r.content) as PrintTicket, createdAt: r.createdAt, printedAt: r.printedAt,
});

/**
 * Entrega comandas pendentes a um computador. FOR UPDATE SKIP LOCKED garante que dois computadores
 * buscando juntos não recebem a mesma comanda.
 */
export async function claimJobs(deviceId: string, limit = 5, now = new Date()): Promise<PrintJob[]> {
  const device = deviceId.slice(0, 64);
  const expired = new Date(+now - CLAIM_TIMEOUT_MS);
  const r = await db.execute(sql`
    UPDATE print_jobs SET claimed_at = ${now}, claimed_by = ${device}
    WHERE id IN (
      SELECT id FROM print_jobs
      WHERE printed_at IS NULL AND (claimed_at IS NULL OR claimed_at < ${expired})
      ORDER BY created_at LIMIT ${Math.min(Math.max(limit, 1), 20)}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, content, created_at, printed_at`);
  return (r.rows as { id: string; kind: PrintKind; content: string; created_at: string | Date; printed_at: null }[])
    .map((x) => ({ id: x.id, kind: x.kind, ticket: JSON.parse(x.content), createdAt: new Date(x.created_at), printedAt: null }))
    .sort((a, b) => +a.createdAt - +b.createdAt);
}

export async function markPrinted(id: string, deviceId: string): Promise<void> {
  await db
    .update(schema.printJobs)
    .set({ printedAt: new Date() })
    .where(and(eq(schema.printJobs.id, id), eq(schema.printJobs.claimedBy, deviceId.slice(0, 64)), isNull(schema.printJobs.printedAt)));
}

/** Para reimprimir: devolve o conteúdo sem mexer na fila. */
export async function getJob(id: string): Promise<PrintJob | null> {
  const [r] = await db.select().from(schema.printJobs).where(eq(schema.printJobs.id, id));
  return r ? toJob(r) : null;
}

export async function recentJobs(limit = 30): Promise<PrintJob[]> {
  const rows = await db.select().from(schema.printJobs).orderBy(desc(schema.printJobs.createdAt)).limit(limit);
  return rows.map(toJob);
}

/** Quantas comandas estão sem imprimir há mais de 1 minuto. */
export async function stalePending(now = new Date()): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.printJobs)
    .where(and(isNull(schema.printJobs.printedAt), lt(schema.printJobs.createdAt, new Date(+now - STALE_MS)),
      or(isNull(schema.printJobs.claimedAt), lt(schema.printJobs.claimedAt, new Date(+now - CLAIM_TIMEOUT_MS)))));
  return r?.n ?? 0;
}
