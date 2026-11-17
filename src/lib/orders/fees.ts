import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/lib/db";

export type Neighborhood = { id: string; name: string; feeCents: number };

export function listNeighborhoods(): Promise<Neighborhood[]> {
  return db
    .select({ id: schema.neighborhoods.id, name: schema.neighborhoods.name, feeCents: schema.neighborhoods.feeCents })
    .from(schema.neighborhoods)
    .where(eq(schema.neighborhoods.active, true))
    .orderBy(asc(schema.neighborhoods.name));
}

export async function activeNeighborhood(id: string, tx: DbOrTx = db): Promise<Neighborhood | null> {
  const [n] = await tx
    .select({ id: schema.neighborhoods.id, name: schema.neighborhoods.name, feeCents: schema.neighborhoods.feeCents })
    .from(schema.neighborhoods)
    .where(and(eq(schema.neighborhoods.id, id), eq(schema.neighborhoods.active, true)));
  return n ?? null;
}

const nbInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome do bairro.").max(80),
  feeCents: z.number().int("Taxa inválida.").min(0, "A taxa não pode ser negativa.").max(100_000),
  active: z.boolean(),
});

export async function saveNeighborhood(
  input: z.input<typeof nbInput>,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const parsed = nbInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { id, name, feeCents, active } = parsed.data;
  const same = await db
    .select({ id: schema.neighborhoods.id })
    .from(schema.neighborhoods)
    .where(eq(sql`lower(${schema.neighborhoods.name})`, name.toLowerCase()));
  if (same.some((s) => s.id !== id)) return { ok: false, message: "Já existe um bairro com este nome." };
  if (id) {
    const [u] = await db.update(schema.neighborhoods).set({ name, feeCents, active }).where(eq(schema.neighborhoods.id, id)).returning();
    return u ? { ok: true, id: u.id } : { ok: false, message: "Bairro não encontrado." };
  }
  const [n] = await db.insert(schema.neighborhoods).values({ name, feeCents, active }).returning();
  return { ok: true, id: n.id };
}

export function listAllNeighborhoods() {
  return db.select().from(schema.neighborhoods).orderBy(asc(schema.neighborhoods.name));
}
