import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/lib/db";
import { createUser, setUserActive } from "@/lib/auth/users";
import { login } from "@/lib/auth/session";
import { resetDb } from "../setup";

beforeEach(resetDb);

describe("equipe", () => {
  it("cria funcionário que consegue entrar", async () => {
    const r = await createUser({ name: "Ana", email: "Ana@Loja.com", password: "12345678", role: "STAFF" });
    expect(r.ok).toBe(true);
    const [u] = await db.select().from(schema.users);
    expect(u.email).toBe("ana@loja.com");
    expect(u.role).toBe("STAFF");
    expect((await login("ana@loja.com", "12345678", "ip")).ok).toBe(true);
  });

  it("recusa senha com menos de 8 caracteres", async () => {
    const r = await createUser({ name: "Ana", email: "ana@loja.com", password: "1234567", role: "STAFF" });
    expect(r).toMatchObject({ ok: false });
    expect(await db.select().from(schema.users)).toHaveLength(0);
  });

  it("recusa e-mail repetido", async () => {
    await createUser({ name: "Ana", email: "ana@loja.com", password: "12345678", role: "STAFF" });
    const r = await createUser({ name: "Ana 2", email: "ANA@loja.com", password: "12345678", role: "STAFF" });
    expect(r).toMatchObject({ ok: false });
  });

  it("desativar encerra as sessões e impede novo login", async () => {
    await createUser({ name: "Ana", email: "ana@loja.com", password: "12345678", role: "STAFF" });
    await login("ana@loja.com", "12345678", "ip");
    const [u] = await db.select().from(schema.users);
    await setUserActive(u.id, false);
    expect(await db.select().from(schema.sessions)).toHaveLength(0);
    expect((await login("ana@loja.com", "12345678", "ip")).ok).toBe(false);
  });
});

describe("administração pela Equipe", () => {
  const as = (u: { id: string; name: string; role: "ADMIN" | "STAFF" }) => ({ id: u.id, name: u.name, role: u.role });

  it("dona cria administradora, que precisará ativar o código; funcionária não cria contas @spec:AC-065", async () => {
    const { createTeamMember } = await import("@/lib/auth/users");
    const { needsMfaSetup } = await import("@/lib/auth/guard");
    const { createSession, getSessionUser } = await import("@/lib/auth/session");
    const { ForbiddenError } = await import("@/lib/auth/types");
    const [dona] = await db.insert(schema.users).values({ name: "Dona", email: "dona@loja.com", passwordHash: "x", role: "ADMIN" }).returning();
    const [ana] = await db.insert(schema.users).values({ name: "Ana", email: "ana@loja.com", passwordHash: "x", role: "STAFF" }).returning();
    const r = await createTeamMember({ name: "Maria", email: "maria@loja.com", password: "SenhaForte1", role: "ADMIN" }, as(dona));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { token } = await createSession(r.id);
    const maria = await getSessionUser(token);
    expect(maria).toMatchObject({ role: "ADMIN", mfaEnabled: false });
    expect(needsMfaSetup(maria!)).toBe(true);
    await expect(createTeamMember({ name: "X", email: "x@loja.com", password: "SenhaForte1", role: "STAFF" }, as(ana))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("sempre sobra uma administradora ativa e ninguém desativa a si mesma @spec:AC-066", async () => {
    const { changeUserActive, TeamError } = await import("@/lib/auth/users");
    const [d1] = await db.insert(schema.users).values({ name: "D1", email: "d1@loja.com", passwordHash: "x", role: "ADMIN" }).returning();
    const [d2] = await db.insert(schema.users).values({ name: "D2", email: "d2@loja.com", passwordHash: "x", role: "ADMIN" }).returning();
    await changeUserActive(d2.id, false, as(d1));
    await expect(changeUserActive(d1.id, false, as(d1))).rejects.toThrow(/própria/i);
    // reativa d2 e tenta as duas se desativarem ao mesmo tempo: só uma consegue
    await changeUserActive(d2.id, true, as(d1));
    const results = await Promise.allSettled([changeUserActive(d2.id, false, as(d1)), changeUserActive(d1.id, false, as(d2))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(TeamError);
    const ativos = (await db.select().from(schema.users)).filter((u) => u.active && u.role === "ADMIN");
    expect(ativos).toHaveLength(1);
  });
});
