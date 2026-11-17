import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { checkRateLimit, lockKeys, recordAttempt } from "./rate-limit";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "jdv_session";
const SESSION_DAYS = 7;
const MAX_FAILS = 5;
/** Limite por conta, independente do IP: segura quem troca de IP a cada tentativa. */
const MAX_FAILS_PER_EMAIL = 20;
const WINDOW_MINUTES = 15;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000);
  await db.insert(schema.sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
        eq(schema.users.active, true),
      ),
    );
  return row ?? null;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
}

// Hash usado quando o e-mail não existe, para o tempo de resposta não revelar isso.
let dummyHash: Promise<string> | undefined;

export async function login(
  email: string,
  password: string,
  ip: string,
): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; error: "INVALID" | "BLOCKED" }> {
  const normalized = email.trim().toLowerCase();
  const ipKey = `login:${normalized}:${ip}`;
  const emailKey = `login-email:${normalized}`;
  dummyHash ??= hashPassword("senha-que-nao-existe");
  const fallbackHash = await dummyHash;

  const outcome = await db.transaction(async (tx) => {
    await lockKeys(tx, [ipKey, emailKey]);
    if (
      !(await checkRateLimit(ipKey, MAX_FAILS, WINDOW_MINUTES, tx)) ||
      !(await checkRateLimit(emailKey, MAX_FAILS_PER_EMAIL, WINDOW_MINUTES, tx))
    ) {
      return { ok: false as const, error: "BLOCKED" as const };
    }
    const [user] = await tx.select().from(schema.users).where(eq(sql`lower(${schema.users.email})`, normalized));
    const passwordOk = await verifyPassword(user?.passwordHash ?? fallbackHash, password);
    if (!user || !user.active || !passwordOk) {
      await recordAttempt(ipKey, tx);
      await recordAttempt(emailKey, tx);
      return { ok: false as const, error: "INVALID" as const };
    }
    return { ok: true as const, userId: user.id };
  });

  if (!outcome.ok) return outcome;
  const session = await createSession(outcome.userId);
  return { ok: true, ...session };
}
