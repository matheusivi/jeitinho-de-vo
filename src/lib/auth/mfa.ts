import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNull, or, lt, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { db, schema, type DbOrTx } from "@/lib/db";
import { assertRole, type SessionUser } from "./types";
import { checkRateLimit, lockKeys, recordAttempt } from "./rate-limit";
import { decryptSecret, encryptSecret } from "./crypto";
import { base32Decode, base32Encode, newTotpSecret, otpauthUri, verifyTotp } from "./totp";

const { users, recoveryCodes, loginChallenges, sessions } = schema;

export class MfaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MfaError";
  }
}

const RECOVERY_COUNT = 8;
// sem letras e números que se confundem no papel (0/O, 1/I/L)
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CHALLENGE_MINUTES = 5;
export const CHALLENGE_MAX_ATTEMPTS = 5;
/** Erros de código por conta numa janela: impede que refazer o login renove os chutes sem limite. */
export const MFA_MAX_FAILS_PER_USER = 10;
export const MFA_WINDOW_MINUTES = 15;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normalizeRecovery = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();

function newRecoveryCode(): string {
  let s = "";
  for (let i = 0; i < 10; i++) s += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

async function getUserRow(id: string, tx: DbOrTx = db) {
  const [u] = await tx.select().from(users).where(eq(users.id, id));
  if (!u) throw new MfaError("Conta não encontrada.");
  return u;
}

export async function mfaStatus(userId: string): Promise<{ enabled: boolean; recoveryLeft: number }> {
  const u = await getUserRow(userId);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
  return { enabled: !!u.totpEnabledAt, recoveryLeft: u.totpEnabledAt ? r.n : 0 };
}

/** Gera um segredo novo, guardado como pendente até a confirmação. Devolve o que a tela mostra. */
export async function startEnrollment(user: SessionUser): Promise<{ secret: string; uri: string; qrSvg: string }> {
  const u = await getUserRow(user.id);
  if (u.totpEnabledAt) throw new MfaError("O código no celular já está ativo nesta conta.");
  // reaproveita o segredo pendente: recarregar a tela não invalida um QR que a pessoa já leu
  let secret = u.totpPendingEnc ? decryptSecret(u.totpPendingEnc) : null;
  if (!secret) {
    secret = base32Encode(newTotpSecret());
    await db.update(users).set({ totpPendingEnc: encryptSecret(secret) }).where(eq(users.id, user.id));
  }
  const uri = otpauthUri(base32Decode(secret), u.email);
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { secret, uri, qrSvg };
}

async function replaceRecoveryCodes(userId: string, tx: DbOrTx): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_COUNT }, newRecoveryCode);
  await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  await tx.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: sha256(normalizeRecovery(c)) })));
  return codes;
}

/** Confirma a ativação com um código do aplicativo e devolve os códigos de recuperação (mostrados uma vez). */
export async function confirmEnrollment(user: SessionUser, code: string, now = Date.now()): Promise<string[]> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
    if (!u) throw new MfaError("Conta não encontrada.");
    if (u.totpEnabledAt) throw new MfaError("O código no celular já está ativo nesta conta.");
    if (!u.totpPendingEnc) throw new MfaError("Comece a configuração de novo.");
    const secret = decryptSecret(u.totpPendingEnc);
    const step = verifyTotp(base32Decode(secret), code, now);
    if (step === null) throw new MfaError("Código incorreto. Confira se o relógio do celular está certo e tente o código atual.");
    await tx
      .update(users)
      .set({ totpSecretEnc: encryptSecret(secret), totpPendingEnc: null, totpEnabledAt: new Date(now), totpLastStep: step })
      .where(eq(users.id, user.id));
    return replaceRecoveryCodes(user.id, tx);
  });
}

/**
 * Confere um código do aplicativo da conta e marca o passo como usado, de forma atômica:
 * duas requisições com o mesmo código não passam as duas.
 */
async function consumeTotp(userId: string, code: string, now: number, tx: DbOrTx): Promise<boolean> {
  const u = await getUserRow(userId, tx);
  if (!u.totpSecretEnc) return false;
  const step = verifyTotp(base32Decode(decryptSecret(u.totpSecretEnc)), code, now, u.totpLastStep);
  if (step === null) return false;
  const updated = await tx
    .update(users)
    .set({ totpLastStep: step })
    .where(and(eq(users.id, userId), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
    .returning({ id: users.id });
  return updated.length === 1;
}

async function consumeRecovery(userId: string, code: string, tx: DbOrTx): Promise<boolean> {
  const norm = normalizeRecovery(code);
  if (!/^[A-Z0-9]{10}$/.test(norm)) return false;
  const used = await tx
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, sha256(norm)), isNull(recoveryCodes.usedAt)))
    .returning({ id: recoveryCodes.id });
  return used.length === 1;
}

export async function regenerateRecoveryCodes(user: SessionUser, code: string, now = Date.now()): Promise<string[]> {
  return db.transaction(async (tx) => {
    if (!(await consumeTotp(user.id, code, now, tx))) throw new MfaError("Código incorreto.");
    return replaceRecoveryCodes(user.id, tx);
  });
}

async function clearMfa(userId: string, tx: DbOrTx): Promise<void> {
  await tx
    .update(users)
    .set({ totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null })
    .where(eq(users.id, userId));
  await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
}

/** Funcionária desativa o próprio código. Administradora não pode: para ela o código é obrigatório. */
export async function disableMfa(user: SessionUser, code: string, now = Date.now()): Promise<void> {
  if (user.role === "ADMIN") throw new MfaError("Para administradora o código no celular é obrigatório e não pode ser desativado.");
  await db.transaction(async (tx) => {
    if (!(await consumeTotp(user.id, code, now, tx))) throw new MfaError("Código incorreto.");
    await clearMfa(user.id, tx);
  });
}

/** A dona zera o código de uma funcionária que perdeu o celular; as sessões abertas dela caem. */
export async function resetMfaFor(targetId: string, actor: SessionUser): Promise<void> {
  assertRole(actor, "ADMIN");
  await db.transaction(async (tx) => {
    const target = await getUserRow(targetId, tx);
    if (target.role !== "STAFF") throw new MfaError("Só dá para zerar o código de uma funcionária.");
    await clearMfa(targetId, tx);
    await tx.delete(sessions).where(eq(sessions.userId, targetId));
  });
}

/** Cria a etapa do código depois da senha certa. Devolve o token que vai no cookie do desafio. */
export async function createChallenge(userId: string, tx: DbOrTx = db): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_MINUTES * 60_000);
  await tx.delete(loginChallenges).where(and(eq(loginChallenges.userId, userId), lt(loginChallenges.expiresAt, new Date())));
  await tx.insert(loginChallenges).values({ tokenHash: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

export type ChallengeResult = { ok: true; userId: string } | { ok: false; error: "INVALID" | "EXPIRED" | "BLOCKED" };

/**
 * Confere o código (do aplicativo ou de recuperação) para um desafio. Cada erro conta;
 * no quinto erro, ou depois de 5 minutos, o desafio acaba e é preciso recomeçar pela senha.
 */
export async function verifyChallenge(token: string | undefined, code: string, now = Date.now()): Promise<ChallengeResult> {
  if (!token) return { ok: false, error: "EXPIRED" };
  return db.transaction(async (tx) => {
    const [ch] = await tx
      .select()
      .from(loginChallenges)
      .where(and(eq(loginChallenges.tokenHash, sha256(token)), gt(loginChallenges.expiresAt, new Date(now))))
      .for("update");
    if (!ch) return { ok: false as const, error: "EXPIRED" as const };
    const userKey = `mfa:${ch.userId}`;
    await lockKeys(tx, [userKey]);
    if (!(await checkRateLimit(userKey, MFA_MAX_FAILS_PER_USER, MFA_WINDOW_MINUTES, tx))) {
      await tx.delete(loginChallenges).where(eq(loginChallenges.id, ch.id));
      return { ok: false as const, error: "BLOCKED" as const };
    }
    const ok = (await consumeTotp(ch.userId, code, now, tx)) || (await consumeRecovery(ch.userId, code, tx));
    if (ok) {
      await tx.delete(loginChallenges).where(eq(loginChallenges.id, ch.id));
      return { ok: true as const, userId: ch.userId };
    }
    await recordAttempt(userKey, tx);
    if (ch.attempts + 1 >= CHALLENGE_MAX_ATTEMPTS) {
      await tx.delete(loginChallenges).where(eq(loginChallenges.id, ch.id));
      return { ok: false as const, error: "EXPIRED" as const };
    }
    await tx.update(loginChallenges).set({ attempts: ch.attempts + 1 }).where(eq(loginChallenges.id, ch.id));
    return { ok: false as const, error: "INVALID" as const };
  });
}
