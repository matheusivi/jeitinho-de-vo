import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole, type SessionUser } from "@/lib/auth/types";

/** Meta de CMV em pontos-base (3500 = 35%). Começa em 35%, dentro da faixa de 20% a 40% usada no setor. */
export const DEFAULT_CMV_TARGET_BPS = 3500;
const CMV_KEY = "cmv_target_bps";

export async function getCmvTargetBps(): Promise<number> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, CMV_KEY));
  const n = row ? Number(row.value) : NaN;
  return Number.isInteger(n) ? n : DEFAULT_CMV_TARGET_BPS;
}

export async function setCmvTargetBps(bps: number, user: SessionUser): Promise<void> {
  assertRole(user, "ADMIN");
  if (!Number.isInteger(bps) || bps < 500 || bps > 9000) throw new Error("A meta de CMV deve ficar entre 5% e 90%.");
  await db
    .insert(schema.settings)
    .values({ key: CMV_KEY, value: String(bps) })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: String(bps), updatedAt: new Date() } });
}
