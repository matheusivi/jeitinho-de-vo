import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  confirmEnrollment, disableMfa, MfaError, mfaStatus, regenerateRecoveryCodes, resetMfaFor, startEnrollment,
} from "@/lib/auth/mfa";
import { base32Decode, generateTotp } from "@/lib/auth/totp";
import { createSession, getSessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/types";
import { resetDb } from "../setup";
import { makeUser } from "../helpers";

const as = (u: { id: string; name: string; role: "ADMIN" | "STAFF" }) => ({ id: u.id, name: u.name, role: u.role });
const T0 = Date.UTC(2026, 10, 24, 15, 0, 0);

async function ativar(user: ReturnType<typeof as>, now = T0) {
  const { secret } = await startEnrollment(user);
  const codes = await confirmEnrollment(user, generateTotp(base32Decode(secret), now), now);
  return { secret, codes };
}

beforeEach(resetDb);

describe("ativação do código no celular", () => {
  it("só ativa com código válido e entrega 8 códigos de recuperação uma vez @spec:AC-058", async () => {
    const dona = as(await makeUser("ADMIN"));
    const { secret, uri, qrSvg } = await startEnrollment(dona);
    expect(uri).toContain(`secret=${secret}`);
    expect(qrSvg).toMatch(/^<svg/);
    await expect(confirmEnrollment(dona, "000000", T0)).rejects.toBeInstanceOf(MfaError);
    expect((await mfaStatus(dona.id)).enabled).toBe(false);
    const codes = await confirmEnrollment(dona, generateTotp(base32Decode(secret), T0), T0);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(await mfaStatus(dona.id)).toEqual({ enabled: true, recoveryLeft: 8 });
    await expect(startEnrollment(dona)).rejects.toThrow(/já está ativo/i);
  });

  it("segredo cifrado e códigos de recuperação só em hash @spec:AC-062", async () => {
    const dona = as(await makeUser("ADMIN"));
    const { secret, codes } = await ativar(dona);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, dona.id));
    expect(row.totpSecretEnc).toBeTruthy();
    expect(row.totpSecretEnc).not.toContain(secret);
    expect(row.totpPendingEnc).toBeNull();
    const stored = await db.select().from(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, dona.id));
    const dump = JSON.stringify(stored);
    for (const c of codes) {
      expect(dump).not.toContain(c);
      expect(dump).not.toContain(c.replace("-", ""));
    }
  });

  it("novos códigos de recuperação exigem o código do aplicativo e invalidam os antigos", async () => {
    const dona = as(await makeUser("ADMIN"));
    const { secret, codes } = await ativar(dona);
    await expect(regenerateRecoveryCodes(dona, "123456", T0 + 60_000)).rejects.toBeInstanceOf(MfaError);
    const novos = await regenerateRecoveryCodes(dona, generateTotp(base32Decode(secret), T0 + 60_000), T0 + 60_000);
    expect(novos).toHaveLength(8);
    expect(novos).not.toContain(codes[0]);
    expect((await mfaStatus(dona.id)).recoveryLeft).toBe(8);
  });
});

describe("funcionária e dona", () => {
  it("funcionária desativa o próprio código; administradora não @spec:AC-063", async () => {
    const ana = as(await makeUser("STAFF"));
    const dona = as(await makeUser("ADMIN"));
    const a = await ativar(ana);
    const d = await ativar(dona);
    const later = T0 + 60_000;
    await expect(disableMfa(dona, generateTotp(base32Decode(d.secret), later), later)).rejects.toThrow(/administradora/i);
    await expect(disableMfa(ana, "000000", later)).rejects.toBeInstanceOf(MfaError);
    await disableMfa(ana, generateTotp(base32Decode(a.secret), later), later);
    expect(await mfaStatus(ana.id)).toEqual({ enabled: false, recoveryLeft: 0 });
    expect((await mfaStatus(dona.id)).enabled).toBe(true);
  });

  it("dona zera o código da funcionária e derruba as sessões dela @spec:AC-064", async () => {
    const ana = as(await makeUser("STAFF"));
    const dona = as(await makeUser("ADMIN"));
    await ativar(ana);
    const { token } = await createSession(ana.id);
    await expect(resetMfaFor(ana.id, ana)).rejects.toBeInstanceOf(ForbiddenError);
    await resetMfaFor(ana.id, dona);
    expect(await mfaStatus(ana.id)).toEqual({ enabled: false, recoveryLeft: 0 });
    expect(await getSessionUser(token)).toBeNull();
  });

  it("dona não zera o código de outra administradora", async () => {
    const d1 = as(await makeUser("ADMIN"));
    const d2 = as(await makeUser("ADMIN"));
    await ativar(d2);
    await expect(resetMfaFor(d2.id, d1)).rejects.toThrow(/funcionária/i);
  });

  it("sessão informa se a pessoa tem código ativo", async () => {
    const dona = as(await makeUser("ADMIN"));
    const { token } = await createSession(dona.id);
    expect(await getSessionUser(token)).toMatchObject({ id: dona.id, mfaEnabled: false });
    await ativar(dona);
    expect(await getSessionUser(token)).toMatchObject({ mfaEnabled: true });
  });
});
