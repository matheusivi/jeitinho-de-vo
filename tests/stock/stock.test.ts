import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { adjust, available, produce, reserve, StockError } from "@/lib/stock/stock";
import { resetDb } from "../setup";
import { getProductRow, makeProduct, makeUser, movementsOf } from "../helpers";

beforeEach(resetDb);

describe("produzir", () => {
  it("soma no estoque e registra o movimento com quem lançou", async () => {
    const p = await makeProduct();
    const u = await makeUser("STAFF");
    await produce(p.id, 5, u.id);
    expect(available(await getProductRow(p.id))).toBe(5);
    const mov = await movementsOf(p.id);
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ type: "PRODUCTION", quantity: 5, userId: u.id });
  });

  it.each([0, -3, 1.5, 100001])("recusa quantidade %s", async (q) => {
    const p = await makeProduct();
    const u = await makeUser();
    await expect(produce(p.id, q, u.id)).rejects.toBeInstanceOf(StockError);
    expect(available(await getProductRow(p.id))).toBe(0);
    expect(await movementsOf(p.id)).toHaveLength(0);
  });

  it("recusa produto que não existe", async () => {
    const u = await makeUser();
    await expect(produce("nao-existe", 1, u.id)).rejects.toBeInstanceOf(StockError);
  });
});

describe("ajustar", () => {
  it("baixa com motivo", async () => {
    const p = await makeProduct({ stockOnHand: 5 });
    const u = await makeUser();
    await adjust(p.id, -2, "perda", u.id);
    expect(available(await getProductRow(p.id))).toBe(3);
    expect((await movementsOf(p.id))[0]).toMatchObject({ type: "ADJUSTMENT", quantity: -2, reason: "perda" });
  });

  it("exige motivo e delta diferente de zero", async () => {
    const p = await makeProduct({ stockOnHand: 5 });
    const u = await makeUser();
    await expect(adjust(p.id, -1, "  ", u.id)).rejects.toBeInstanceOf(StockError);
    await expect(adjust(p.id, 0, "nada", u.id)).rejects.toBeInstanceOf(StockError);
    expect(available(await getProductRow(p.id))).toBe(5);
  });

  it("não deixa ficar abaixo do que está reservado", async () => {
    const p = await makeProduct({ stockOnHand: 5, stockReserved: 4 });
    const u = await makeUser();
    await expect(adjust(p.id, -2, "perda", u.id)).rejects.toMatchObject({ code: "INSUFICIENTE" });
    expect((await getProductRow(p.id)).stockOnHand).toBe(5);
  });
});

describe("reservar", () => {
  it("reserva e diminui o disponível", async () => {
    const p = await makeProduct({ stockOnHand: 3 });
    await db.transaction((tx) => reserve([{ productId: p.id, quantity: 2 }], tx));
    expect(available(await getProductRow(p.id))).toBe(1);
  });

  it("recusa mais do que o disponível e não altera nada", async () => {
    const p = await makeProduct({ stockOnHand: 1 });
    await expect(db.transaction((tx) => reserve([{ productId: p.id, quantity: 2 }], tx))).rejects.toMatchObject({
      code: "ESGOTADO", productId: p.id,
    });
    expect(await getProductRow(p.id)).toMatchObject({ stockOnHand: 1, stockReserved: 0 });
  });

  it("é tudo ou nada com vários itens", async () => {
    const a = await makeProduct({ stockOnHand: 5 });
    const b = await makeProduct({ stockOnHand: 0 });
    await expect(
      db.transaction((tx) => reserve([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }], tx)),
    ).rejects.toMatchObject({ code: "ESGOTADO", productId: b.id });
    expect((await getProductRow(a.id)).stockReserved).toBe(0);
  });

  it("soma quantidades do mesmo produto repetido na lista", async () => {
    const p = await makeProduct({ stockOnHand: 3 });
    await expect(
      db.transaction((tx) => reserve([{ productId: p.id, quantity: 2 }, { productId: p.id, quantity: 2 }], tx)),
    ).rejects.toMatchObject({ code: "ESGOTADO" });
  });

  it("duas pessoas disputando a última unidade: só uma leva", async () => {
    const p = await makeProduct({ stockOnHand: 1 });
    const tentar = () => db.transaction((tx) => reserve([{ productId: p.id, quantity: 1 }], tx));
    const results = await Promise.allSettled([tentar(), tentar(), tentar(), tentar()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const perdeu = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(perdeu).toHaveLength(3);
    for (const r of perdeu) expect(r.reason).toMatchObject({ code: "ESGOTADO" });
    expect(await getProductRow(p.id)).toMatchObject({ stockOnHand: 1, stockReserved: 1 });
  });
});
