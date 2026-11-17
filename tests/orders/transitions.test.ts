import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createOrder } from "@/lib/orders/create";
import { advanceOrder, cancelOrder, markReceived, TransitionError } from "@/lib/orders/transitions";
import { listOrdersForPanel, whatsappStatusLink } from "@/lib/orders/views";
import { ForbiddenError } from "@/lib/auth/types";
import { resetDb } from "../setup";
import { getProductRow, makeProduct, makeUser, movementsOf } from "../helpers";

const NOW = new Date("2026-11-17T12:00:00-04:00");
let ip = 0;
const admin = () => makeUser("ADMIN").then((u) => ({ id: u.id, name: u.name, role: "ADMIN" as const }));
const staff = () => makeUser("STAFF").then((u) => ({ id: u.id, name: u.name, role: "STAFF" as const }));

async function novoPedido(fulfillment: "DELIVERY" | "PICKUP" = "PICKUP", qty = 2) {
  const p = await makeProduct({ priceCents: 1000, stockOnHand: 5 });
  let neighborhoodId: string | undefined;
  if (fulfillment === "DELIVERY") {
    const [nb] = await db.insert(schema.neighborhoods).values({ name: `B${++ip}`, feeCents: 500 }).returning();
    neighborhoodId = nb.id;
  }
  const r = await createOrder(
    { customerName: "Maria Souza", customerPhone: "(67) 99999-0000", fulfillment, addressLine: "Rua A, 1", neighborhoodId, items: [{ productId: p.id, quantity: qty }] },
    { now: NOW, ip: `ip-${++ip}` },
  );
  if (!r.ok) throw new Error(r.message);
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.code, r.code));
  return { order: o, product: p };
}
const statusOf = async (id: string) => (await db.select().from(schema.orders).where(eq(schema.orders.id, id)))[0];

beforeEach(resetDb);

describe("andamento do pedido", () => {
  it("segue a sequência de entrega", async () => {
    const u = await staff();
    const { order } = await novoPedido("DELIVERY");
    for (const s of ["PREPARING", "OUT_FOR_DELIVERY", "DONE"] as const) await advanceOrder(order.id, s, u);
    expect((await statusOf(order.id)).status).toBe("DONE");
  });

  it("segue a sequência de retirada", async () => {
    const u = await staff();
    const { order } = await novoPedido("PICKUP");
    for (const s of ["PREPARING", "READY_FOR_PICKUP", "DONE"] as const) await advanceOrder(order.id, s, u);
    expect((await statusOf(order.id)).status).toBe("DONE");
  });

  it("recusa pulos e caminhos errados", async () => {
    const u = await staff();
    const { order } = await novoPedido("DELIVERY");
    await expect(advanceOrder(order.id, "DONE", u)).rejects.toBeInstanceOf(TransitionError);
    await advanceOrder(order.id, "PREPARING", u);
    await expect(advanceOrder(order.id, "READY_FOR_PICKUP", u)).rejects.toBeInstanceOf(TransitionError);
    await advanceOrder(order.id, "OUT_FOR_DELIVERY", u);
    await advanceOrder(order.id, "DONE", u);
    await expect(advanceOrder(order.id, "PREPARING", u)).rejects.toBeInstanceOf(TransitionError);
  });

  it("pedido inexistente é erro de transição", async () => {
    await expect(advanceOrder("nao-existe", "PREPARING", await staff())).rejects.toBeInstanceOf(TransitionError);
  });
});

describe("cancelamento", () => {
  it("devolve o estoque uma vez só", async () => {
    const u = await staff();
    const { order, product } = await novoPedido("PICKUP", 2);
    expect((await getProductRow(product.id)).stockOnHand).toBe(3);
    await cancelOrder(order.id, u);
    expect((await statusOf(order.id)).status).toBe("CANCELED");
    expect((await getProductRow(product.id)).stockOnHand).toBe(5);
    expect((await movementsOf(product.id)).filter((m) => m.type === "CANCEL_RETURN")).toHaveLength(1);
    await expect(cancelOrder(order.id, u)).rejects.toBeInstanceOf(TransitionError);
    expect((await getProductRow(product.id)).stockOnHand).toBe(5);
  });

  it("não cancela pedido concluído", async () => {
    const u = await staff();
    const { order } = await novoPedido("PICKUP");
    for (const s of ["PREPARING", "READY_FOR_PICKUP", "DONE"] as const) await advanceOrder(order.id, s, u);
    await expect(cancelOrder(order.id, u)).rejects.toBeInstanceOf(TransitionError);
  });

  it("dois cancelamentos ao mesmo tempo devolvem uma vez só", async () => {
    const u = await staff();
    const { order, product } = await novoPedido("PICKUP", 2);
    await Promise.allSettled([cancelOrder(order.id, u), cancelOrder(order.id, u)]);
    expect((await getProductRow(product.id)).stockOnHand).toBe(5);
  });
});

describe("recebimento", () => {
  it("só a administradora registra, com valor válido", async () => {
    const { order } = await novoPedido("PICKUP");
    await expect(markReceived(order.id, 2000, await staff())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(markReceived(order.id, -1, await admin())).rejects.toBeInstanceOf(TransitionError);
    await markReceived(order.id, 2000, await admin());
    expect(await statusOf(order.id)).toMatchObject({ paymentStatus: "RECEIVED", receivedCents: 2000 });
  });
});

describe("listagem do painel", () => {
  it("funcionário não recebe nenhum campo de dinheiro", async () => {
    await novoPedido("DELIVERY");
    const list = await listOrdersForPanel(await staff(), { day: NOW });
    expect(list).toHaveLength(1);
    const keys = new Set<string>();
    const walk = (v: unknown) => {
      if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); }
    };
    walk(list);
    expect([...keys].filter((k) => /Cents$|paymentStatus|price/i.test(k))).toEqual([]);
    expect(list[0]).toMatchObject({ customerName: "Maria Souza", items: [{ name: expect.any(String), quantity: 2 }] });
  });

  it("administradora recebe os valores", async () => {
    await novoPedido("PICKUP");
    const [o] = await listOrdersForPanel(await admin(), { day: NOW });
    expect(o).toMatchObject({ totalCents: 2000, paymentStatus: "PENDING" });
  });

  it("filtra pelo dia no fuso da loja", async () => {
    await novoPedido("PICKUP");
    expect(await listOrdersForPanel(await admin(), { day: new Date("2026-11-18T12:00:00-04:00") })).toHaveLength(0);
  });
});

describe("link do WhatsApp", () => {
  it("monta o número com DDI e a mensagem com código e primeiro nome", () => {
    const url = whatsappStatusLink({ customerPhone: "67999990000", code: "ABC234", status: "OUT_FOR_DELIVERY", customerName: "Maria Souza" });
    expect(url.startsWith("https://wa.me/5567999990000?text=")).toBe(true);
    const msg = decodeURIComponent(url.split("text=")[1]);
    expect(msg).toContain("Maria");
    expect(msg).toContain("ABC234");
    expect(msg).toContain("saiu para entrega");
  });
});
