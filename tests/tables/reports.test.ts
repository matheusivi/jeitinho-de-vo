import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ForbiddenError } from "@/lib/auth/types";
import { monthlyReport, productReport } from "@/lib/reports/monthly";
import { listOrdersForPanel } from "@/lib/orders/views";
import { advanceOrder, cancelOrder, markReceived } from "@/lib/orders/transitions";
import { getPublicOrder } from "@/lib/orders/public";
import { addItems, getTable, openTable } from "@/lib/tables/tables";
import { payTable } from "@/lib/tables/payments";
import { resetDb } from "../setup";
import { makeProduct, makeUser } from "../helpers";

const admin = () => makeUser("ADMIN").then((u) => ({ id: u.id, name: u.name, role: "ADMIN" as const }));
const staff = () => makeUser("STAFF").then((u) => ({ id: u.id, name: u.name, role: "STAFF" as const }));
const DAY = new Date("2026-11-10T15:00:00-04:00");

async function mesaFechada(numero: number, fechar = true) {
  const g = await staff();
  const p = await makeProduct({ name: `Bolo ${numero}`, priceCents: 1500, stockOnHand: 10 });
  const { orderId } = await openTable(numero, g);
  await addItems(orderId, [{ productId: p.id, quantity: 2 }], g);
  if (fechar) await payTable(orderId, { tender: "CASH", amountCents: 3000 }, g);
  // fixa o dia para o teste não depender da data em que roda
  await db.update(schema.orders).set({ createdAt: DAY, ...(fechar ? { receivedAt: DAY } : {}) }).where(eq(schema.orders.id, orderId));
  return { orderId, g };
}

beforeEach(async () => {
  await resetDb();
  await db.insert(schema.diningTables).values([{ number: 1 }, { number: 2 }]);
});

describe("mesas nos relatórios e fora de Pedidos", () => {
  it("mesa fechada entra no relatório; mesa aberta ainda não @spec:AC-081", async () => {
    const dona = await admin();
    await mesaFechada(1);
    await mesaFechada(2, false);
    const r = await monthlyReport(2026, 11, dona);
    const dia = r.days.find((d) => d.date === "2026-11-10")!;
    expect(dia).toMatchObject({ orders: 1, soldCents: 3000, productCents: 3000, receivedCents: 3000, pendingCents: 0, items: 2 });
    expect(dia.byMethod).toEqual({ IN_STORE: 3000 });
    const prod = await productReport(2026, 11, dona);
    expect(prod.map((p) => p.name)).toEqual(["Bolo 1"]);
  });

  it("tela de Pedidos mostra só os do site e não deixa mexer em mesa @spec:AC-081", async () => {
    const dona = await admin();
    const { orderId } = await mesaFechada(2, false);
    await db.update(schema.orders).set({ createdAt: new Date() }).where(eq(schema.orders.id, orderId));
    expect(await listOrdersForPanel(dona, { day: new Date() })).toEqual([]);
    await expect(advanceOrder(orderId, "PREPARING", dona)).rejects.toThrow(/mesa/i);
    await expect(cancelOrder(orderId, dona)).rejects.toThrow(/mesa/i);
    await expect(markReceived(orderId, 100, dona)).rejects.toThrow(/mesa/i);
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    expect(await getPublicOrder(o.code)).toBeNull();
  });

  it("funcionária vê preços e total na mesa, mas não relatórios @spec:AC-082", async () => {
    const { g } = await mesaFechada(1, false);
    const mesa = await getTable(1, g);
    expect(mesa?.totalCents).toBe(3000);
    expect(mesa?.items[0].unitPriceCents).toBe(1500);
    expect(mesa?.items[0]).not.toHaveProperty("unitCostCents");
    await expect(monthlyReport(2026, 11, g)).rejects.toThrow(ForbiddenError);
  });
});
