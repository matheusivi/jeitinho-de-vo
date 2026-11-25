import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { addItems, getTable, listTables, openTable, removeItem, TableError } from "@/lib/tables/tables";
import { payTable, splitEqual } from "@/lib/tables/payments";
import { resetDb } from "../setup";
import { makeProduct, makeUser } from "../helpers";

const staff = () => makeUser("STAFF").then((u) => ({ id: u.id, name: u.name, role: "STAFF" as const }));

async function mesaCom(precos: number[]) {
  const u = await staff();
  await db.insert(schema.diningTables).values([{ number: 1 }]);
  const { orderId } = await openTable(1, u);
  for (const priceCents of precos) {
    const p = await makeProduct({ priceCents, stockOnHand: 10 });
    await addItems(orderId, [{ productId: p.id, quantity: 1 }], u);
  }
  return { u, orderId };
}
const orderRow = async (id: string) => (await db.select().from(schema.orders).where(eq(schema.orders.id, id)))[0];

beforeEach(resetDb);

describe("fechar a conta", () => {
  it("conta inteira fecha a mesa, libera e entra como recebido @spec:AC-072", async () => {
    const { u, orderId } = await mesaCom([3000, 1500]);
    const r = await payTable(orderId, { tender: "PIX", amountCents: 4500 }, u);
    expect(r).toEqual({ closed: true, remainingCents: 0 });
    const o = await orderRow(orderId);
    expect(o).toMatchObject({ status: "DONE", paymentStatus: "RECEIVED", receivedCents: 4500, closedBy: u.id });
    expect(o.receivedAt).toBeInstanceOf(Date);
    expect((await listTables(u))[0].orderId).toBeNull();
  });

  it("divide R$ 100 em 3 sem sobrar centavo @spec:AC-073", () => {
    expect(splitEqual(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitEqual(10000, 3).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(splitEqual(10001, 2)).toEqual([5001, 5000]);
    expect(() => splitEqual(100, 0)).toThrow();
  });

  it("partes iguais pagas uma a uma fecham a mesa na última @spec:AC-073", async () => {
    const { u, orderId } = await mesaCom([10000]);
    const partes = splitEqual(10000, 3);
    expect((await payTable(orderId, { tender: "CASH", amountCents: partes[0] }, u)).closed).toBe(false);
    expect((await payTable(orderId, { tender: "CARD", amountCents: partes[1] }, u)).remainingCents).toBe(3333);
    expect((await payTable(orderId, { tender: "PIX", amountCents: partes[2] }, u)).closed).toBe(true);
  });

  it("cada um paga os seus itens; item não é pago duas vezes @spec:AC-074", async () => {
    const { u, orderId } = await mesaCom([1200, 800]);
    const [a, b] = (await getTable(1, u))!.items;
    const r1 = await payTable(orderId, { tender: "CASH", itemIds: [a.id] }, u);
    expect(r1).toEqual({ closed: false, remainingCents: 800 });
    await expect(payTable(orderId, { tender: "PIX", itemIds: [a.id] }, u)).rejects.toThrow(TableError);
    const mesa = await getTable(1, u);
    expect(mesa!.items.find((i) => i.id === a.id)?.paid).toBe(true);
    expect(mesa!.payments[0]).toMatchObject({ tender: "CASH", amountCents: 1200, itemNames: [a.name] });
    expect((await payTable(orderId, { tender: "PIX", itemIds: [b.id] }, u)).closed).toBe(true);
  });

  it("item já pago não pode ser tirado da mesa @spec:AC-074", async () => {
    const { u, orderId } = await mesaCom([1200, 800]);
    const [a] = (await getTable(1, u))!.items;
    await payTable(orderId, { tender: "CASH", itemIds: [a.id] }, u);
    await expect(removeItem(a.id, "engano", u)).rejects.toThrow(/pago/);
  });

  it("recusa pagar mais do que falta @spec:AC-075", async () => {
    const { u, orderId } = await mesaCom([2000]);
    await expect(payTable(orderId, { tender: "CASH", amountCents: 2500 }, u)).rejects.toThrow(/falta/);
    await expect(payTable(orderId, { tender: "CASH", amountCents: 0 }, u)).rejects.toThrow(TableError);
    expect((await orderRow(orderId)).status).toBe("CONFIRMED");
  });

  it("mesa fechada não aceita lançar, tirar nem pagar @spec:AC-076", async () => {
    const { u, orderId } = await mesaCom([1000]);
    const item = (await getTable(1, u))!.items[0];
    await payTable(orderId, { tender: "CARD", amountCents: 1000 }, u);
    const p = await makeProduct({ stockOnHand: 3 });
    await expect(addItems(orderId, [{ productId: p.id, quantity: 1 }], u)).rejects.toThrow(/fechada/);
    await expect(removeItem(item.id, "x", u)).rejects.toThrow(/fechada/);
    await expect(payTable(orderId, { tender: "CASH", amountCents: 100 }, u)).rejects.toThrow(/fechada/);
  });

  it("mesa sem itens não fecha por pagamento @spec:AC-075", async () => {
    const { u, orderId } = await mesaCom([]);
    await expect(payTable(orderId, { tender: "CASH", amountCents: 100 }, u)).rejects.toThrow(TableError);
  });
});
