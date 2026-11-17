import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createOrder, type CreateOrderInput } from "@/lib/orders/create";
import { listNeighborhoods } from "@/lib/orders/fees";
import { resetDb } from "../setup";
import { getProductRow, makeProduct, movementsOf } from "../helpers";

const ABERTO = new Date("2026-11-17T12:00:00-04:00"); // terça
const DOMINGO = new Date("2026-11-22T12:00:00-04:00");
let ipN = 0;
const ctx = (now = ABERTO) => ({ now, ip: `10.0.0.${++ipN}` });

async function bairro(name = "Centro", feeCents = 500, active = true) {
  const [b] = await db.insert(schema.neighborhoods).values({ name, feeCents, active }).returning();
  return b;
}

const cliente = { customerName: "Maria Souza", customerPhone: "(67) 99999-0000" };

beforeEach(resetDb);

describe("bairros", () => {
  it("lista só os ativos em ordem alfabética", async () => {
    await bairro("Vila Beatriz", 700);
    await bairro("Centro", 500);
    await bairro("Inativo", 100, false);
    expect((await listNeighborhoods()).map((b) => b.name)).toEqual(["Centro", "Vila Beatriz"]);
  });
});

describe("criar pedido", () => {
  it("retirada: calcula total, baixa estoque e registra a venda", async () => {
    const a = await makeProduct({ priceCents: 1400, stockOnHand: 3 });
    const b = await makeProduct({ priceCents: 900, stockOnHand: 5 });
    const r = await createOrder(
      { ...cliente, fulfillment: "PICKUP", items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }] },
      ctx(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    const [o] = await db.select().from(schema.orders);
    expect(o).toMatchObject({
      status: "CONFIRMED", fulfillment: "PICKUP", subtotalCents: 3700, deliveryFeeCents: 0, totalCents: 3700,
      paymentMethod: "ON_DELIVERY", paymentStatus: "PENDING", customerPhone: "67999990000", addressLine: null,
    });
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
    expect(items.find((i) => i.productId === a.id)).toMatchObject({ unitPriceCents: 1400, quantity: 2 });
    expect(await getProductRow(a.id)).toMatchObject({ stockOnHand: 1, stockReserved: 0 });
    expect((await movementsOf(a.id)).map((m) => [m.type, m.quantity])).toEqual([["SALE", -2]]);
  });

  it("entrega: soma a taxa do bairro", async () => {
    const p = await makeProduct({ priceCents: 1000, stockOnHand: 2 });
    const nb = await bairro("Centro", 650);
    const r = await createOrder(
      { ...cliente, fulfillment: "DELIVERY", addressLine: "Rua A, 10", neighborhoodId: nb.id, items: [{ productId: p.id, quantity: 1 }] },
      ctx(),
    );
    expect(r.ok).toBe(true);
    const [o] = await db.select().from(schema.orders);
    expect(o).toMatchObject({ subtotalCents: 1000, deliveryFeeCents: 650, totalCents: 1650, neighborhoodId: nb.id });
  });

  it("ignora preço e taxa enviados pelo navegador", async () => {
    const p = await makeProduct({ priceCents: 1000, stockOnHand: 2 });
    const nb = await bairro("Centro", 650);
    const adulterado = {
      ...cliente, fulfillment: "DELIVERY", addressLine: "Rua A, 10", neighborhoodId: nb.id,
      items: [{ productId: p.id, quantity: 1, priceCents: 1 }],
      priceCents: 1, deliveryFeeCents: 0, totalCents: 1, subtotalCents: 1,
    } as unknown as CreateOrderInput;
    expect((await createOrder(adulterado, ctx())).ok).toBe(true);
    const [o] = await db.select().from(schema.orders);
    expect(o.totalCents).toBe(1650);
  });

  it.each([
    ["zero", [{ q: 0 }]], ["negativa", [{ q: -1 }]], ["fracionada", [{ q: 1.5 }]], ["acima de 50", [{ q: 51 }]], ["lista vazia", []],
  ])("recusa quantidade %s sem mexer no estoque", async (_n, qs) => {
    const p = await makeProduct({ stockOnHand: 100 });
    const items = (qs as { q: number }[]).map(({ q }) => ({ productId: p.id, quantity: q }));
    const r = await createOrder({ ...cliente, fulfillment: "PICKUP", items }, ctx());
    expect(r).toMatchObject({ ok: false, error: "INVALIDO" });
    expect(await getProductRow(p.id)).toMatchObject({ stockOnHand: 100, stockReserved: 0 });
    expect(await db.select().from(schema.orders)).toHaveLength(0);
  });

  it("recusa mais de 30 produtos diferentes", async () => {
    const items = [];
    for (let i = 0; i < 31; i++) items.push({ productId: (await makeProduct({ stockOnHand: 1 })).id, quantity: 1 });
    expect(await createOrder({ ...cliente, fulfillment: "PICKUP", items }, ctx())).toMatchObject({ error: "INVALIDO" });
  });

  it("recusa telefone e nome inválidos", async () => {
    const p = await makeProduct({ stockOnHand: 5 });
    const items = [{ productId: p.id, quantity: 1 }];
    expect(await createOrder({ ...cliente, customerPhone: "1234", fulfillment: "PICKUP", items }, ctx())).toMatchObject({ error: "INVALIDO" });
    expect(await createOrder({ ...cliente, customerName: "A", fulfillment: "PICKUP", items }, ctx())).toMatchObject({ error: "INVALIDO" });
  });

  it("fora do horário recusa no servidor", async () => {
    const p = await makeProduct({ stockOnHand: 5 });
    const r = await createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 1 }] }, ctx(DOMINGO));
    expect(r).toMatchObject({ ok: false, error: "FECHADO" });
    expect(await db.select().from(schema.orders)).toHaveLength(0);
  });

  it("esgotado devolve qual produto e não cria nada", async () => {
    const a = await makeProduct({ stockOnHand: 5 });
    const b = await makeProduct({ stockOnHand: 1 });
    const r = await createOrder(
      { ...cliente, fulfillment: "PICKUP", items: [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 2 }] },
      ctx(),
    );
    expect(r).toMatchObject({ ok: false, error: "ESGOTADO", productId: b.id });
    expect(await getProductRow(a.id)).toMatchObject({ stockOnHand: 5, stockReserved: 0 });
    expect(await db.select().from(schema.orders)).toHaveLength(0);
  });

  it("produto inativo ou inexistente é inválido", async () => {
    const p = await makeProduct({ stockOnHand: 5, active: false });
    expect(await createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 1 }] }, ctx())).toMatchObject({ ok: false, error: "INVALIDO" });
    expect(await createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: "x", quantity: 1 }] }, ctx())).toMatchObject({ ok: false, error: "INVALIDO" });
  });

  it("entrega exige endereço e bairro ativo", async () => {
    const p = await makeProduct({ stockOnHand: 5 });
    const off = await bairro("Fechado", 100, false);
    const items = [{ productId: p.id, quantity: 1 }];
    expect(await createOrder({ ...cliente, fulfillment: "DELIVERY", neighborhoodId: off.id, addressLine: "Rua A, 1", items }, ctx())).toMatchObject({ error: "INVALIDO" });
    const on = await bairro("Centro", 500);
    expect(await createOrder({ ...cliente, fulfillment: "DELIVERY", neighborhoodId: on.id, items }, ctx())).toMatchObject({ error: "INVALIDO" });
  });

  it("limita a 5 pedidos por IP em 10 minutos", async () => {
    const p = await makeProduct({ stockOnHand: 50 });
    const c = { now: ABERTO, ip: "9.9.9.9" };
    for (let i = 0; i < 5; i++) {
      expect((await createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 1 }] }, c)).ok).toBe(true);
    }
    expect(await createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 1 }] }, c)).toMatchObject({ error: "LIMITE" });
  });
});

describe("correções da revisão", () => {
  it("20 pedidos simultâneos do mesmo IP: só 5 passam", async () => {
    const p = await makeProduct({ stockOnHand: 1000 });
    const c = { now: ABERTO, ip: "5.5.5.5" };
    const r = await Promise.all(
      Array.from({ length: 20 }, () => createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 1 }] }, c)),
    );
    expect(r.filter((x) => x.ok)).toHaveLength(5);
    expect(r.filter((x) => !x.ok && x.error === "LIMITE")).toHaveLength(15);
    expect((await getProductRow(p.id)).stockOnHand).toBe(995);
  });

  it("pedido recusado não gasta a cota do IP", async () => {
    const p = await makeProduct({ stockOnHand: 50 });
    const c = { now: ABERTO, ip: "4.4.4.4" };
    for (let i = 0; i < 5; i++) await createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: "nao-existe", quantity: 1 }] }, c);
    expect((await createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 1 }] }, c)).ok).toBe(true);
  });

  it("produto de categoria desativada não é vendido", async () => {
    const p = await makeProduct({ stockOnHand: 5 });
    await db.update(schema.categories).set({ active: false }).where(eq(schema.categories.id, p.categoryId));
    const r = await createOrder({ ...cliente, fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 1 }] }, ctx());
    expect(r).toMatchObject({ ok: false, error: "INVALIDO" });
    expect((await getProductRow(p.id)).stockOnHand).toBe(5);
  });

  it("se o total mudou desde a sacola, recusa em vez de cobrar diferente", async () => {
    const p = await makeProduct({ priceCents: 1200, stockOnHand: 5 });
    const nb = await bairro("Centro", 500);
    const base = { ...cliente, fulfillment: "DELIVERY" as const, addressLine: "Rua A, 1", neighborhoodId: nb.id, items: [{ productId: p.id, quantity: 2 }] };
    const r = await createOrder({ ...base, expectedTotalCents: 2000 + 500 }, ctx());
    expect(r).toMatchObject({ ok: false, error: "PRECO_MUDOU" });
    expect(await db.select().from(schema.orders)).toHaveLength(0);
    expect((await getProductRow(p.id)).stockOnHand).toBe(5);
    expect((await createOrder({ ...base, expectedTotalCents: 2400 + 500 }, ctx())).ok).toBe(true);
  });
});
