import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ForbiddenError } from "@/lib/auth/types";
import { addItems, cancelTable, getTable, listTables, openTable, removeItem, setTableCount, TableError } from "@/lib/tables/tables";
import { resetDb } from "../setup";
import { getProductRow, makeProduct, makeUser, movementsOf } from "../helpers";

const admin = () => makeUser("ADMIN").then((u) => ({ id: u.id, name: u.name, role: "ADMIN" as const }));
async function staff() {
  const u = await makeUser("STAFF");
  await db.update(schema.users).set({ name: "Ana" }).where(eq(schema.users.id, u.id));
  return { id: u.id, name: "Ana", role: "STAFF" as const };
}
async function mesas(n = 8) {
  await db.insert(schema.diningTables).values(Array.from({ length: n }, (_, i) => ({ number: i + 1 })));
}
const jobs = () => db.select().from(schema.printJobs);

beforeEach(async () => {
  await resetDb();
  await mesas();
});

describe("abrir mesa", () => {
  it("dois garçons abrindo a mesma mesa criam uma comanda só @spec:AC-068", async () => {
    const [a, b] = [await staff(), await staff()];
    const [r1, r2] = await Promise.all([openTable(3, a), openTable(3, b)]);
    expect(r1.orderId).toBe(r2.orderId);
    expect([r1.created, r2.created].filter(Boolean)).toHaveLength(1);
    const abertas = await db.select().from(schema.orders).where(eq(schema.orders.tableNumber, 3));
    expect(abertas).toHaveLength(1);
    expect([a.id, b.id]).toContain(abertas[0].openedBy);
    expect(abertas[0].fulfillment).toBe("TABLE");
    const lista = await listTables(a);
    expect(lista.find((t) => t.number === 3)?.orderId).toBe(r1.orderId);
    expect(lista.find((t) => t.number === 4)?.orderId).toBeNull();
  });

  it("mesa inexistente ou desativada não abre @spec:AC-068", async () => {
    const u = await staff();
    await expect(openTable(9, u)).rejects.toThrow(TableError);
  });
});

describe("lançar itens", () => {
  it("baixa o estoque, soma a conta com preço e custo do momento @spec:AC-069", async () => {
    const u = await staff();
    const bolo = await makeProduct({ priceCents: 1200, stockOnHand: 5 });
    const { orderId } = await openTable(1, u);
    await addItems(orderId, [{ productId: bolo.id, quantity: 2, note: "sem cobertura" }], u);
    expect((await getProductRow(bolo.id)).stockOnHand).toBe(3);
    const mesa = await getTable(1, u);
    expect(mesa?.totalCents).toBe(2400);
    expect(mesa?.items[0]).toMatchObject({ name: bolo.name, quantity: 2, unitPriceCents: 1200, note: "sem cobertura", addedByName: "Ana" });
    const vendas = (await movementsOf(bolo.id)).filter((m) => m.type === "SALE");
    expect(vendas).toEqual([expect.objectContaining({ quantity: -2, orderId })]);
  });

  it("se faltar estoque de um item, nada do lançamento é gravado @spec:AC-069", async () => {
    const u = await staff();
    const tem = await makeProduct({ stockOnHand: 5 });
    const pouco = await makeProduct({ stockOnHand: 1 });
    const { orderId } = await openTable(1, u);
    await expect(
      addItems(orderId, [{ productId: tem.id, quantity: 2 }, { productId: pouco.id, quantity: 2 }], u),
    ).rejects.toThrow(TableError);
    expect((await getProductRow(tem.id)).stockOnHand).toBe(5);
    expect((await getTable(1, u))?.items).toHaveLength(0);
    expect(await jobs()).toHaveLength(0);
  });

  it("não vende o que está reservado para pedido do site @spec:AC-069", async () => {
    const u = await staff();
    const p = await makeProduct({ stockOnHand: 2, stockReserved: 2 });
    const { orderId } = await openTable(1, u);
    await expect(addItems(orderId, [{ productId: p.id, quantity: 1 }], u)).rejects.toThrow(/acabou|estoque/i);
  });

  it("cada lançamento gera comanda com mesa, garçom e só os itens novos @spec:AC-070", async () => {
    const u = await staff();
    const a = await makeProduct({ name: "Bolo de pote", stockOnHand: 9 });
    const b = await makeProduct({ name: "Brigadeiro", stockOnHand: 9 });
    const { orderId } = await openTable(5, u);
    await addItems(orderId, [{ productId: a.id, quantity: 1 }], u);
    await addItems(orderId, [{ productId: b.id, quantity: 3, note: "pra viagem" }], u);
    const fila = (await jobs()).sort((x, y) => +x.createdAt - +y.createdAt);
    expect(fila).toHaveLength(2);
    const segunda = JSON.parse(fila[1].content);
    expect(fila[1].kind).toBe("TABLE");
    expect(segunda.title).toBe("MESA 5");
    expect(segunda.subtitle).toContain("Ana");
    expect(segunda.lines).toEqual([{ quantity: 3, name: "Brigadeiro", note: "pra viagem" }]);
  });
});

describe("tirar item", () => {
  it("devolve o estoque, diminui a conta e guarda quem tirou e o motivo @spec:AC-071", async () => {
    const u = await staff();
    const p = await makeProduct({ priceCents: 500, stockOnHand: 4 });
    const { orderId } = await openTable(2, u);
    await addItems(orderId, [{ productId: p.id, quantity: 2 }], u);
    const item = (await getTable(2, u))!.items[0];
    await expect(removeItem(item.id, "  ", u)).rejects.toThrow(TableError);
    await removeItem(item.id, "cliente desistiu", u);
    expect((await getProductRow(p.id)).stockOnHand).toBe(4);
    expect((await getTable(2, u))?.totalCents).toBe(0);
    const volta = (await movementsOf(p.id)).find((m) => m.type === "CANCEL_RETURN");
    expect(volta).toMatchObject({ quantity: 2, userId: u.id, reason: "cliente desistiu", orderId });
    const aviso = (await jobs()).find((j) => j.kind === "TABLE_REMOVAL");
    expect(JSON.parse(aviso!.content).title).toBe("MESA 2 · CANCELADO");
  });
});

describe("cancelar mesa", () => {
  it("garçom cancela mesa sem itens; com itens só a dona, devolvendo o estoque @spec:AC-077", async () => {
    const g = await staff();
    const dona = await admin();
    const vazia = await openTable(1, g);
    await cancelTable(vazia.orderId, g);
    expect((await listTables(g)).find((t) => t.number === 1)?.orderId).toBeNull();

    const p = await makeProduct({ stockOnHand: 3 });
    const cheia = await openTable(2, g);
    await addItems(cheia.orderId, [{ productId: p.id, quantity: 2 }], g);
    await expect(cancelTable(cheia.orderId, g)).rejects.toThrow(ForbiddenError);
    await cancelTable(cheia.orderId, dona);
    expect((await getProductRow(p.id)).stockOnHand).toBe(3);
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, cheia.orderId));
    expect(o.status).toBe("CANCELED");
  });
});

describe("número de mesas", () => {
  it("dona muda para 10 e para 6; mesa ocupada não sai; funcionária não muda @spec:AC-080", async () => {
    const dona = await admin();
    const g = await staff();
    await setTableCount(10, dona);
    expect((await listTables(g)).map((t) => t.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await openTable(8, g);
    await expect(setTableCount(6, dona)).rejects.toThrow(/8/);
    expect((await listTables(g)).length).toBe(10);
    await expect(setTableCount(6, g)).rejects.toThrow(ForbiddenError);
  });

  it("ao reduzir com mesas livres, as de cima somem @spec:AC-080", async () => {
    const dona = await admin();
    await setTableCount(6, dona);
    expect((await listTables(dona)).map((t) => t.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
