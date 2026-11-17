import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser, login } from "@/lib/auth/session";
import { checkRateLimit, recordAttempt } from "@/lib/auth/rate-limit";
import { assertRole, ForbiddenError } from "@/lib/auth/guard";
import { resetDb } from "../setup";

async function makeUser(over: Partial<typeof schema.users.$inferInsert> = {}) {
  const [u] = await db
    .insert(schema.users)
    .values({
      name: "Dona", email: "dona@teste.com", passwordHash: await hashPassword("senha-forte-1"),
      role: "ADMIN", ...over,
    })
    .returning();
  return u;
}

beforeEach(resetDb);

describe("senha", () => {
  it("gera hash diferente do texto e confere a senha certa", async () => {
    const h = await hashPassword("abc12345");
    expect(h).not.toContain("abc12345");
    expect(await verifyPassword(h, "abc12345")).toBe(true);
    expect(await verifyPassword(h, "abc12346")).toBe(false);
  });
});

describe("sessão", () => {
  it("guarda só o hash do token e devolve o usuário", async () => {
    const u = await makeUser();
    const { token, expiresAt } = await createSession(u.id);
    const rows = await db.select().from(schema.sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
    expect(await getSessionUser(token)).toEqual({ id: u.id, name: "Dona", role: "ADMIN" });
  });

  it("devolve null para token inexistente ou ausente", async () => {
    expect(await getSessionUser("nao-existe")).toBeNull();
    expect(await getSessionUser(undefined)).toBeNull();
  });

  it("devolve null para sessão vencida", async () => {
    const u = await makeUser();
    const { token } = await createSession(u.id);
    await db.update(schema.sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await getSessionUser(token)).toBeNull();
  });

  it("devolve null para usuário desativado", async () => {
    const u = await makeUser();
    const { token } = await createSession(u.id);
    await db.update(schema.users).set({ active: false }).where(eq(schema.users.id, u.id));
    expect(await getSessionUser(token)).toBeNull();
  });

  it("destroySession invalida o token", async () => {
    const u = await makeUser();
    const { token } = await createSession(u.id);
    await destroySession(token);
    expect(await getSessionUser(token)).toBeNull();
  });
});

describe("login", () => {
  it("entra com a senha certa, sem diferenciar maiúsculas no e-mail", async () => {
    await makeUser();
    const r = await login("DONA@Teste.com", "senha-forte-1", "1.1.1.1");
    expect(r.ok).toBe(true);
  });

  it("devolve INVALID igual para senha errada e para e-mail que não existe", async () => {
    await makeUser();
    expect(await login("dona@teste.com", "errada", "1.1.1.1")).toEqual({ ok: false, error: "INVALID" });
    expect(await login("ninguem@teste.com", "errada", "1.1.1.1")).toEqual({ ok: false, error: "INVALID" });
  });

  it("não deixa usuário desativado entrar", async () => {
    await makeUser({ active: false });
    expect(await login("dona@teste.com", "senha-forte-1", "1.1.1.1")).toEqual({ ok: false, error: "INVALID" });
  });

  it("bloqueia depois de 5 falhas, mesmo com a senha certa", async () => {
    await makeUser();
    for (let i = 0; i < 5; i++) await login("dona@teste.com", "errada", "1.1.1.1");
    expect(await login("dona@teste.com", "senha-forte-1", "1.1.1.1")).toEqual({ ok: false, error: "BLOCKED" });
    const outroIp = await login("dona@teste.com", "senha-forte-1", "2.2.2.2");
    expect(outroIp.ok).toBe(true);
  });
});

describe("limite de tentativas", () => {
  it("libera até o máximo e ignora tentativas fora da janela", async () => {
    expect(await checkRateLimit("k", 2, 15)).toBe(true);
    await recordAttempt("k");
    await recordAttempt("k");
    expect(await checkRateLimit("k", 2, 15)).toBe(false);
    await db.execute(sql`UPDATE login_attempts SET created_at = now() - interval '16 minutes'`);
    expect(await checkRateLimit("k", 2, 15)).toBe(true);
  });
});

describe("papéis", () => {
  it("funcionário não passa por exigência de admin", () => {
    expect(() => assertRole({ id: "1", name: "F", role: "STAFF" }, "ADMIN")).toThrow(ForbiddenError);
    expect(() => assertRole({ id: "1", name: "A", role: "ADMIN" }, "ADMIN")).not.toThrow();
  });
});

describe("limite por e-mail", () => {
  it("bloqueia o e-mail depois de 20 falhas mesmo trocando de IP a cada tentativa", async () => {
    await makeUser();
    for (let i = 0; i < 20; i++) await login("dona@teste.com", "errada", `9.9.9.${i}`);
    expect(await login("dona@teste.com", "senha-forte-1", "8.8.8.8")).toEqual({ ok: false, error: "BLOCKED" });
  });

  it("tentativas simultâneas também respeitam o limite", async () => {
    await makeUser();
    const r = await Promise.all(Array.from({ length: 30 }, () => login("dona@teste.com", "errada", "7.7.7.7")));
    expect(r.filter((x) => !x.ok && x.error === "INVALID")).toHaveLength(5);
  });
});
