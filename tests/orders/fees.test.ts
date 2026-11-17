import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/lib/db";
import { listAllNeighborhoods, saveNeighborhood } from "@/lib/orders/fees";
import { resetDb } from "../setup";

beforeEach(resetDb);

describe("cadastro de bairros", () => {
  it("cria e edita", async () => {
    const r = await saveNeighborhood({ name: "Centro", feeCents: 500, active: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await saveNeighborhood({ id: r.id, name: "Centro", feeCents: 600, active: false });
    const [b] = await db.select().from(schema.neighborhoods);
    expect(b).toMatchObject({ name: "Centro", feeCents: 600, active: false });
  });

  it("aceita taxa zero mas recusa negativa, fracionada e nome repetido @spec:AC-026", async () => {
    expect((await saveNeighborhood({ name: "Perto", feeCents: 0, active: true })).ok).toBe(true);
    expect((await saveNeighborhood({ name: "X1", feeCents: -1, active: true })).ok).toBe(false);
    expect((await saveNeighborhood({ name: "X2", feeCents: 1.5, active: true })).ok).toBe(false);
    expect((await saveNeighborhood({ name: "perto", feeCents: 100, active: true })).ok).toBe(false);
  });

  it("lista todos, ativos e inativos, em ordem", async () => {
    await saveNeighborhood({ name: "Vila", feeCents: 700, active: false });
    await saveNeighborhood({ name: "Centro", feeCents: 500, active: true });
    expect((await listAllNeighborhoods()).map((b) => b.name)).toEqual(["Centro", "Vila"]);
  });
});
