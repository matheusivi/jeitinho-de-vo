import { and, asc, eq } from "drizzle-orm";
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
