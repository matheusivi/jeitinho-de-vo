import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, schema } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession, getSessionUser, login } from "@/lib/auth/session";
import { confirmEnrollment, startEnrollment, verifyChallenge } from "@/lib/auth/mfa";
import { base32Decode, generateTotp } from "@/lib/auth/totp";
import { resetDb } from "../setup";

// A guarda usa cookies() e redirect() do Next; aqui eles são simulados.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (cookieJar.has(k) ? { value: cookieJar.get(k) } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
const { requireRole, requireUser, requireUserForSetup } = await import("@/lib/auth/guard");

let n = 0;
async function conta(role: "ADMIN" | "STAFF", password = "SenhaForte#2026") {
  const email = `p${++n}@teste.com`;
  const [u] = await db.insert(schema.users).values({ name: role, email, role, passwordHash: await hashPassword(password) }).returning();
  return { user: { id: u.id, name: u.name, role }, email, password };
}

async function comCodigo(role: "ADMIN" | "STAFF", now: number) {
  const c = await conta(role);
  const { secret } = await startEnrollment(c.user);
  const recovery = await confirmEnrollment(c.user, generateTotp(base32Decode(secret), now), now);
  return { ...c, secret: base32Decode(secret), recovery };
}


beforeEach(async () => {
  await resetDb();
  cookieJar.clear();
});

describe("guarda das telas", () => {
  it("administradora sem código só acessa a configuração @spec:AC-057", async () => {
    const { user } = await conta("ADMIN");
    const { token } = await createSession(user.id);
    cookieJar.set("jdv_session", token);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/painel/seguranca");
    await expect(requireRole("ADMIN")).rejects.toThrow("REDIRECT:/painel/seguranca");
    await expect(requireUserForSetup()).resolves.toMatchObject({ id: user.id, mfaEnabled: false });
  });

  it("funcionária sem código e administradora com código usam o painel normalmente", async () => {
    const ana = await conta("STAFF");
    cookieJar.set("jdv_session", (await createSession(ana.user.id)).token);
    await expect(requireUser()).resolves.toMatchObject({ id: ana.user.id });
    const dona = await comCodigo("ADMIN", Date.now());
    cookieJar.set("jdv_session", (await createSession(dona.user.id)).token);
    await expect(requireRole("ADMIN")).resolves.toMatchObject({ id: dona.user.id, mfaEnabled: true });
  });

  it("sem sessão vai para o login", async () => {
    await expect(requireUser()).rejects.toThrow("REDIRECT:/painel/login");
    await expect(requireUserForSetup()).rejects.toThrow("REDIRECT:/painel/login");
  });
});

describe("login em duas etapas", () => {
  it("senha certa não cria sessão até o código ser confirmado @spec:AC-059", async () => {
    const now = Date.now();
    const dona = await comCodigo("ADMIN", now - 60_000);
    const r = await login(dona.email, dona.password, "10.0.0.1");
    expect(r.ok).toBe("MFA");
    if (r.ok !== "MFA") return;
    expect(await db.select().from(schema.sessions)).toHaveLength(0);
    const v = await verifyChallenge(r.challengeToken, generateTotp(dona.secret, now), now);
    expect(v).toEqual({ ok: true, userId: dona.user.id });
  });

  it("senha errada continua com a mensagem única, sem desafio", async () => {
    const dona = await comCodigo("ADMIN", Date.now() - 60_000);
    const r = await login(dona.email, "errada", "10.0.0.2");
    expect(r).toEqual({ ok: false, error: "INVALID" });
    expect(await db.select().from(schema.loginChallenges)).toHaveLength(0);
  });

  it("conta sem código entra direto com a senha", async () => {
    const ana = await conta("STAFF");
    const r = await login(ana.email, ana.password, "10.0.0.3");
    expect(r.ok).toBe(true);
  });

  it("5 erros encerram o desafio e código repetido é recusado @spec:AC-060", async () => {
    const now = Date.now();
    const dona = await comCodigo("ADMIN", now - 120_000);
    const r = await login(dona.email, dona.password, "10.0.0.4");
    if (r.ok !== "MFA") throw new Error("esperava MFA");
    for (let i = 0; i < 4; i++) expect(await verifyChallenge(r.challengeToken, "000000", now)).toEqual({ ok: false, error: "INVALID" });
    expect(await verifyChallenge(r.challengeToken, "000000", now)).toEqual({ ok: false, error: "EXPIRED" });
    // mesmo com o código certo, o desafio já acabou
    expect(await verifyChallenge(r.challengeToken, generateTotp(dona.secret, now), now)).toEqual({ ok: false, error: "EXPIRED" });

    const r2 = await login(dona.email, dona.password, "10.0.0.4");
    if (r2.ok !== "MFA") throw new Error("esperava MFA");
    const code = generateTotp(dona.secret, now);
    expect((await verifyChallenge(r2.challengeToken, code, now)).ok).toBe(true);
    const r3 = await login(dona.email, dona.password, "10.0.0.4");
    if (r3.ok !== "MFA") throw new Error("esperava MFA");
    expect(await verifyChallenge(r3.challengeToken, code, now)).toEqual({ ok: false, error: "INVALID" });
  });

  it("erros de código somam por conta: refazer o login não dá chutes infinitos @spec:AC-060", async () => {
    const now = Date.now();
    const dona = await comCodigo("ADMIN", now - 120_000);
    let erros = 0;
    for (let rodada = 0; rodada < 3; rodada++) {
      const r = await login(dona.email, dona.password, "10.0.0.7");
      if (r.ok !== "MFA") throw new Error("esperava MFA");
      for (let i = 0; i < 4; i++) {
        const v = await verifyChallenge(r.challengeToken, "000000", now);
        if (!v.ok) erros++;
      }
    }
    expect(erros).toBe(12);
    // passou de 10 erros na janela: nem o código certo entra até a janela acabar
    const r = await login(dona.email, dona.password, "10.0.0.7");
    if (r.ok !== "MFA") throw new Error("esperava MFA");
    expect(await verifyChallenge(r.challengeToken, generateTotp(dona.secret, now), now)).toEqual({ ok: false, error: "BLOCKED" });
  });

  it("desafio vence em 5 minutos", async () => {
    const now = Date.now();
    const dona = await comCodigo("ADMIN", now - 60_000);
    const r = await login(dona.email, dona.password, "10.0.0.5");
    if (r.ok !== "MFA") throw new Error("esperava MFA");
    const later = now + 6 * 60_000;
    expect(await verifyChallenge(r.challengeToken, generateTotp(dona.secret, later), later)).toEqual({ ok: false, error: "EXPIRED" });
  });

  it("código de recuperação entra uma vez só @spec:AC-061", async () => {
    const now = Date.now();
    const dona = await comCodigo("ADMIN", now - 60_000);
    const r = await login(dona.email, dona.password, "10.0.0.6");
    if (r.ok !== "MFA") throw new Error("esperava MFA");
    const code = dona.recovery[0].toLowerCase(); // aceita minúscula e sem se importar com o hífen
    expect((await verifyChallenge(r.challengeToken, code, now)).ok).toBe(true);
    const r2 = await login(dona.email, dona.password, "10.0.0.6");
    if (r2.ok !== "MFA") throw new Error("esperava MFA");
    expect(await verifyChallenge(r2.challengeToken, dona.recovery[0], now)).toEqual({ ok: false, error: "INVALID" });
    expect((await verifyChallenge(r2.challengeToken, dona.recovery[1].replace("-", ""), now)).ok).toBe(true);
  });

  it("sessão criada depois do código traz o código ativo", async () => {
    const dona = await comCodigo("ADMIN", Date.now() - 60_000);
    const { token } = await createSession(dona.user.id);
    expect(await getSessionUser(token)).toMatchObject({ mfaEnabled: true });
  });
});
