import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { db, schema } from "@/lib/db";
import { monthlyReport, productReport, yearReport } from "@/lib/reports/monthly";
import { buildMonthWorkbook } from "@/lib/reports/excel";
import { ForbiddenError } from "@/lib/auth/types";
import { resetDb } from "../setup";
import { makeIngredient, makeProduct, makeUser } from "../helpers";

const admin = () => makeUser("ADMIN").then((u) => ({ id: u.id, name: u.name, role: "ADMIN" as const }));
const staff = () => makeUser("STAFF").then((u) => ({ id: u.id, name: u.name, role: "STAFF" as const }));
const at = (iso: string) => new Date(iso);
let n = 0;

type ItemSpec = { productId: string; name: string; price: number; cost: number | null; qty: number };
async function pedido(opts: {
  createdAt: string; items: ItemSpec[]; fee?: number; status?: "CONFIRMED" | "DONE" | "CANCELED"; receivedAt?: string; receivedCents?: number;
}) {
  const subtotal = opts.items.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = opts.fee ?? 0;
  const [o] = await db.insert(schema.orders).values({
    code: `T${++n}`, status: opts.status ?? "DONE", fulfillment: fee ? "DELIVERY" : "PICKUP",
    customerName: "Cliente Teste", customerPhone: "67999990000", subtotalCents: subtotal, deliveryFeeCents: fee,
    totalCents: subtotal + fee, paymentStatus: opts.receivedAt ? "RECEIVED" : "PENDING",
    receivedAt: opts.receivedAt ? at(opts.receivedAt) : null, receivedCents: opts.receivedAt ? (opts.receivedCents ?? subtotal + fee) : null,
    createdAt: at(opts.createdAt),
  }).returning();
  await db.insert(schema.orderItems).values(opts.items.map((i) => ({
    orderId: o.id, productId: i.productId, productName: i.name, unitPriceCents: i.price, unitCostCents: i.cost, quantity: i.qty,
  })));
  return o;
}

async function compra(ingredientId: string, cents: number, createdAt: string, qtyMilli = 1_000_000) {
  await db.insert(schema.ingredientMovements).values({ ingredientId, type: "PURCHASE", qtyMilli, costCents: cents, createdAt: at(createdAt) });
}

async function cenario() {
  const bolo = await makeProduct({ name: "Bolo de pote", priceCents: 1200 });
  const fatia = await makeProduct({ name: "Fatia", priceCents: 1000 });
  const B = { productId: bolo.id, name: bolo.name, price: 1200, cost: 300 };
  const F = { productId: fatia.id, name: fatia.name, price: 1000, cost: null };
  // 03/11: pedido entregue e recebido no mesmo dia (2 bolos + taxa 500)
  await pedido({ createdAt: "2026-11-03T10:00:00-04:00", items: [{ ...B, qty: 2 }], fee: 500, receivedAt: "2026-11-03T15:00:00-04:00" });
  // 03/11 às 23h30 local (já é dia 04 em UTC): conta no dia 03; recebido no dia 04
  await pedido({ createdAt: "2026-11-03T23:30:00-04:00", items: [{ ...F, qty: 1 }], receivedAt: "2026-11-04T09:00:00-04:00" });
  // 04/11: ainda a receber
  await pedido({ createdAt: "2026-11-04T11:00:00-04:00", status: "CONFIRMED", items: [{ ...B, qty: 1 }] });
  // 04/11: cancelado, fica fora
  await pedido({ createdAt: "2026-11-04T12:00:00-04:00", status: "CANCELED", items: [{ ...B, qty: 5 }] });
  // outubro: fora do mês
  await pedido({ createdAt: "2026-10-30T10:00:00-04:00", items: [{ ...B, qty: 3 }], receivedAt: "2026-10-30T11:00:00-04:00" });
  const farinha = await makeIngredient({ name: "Farinha" });
  await compra(farinha.id, 4500, "2026-11-04T08:00:00-04:00");
  await compra(farinha.id, 2000, "2026-10-15T08:00:00-04:00");
  // saídas de insumo de novembro: produção 800, perda 200
  await db.insert(schema.ingredientMovements).values([
    { ingredientId: farinha.id, type: "PRODUCTION", qtyMilli: -100, costCents: 800, createdAt: at("2026-11-02T08:00:00-04:00") },
    { ingredientId: farinha.id, type: "LOSS", qtyMilli: -10, costCents: 200, reason: "queimou", createdAt: at("2026-11-04T08:00:00-04:00") },
  ]);
  return { bolo, fatia };
}

beforeEach(resetDb);

describe("relatório do mês", () => {
  it("uma linha por dia com vendas, caixa e compras, sem cancelados e no fuso da loja @spec:AC-048", async () => {
    await cenario();
    const r = await monthlyReport(2026, 11, await admin());
    expect(r.days).toHaveLength(30);
    const d3 = r.days[2];
    const d4 = r.days[3];
    expect(d3).toMatchObject({ date: "2026-11-03", orders: 2, items: 3, soldCents: 3900, feesCents: 500, pendingCents: 0 });
    expect(d4).toMatchObject({ date: "2026-11-04", orders: 1, items: 1, soldCents: 1200, pendingCents: 1200, purchasesCents: 4500 });
    expect(r.days[0]).toMatchObject({ orders: 0, soldCents: 0, receivedCents: 0, balanceCents: 0 });
    expect(r.totals).toMatchObject({ orders: 3, soldCents: 5100, receivedCents: 3900, purchasesCents: 4500, balanceCents: -600, pendingCents: 1200 });
  });

  it("recebimento entra no caixa no dia em que foi recebido @spec:AC-049", async () => {
    await cenario();
    const r = await monthlyReport(2026, 11, await admin());
    expect(r.days[2]).toMatchObject({ receivedCents: 2900, balanceCents: 2900 });
    expect(r.days[3]).toMatchObject({ receivedCents: 1000, balanceCents: 1000 - 4500 });
  });

  it("CMV previsto pela receita e real pelas saídas de insumo @spec:AC-052", async () => {
    await cenario();
    const { cmv } = await monthlyReport(2026, 11, await admin());
    // previsto: só itens com custo: 3 bolos × 300 = 900 sobre 3 × 1200 = 3600 → 25%
    expect(cmv).toMatchObject({ theoreticalCostCents: 900, theoreticalRevenueCents: 3600, theoreticalPct: 25 });
    // real: saídas 800 + 200 = 1000 sobre vendas de produtos (sem taxa) 2400 + 1000 + 1200 = 4600 → 21,7%
    expect(cmv).toMatchObject({ realCostCents: 1000, lossCents: 200, productRevenueCents: 4600, realPct: 21.7 });
    expect(cmv.diffPts).toBeCloseTo(-3.3, 1);
    expect(cmv.itemsWithoutCost).toBe(1);
  });
});

describe("relatório por produto e do ano", () => {
  it("quantidade, faturamento, custo, margem e CMV por produto @spec:AC-050", async () => {
    const { bolo, fatia } = await cenario();
    const rows = await productReport(2026, 11, await admin());
    expect(rows.find((r) => r.productId === bolo.id)).toMatchObject({ qty: 3, revenueCents: 3600, costCents: 900, cmvPct: 25, marginPct: 75, costComplete: true });
    expect(rows.find((r) => r.productId === fatia.id)).toMatchObject({ qty: 1, revenueCents: 1000, costCents: null, cmvPct: null, costComplete: false });
    expect(rows[0].productId).toBe(bolo.id); // maior faturamento primeiro
  });

  it("vendido, recebido, compras e saldo de cada mês @spec:AC-051", async () => {
    await cenario();
    const y = await yearReport(2026, await admin());
    expect(y.months).toHaveLength(12);
    expect(y.months[9]).toMatchObject({ month: 10, soldCents: 3600, receivedCents: 3600, purchasesCents: 2000, balanceCents: 1600 });
    expect(y.months[10]).toMatchObject({ month: 11, soldCents: 5100, receivedCents: 3900, purchasesCents: 4500, balanceCents: -600 });
    expect(y.months[0]).toMatchObject({ soldCents: 0 });
  });
});

describe("exportação e acesso", () => {
  it("gera .xlsx com as abas e números como número @spec:AC-053", async () => {
    await cenario();
    const buf = await buildMonthWorkbook(2026, 11, await admin());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Dias", "Produtos", "Compras", "Insumos"]);
    const dias = wb.getWorksheet("Dias")!;
    const header = dias.getRow(3).values as unknown[];
    expect(header).toContain("Vendido (R$)");
    const row3 = dias.getRows(4, 30)!.find((r) => r.getCell(1).value === "03/11/2026")!;
    expect(typeof row3.getCell(header.indexOf("Vendido (R$)")).value).toBe("number");
    expect(row3.getCell(header.indexOf("Vendido (R$)")).value).toBe(39);
    const csv = JSON.stringify(wb.getWorksheet("Produtos")!.getSheetValues());
    expect(csv).not.toMatch(/67999990000|Cliente Teste/);
  });

  it("funcionária não acessa relatórios nem exportação @spec:AC-054", async () => {
    const s = await staff();
    await expect(monthlyReport(2026, 11, s)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(productReport(2026, 11, s)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(yearReport(2026, s)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(buildMonthWorkbook(2026, 11, s)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("recusa mês inválido", async () => {
    const a = await admin();
    await expect(monthlyReport(2026, 13, a)).rejects.toThrow();
    await expect(monthlyReport(1999, 1, a)).rejects.toThrow();
  });
});
