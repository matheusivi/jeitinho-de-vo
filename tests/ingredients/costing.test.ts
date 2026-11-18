import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { analyzeMargin, costRecipe, listProductCosts } from "@/lib/ingredients/costing";
import { getRecipe, saveRecipe } from "@/lib/ingredients/recipes";
import { purchase } from "@/lib/ingredients/ingredients";
import { getCmvTargetBps, setCmvTargetBps } from "@/lib/settings";
import { createOrder } from "@/lib/orders/create";
import { ForbiddenError } from "@/lib/auth/types";
import { resetDb } from "../setup";
import { makeIngredient, makeProduct, makeUser } from "../helpers";

const admin = () => makeUser("ADMIN").then((u) => ({ id: u.id, name: u.name, role: "ADMIN" as const }));
const staff = () => makeUser("STAFF").then((u) => ({ id: u.id, name: u.name, role: "STAFF" as const }));
const KG = 1_000_000;

beforeEach(resetDb);

async function boloComReceita(priceCents = 1200) {
  const a = await admin();
  const p = await makeProduct({ priceCents, stockOnHand: 10 });
  // manteiga: 1 kg na receita a R$ 20,00/kg; farinha: 2 kg a R$ 5,00/kg
  const manteiga = await makeIngredient({ name: "Manteiga", avgCostCentsPerBase: 2 });
  const farinha = await makeIngredient({ name: "Farinha", avgCostCentsPerBase: 0.5 });
  await saveRecipe(p.id, { yieldQty: 10, items: [{ ingredientId: manteiga.id, qtyMilli: KG }, { ingredientId: farinha.id, qtyMilli: 2 * KG }] }, a);
  return { a, p, manteiga, farinha };
}

describe("custo do produto", () => {
  it("custo por unidade com o peso de cada insumo @spec:AC-043", async () => {
    const { p } = await boloComReceita();
    const c = costRecipe((await getRecipe(p.id))!);
    expect(c).toMatchObject({ complete: true, batchCostCents: 3000, unitCostCents: 300, missing: [] });
    expect(c.lines.map((l) => [l.name, l.lineCostCents, Number(l.sharePct.toFixed(1))])).toEqual([
      ["Manteiga", 2000, 66.7],
      ["Farinha", 1000, 33.3],
    ]);
  });

  it("insumo sem preço deixa o custo incompleto, não zero @spec:AC-045", async () => {
    const a = await admin();
    const p = await makeProduct();
    const ok = await makeIngredient({ name: "Açúcar", avgCostCentsPerBase: 0.4 });
    const semPreco = await makeIngredient({ name: "Cacau" });
    await saveRecipe(p.id, { yieldQty: 1, items: [{ ingredientId: ok.id, qtyMilli: KG }, { ingredientId: semPreco.id, qtyMilli: 100_000 }] }, a);
    const c = costRecipe((await getRecipe(p.id))!);
    expect(c).toMatchObject({ complete: false, unitCostCents: null, missing: ["Cacau"] });
    expect(c.knownCostCents).toBe(400);
  });
});

describe("margem", () => {
  it("CMV, margem, markup e sinal acima da meta @spec:AC-044", async () => {
    expect(analyzeMargin(1200, 300, 3500)).toEqual({
      cmvPct: 25, marginPct: 75, markup: 4, grossProfitCents: 900, aboveTarget: false, priceForTargetCents: 858,
    });
    expect(analyzeMargin(600, 300, 3500)).toMatchObject({ cmvPct: 50, aboveTarget: true, priceForTargetCents: 858 });
    expect(analyzeMargin(600, null, 3500)).toBeNull();
  });

  it("meta começa em 35% e só a dona muda", async () => {
    expect(await getCmvTargetBps()).toBe(3500);
    await setCmvTargetBps(3000, await admin());
    expect(await getCmvTargetBps()).toBe(3000);
    await expect(setCmvTargetBps(4000, await staff())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setCmvTargetBps(0, await admin())).rejects.toThrow();
  });

  it("lista custo e margem de todos os produtos, só para a dona", async () => {
    const { a, p } = await boloComReceita(1200);
    const semReceita = await makeProduct({ name: "Copo da felicidade", priceCents: 1500 });
    const list = await listProductCosts(a);
    const bolo = list.find((x) => x.productId === p.id)!;
    expect(bolo).toMatchObject({ hasRecipe: true, cost: { unitCostCents: 300 }, margin: { cmvPct: 25, aboveTarget: false } });
    expect(list.find((x) => x.productId === semReceita.id)).toMatchObject({ hasRecipe: false, cost: null, margin: null });
    await expect(listProductCosts(await staff())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("custo guardado na venda", () => {
  it("o item do pedido mantém o custo da hora da venda @spec:AC-046", async () => {
    const { a, p, manteiga } = await boloComReceita();
    const r = await createOrder(
      { customerName: "Maria Souza", customerPhone: "(67) 99999-0000", fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 2 }] },
      { now: new Date("2026-11-17T12:00:00-04:00"), ip: "10.9.9.9" },
    );
    expect(r.ok).toBe(true);
    await purchase(manteiga.id, KG, 9000, a); // manteiga sobe bastante
    const [item] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.productId, p.id));
    expect(item.unitCostCents).toBe(300);
  });

  it("produto sem receita vende com custo vazio", async () => {
    const p = await makeProduct({ stockOnHand: 3 });
    await createOrder(
      { customerName: "Maria Souza", customerPhone: "(67) 99999-0000", fulfillment: "PICKUP", items: [{ productId: p.id, quantity: 1 }] },
      { now: new Date("2026-11-17T12:00:00-04:00"), ip: "10.9.9.8" },
    );
    const [item] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.productId, p.id));
    expect(item.unitCostCents).toBeNull();
  });
});
