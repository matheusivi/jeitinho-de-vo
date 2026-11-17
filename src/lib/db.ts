import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

function connectionString(): string {
  const url =
    process.env.NODE_ENV === "test" ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  return url;
}

const globalForDb = globalThis as unknown as { jdvPool?: Pool };

export const pool = globalForDb.jdvPool ?? new Pool({ connectionString: connectionString(), max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.jdvPool = pool;

export const db = drizzle(pool, { schema });
export type Db = NodePgDatabase<typeof schema>;
/** Aceita tanto o banco quanto uma transação aberta. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
