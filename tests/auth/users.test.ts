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
