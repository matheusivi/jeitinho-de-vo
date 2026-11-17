import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/lib/db";
import {
  createIngredient, IngredientError, listIngredients, lowStockAlerts, purchase, recordCount, recordOutflow,
  setMinimum, suggestMinimum, updateIngredient,
} from "@/lib/ingredients/ingredients";
import { ForbiddenError } from "@/lib/auth/types";
import { resetDb } from "../setup";
import { getIngredientRow, ingredientMovementsOf, makeIngredient, makeUser } from "../helpers";

const admin = () => makeUser("ADMIN").then((u) => ({ id: u.id, name: u.name, role: "ADMIN" as const }));
const staff = () => makeUser("STAFF").then((u) => ({ id: u.id, name: u.name, role: "STAFF" as const }));
const KG = 1_000_000; // 1 kg em milésimos de grama

beforeEach(resetDb);

describe("cadastro de insumo", () => {
  it("cria insumo com embalagem e mínimo", async () => {
    const a = await admin();
    const ing = await createIngredient({ name: " Leite condensado ", baseUnit: "g", packageName: "lata", packageSizeMilli: 395_000, minMilli: 790_000 }, a);
    expect(ing).toMatchObject({ name: "Leite condensado", baseUnit: "g", packageName: "lata", packageSizeMilli: 395_000, stockMilli: 0, minMilli: 790_000 });
  });

  it("recusa nome vazio, nome repetido e embalagem sem tamanho @spec:AC-030", async () => {
    const a = await admin();
    await createIngredient({ name: "Farinha", baseUnit: "g" }, a);
    await expect(createIngredient({ name: "  ", baseUnit: "g" }, a)).rejects.toThrow(/nome/i);
    await expect(createIngredient({ name: "farinha", baseUnit: "g" }, a)).rejects.toThrow(/já existe/i);
    await expect(createIngredient({ name: "Leite", baseUnit: "ml", packageName: "caixa" }, a)).rejects.toThrow(/tamanho/i);
    await expect(createIngredient({ name: "Leite", baseUnit: "ml", packageName: "caixa", packageSizeMilli: 0 }, a)).rejects.toBeInstanceOf(IngredientError);
  });

  it("só a dona cadastra e edita", async () => {
    const s = await staff();
    await expect(createIngredient({ name: "Açúcar", baseUnit: "g" }, s)).rejects.toBeInstanceOf(ForbiddenError);
    const ing = await makeIngredient();
    await expect(updateIngredient(ing.id, { name: "X", baseUnit: "g" }, s)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("não deixa trocar a unidade base depois que há movimento", async () => {
    const a = await admin();
    const ing = await makeIngredient({ baseUnit: "g" });
    await purchase(ing.id, KG, 1000, a);
    await expect(updateIngredient(ing.id, { name: ing.name, baseUnit: "ml" }, a)).rejects.toThrow(/unidade/i);
    await updateIngredient(ing.id, { name: "Farinha especial", baseUnit: "g", packageName: "pacote", packageSizeMilli: 5 * KG }, a);
    expect(await getIngredientRow(ing.id)).toMatchObject({ name: "Farinha especial", packageName: "pacote" });
  });
});

describe("compras", () => {
  it("soma ao estoque e guarda valor, data e quem lançou @spec:AC-031", async () => {
    const a = await admin();
    const ing = await makeIngredient();
    await purchase(ing.id, 5 * KG, 3000, a, "Atacadão");
    expect((await getIngredientRow(ing.id)).stockMilli).toBe(5 * KG);
    const [m] = await ingredientMovementsOf(ing.id);
    expect(m).toMatchObject({ type: "PURCHASE", qtyMilli: 5 * KG, costCents: 3000, userId: a.id, reason: "Atacadão" });
    expect(m.createdAt).toBeInstanceOf(Date);
  });

  it("custo médio pondera compras com preços diferentes @spec:AC-032", async () => {
    const a = await admin();
    const ing = await makeIngredient();
    await purchase(ing.id, 5 * KG, 3000, a);
    await purchase(ing.id, 5 * KG, 4000, a);
    const row = await getIngredientRow(ing.id);
    expect(row.avgCostCentsPerBase! * 1000).toBeCloseTo(700, 6); // R$ 7,00 por kg
  });

  it("com estoque negativo o custo passa a ser o da compra @spec:AC-033", async () => {
    const a = await admin();
    const ing = await makeIngredient({ stockMilli: -2 * KG, avgCostCentsPerBase: 0.5 });
    await purchase(ing.id, 4 * KG, 4000, a);
    const row = await getIngredientRow(ing.id);
    expect(row.stockMilli).toBe(2 * KG);
    expect(row.avgCostCentsPerBase! * 1000).toBeCloseTo(1000, 6); // R$ 10,00 por kg
  });

  it("só a dona lança compras @spec:AC-034", async () => {
    const ing = await makeIngredient();
    await expect(purchase(ing.id, KG, 1000, await staff())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await ingredientMovementsOf(ing.id)).toHaveLength(0);
  });

  it("recusa quantidade ou valor inválidos e insumo inexistente", async () => {
    const a = await admin();
    const ing = await makeIngredient();
    await expect(purchase(ing.id, 0, 1000, a)).rejects.toBeInstanceOf(IngredientError);
    await expect(purchase(ing.id, KG, 0, a)).rejects.toBeInstanceOf(IngredientError);
    await expect(purchase(ing.id, KG, 10.5, a)).rejects.toBeInstanceOf(IngredientError);
    await expect(purchase("nao-existe", KG, 1000, a)).rejects.toBeInstanceOf(IngredientError);
  });

  it("compras simultâneas não perdem quantidade nem custo", async () => {
    const a = await admin();
    const ing = await makeIngredient();
    await Promise.all(Array.from({ length: 10 }, () => purchase(ing.id, KG, 1000, a)));
    const row = await getIngredientRow(ing.id);
    expect(row.stockMilli).toBe(10 * KG);
    expect(row.avgCostCentsPerBase! * 1000).toBeCloseTo(1000, 6);
  });
});

describe("perdas, consumo e contagem", () => {
  it("perda e consumo baixam com motivo, quem lançou e custo @spec:AC-035", async () => {
    const a = await admin();
    const s = await staff();
    const ing = await makeIngredient();
    await purchase(ing.id, 10 * KG, 6000, a); // R$ 6,00 o kg
    await recordOutflow(ing.id, 500_000, "LOSS", "Caiu no chão", s);
    await recordOutflow(ing.id, 250_000, "CONSUMPTION", "Teste de receita", s);
    expect((await getIngredientRow(ing.id)).stockMilli).toBe(10 * KG - 750_000);
    const ms = (await ingredientMovementsOf(ing.id)).filter((m) => m.type !== "PURCHASE");
    expect(ms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "LOSS", qtyMilli: -500_000, costCents: 300, reason: "Caiu no chão", userId: s.id }),
        expect.objectContaining({ type: "CONSUMPTION", qtyMilli: -250_000, costCents: 150, userId: s.id }),
      ]),
    );
    await expect(recordOutflow(ing.id, 100_000, "LOSS", "  ", s)).rejects.toThrow(/motivo/i);
    await expect(recordOutflow(ing.id, 0, "LOSS", "x", s)).rejects.toBeInstanceOf(IngredientError);
  });

  it("perda sem compra anterior fica sem custo, não com custo zero", async () => {
    const ing = await makeIngredient({ stockMilli: KG });
    await recordOutflow(ing.id, 100_000, "LOSS", "Venceu", await staff());
    const [m] = await ingredientMovementsOf(ing.id);
    expect(m.costCents).toBeNull();
  });

  it("contagem corrige o estoque pela diferença @spec:AC-036", async () => {
    const a = await admin();
    const ing = await makeIngredient();
    await purchase(ing.id, 3 * KG, 3000, a);
    await recordCount(ing.id, 2_600_000, a);
    expect((await getIngredientRow(ing.id)).stockMilli).toBe(2_600_000);
    const count = (await ingredientMovementsOf(ing.id)).find((m) => m.type === "COUNT");
    expect(count).toMatchObject({ qtyMilli: -400_000, costCents: 400, userId: a.id });
    await expect(recordCount(ing.id, 2_600_000, a)).rejects.toThrow(/igual/i);
    await expect(recordCount(ing.id, KG, await staff())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("mínimo e alertas", () => {
  it("lista os que estão no mínimo ou abaixo, negativos primeiro @spec:AC-041", async () => {
    await makeIngredient({ name: "Acima", stockMilli: 3 * KG, minMilli: KG });
    await makeIngredient({ name: "Igual", stockMilli: KG, minMilli: KG });
    await makeIngredient({ name: "Abaixo", stockMilli: 200_000, minMilli: KG });
    await makeIngredient({ name: "Negativo", stockMilli: -100_000, minMilli: 0 });
    await makeIngredient({ name: "Sem mínimo", stockMilli: 0, minMilli: 0 });
    await makeIngredient({ name: "Inativo", stockMilli: 0, minMilli: KG, active: false });
    const names = (await lowStockAlerts()).map((a) => a.name);
    expect(names).toEqual(["Negativo", "Abaixo", "Igual"]);
  });

  it("sugere o consumo de 7 dias a partir dos últimos 30 @spec:AC-042", async () => {
    const a = await admin();
    const ing = await makeIngredient();
    const now = new Date("2026-11-17T12:00:00-04:00");
    const day = 24 * 3600 * 1000;
    await db.insert(schema.ingredientMovements).values([
      { ingredientId: ing.id, type: "PRODUCTION", qtyMilli: -2 * KG, createdAt: new Date(now.getTime() - 5 * day) },
      { ingredientId: ing.id, type: "LOSS", qtyMilli: -KG, createdAt: new Date(now.getTime() - 20 * day) },
      { ingredientId: ing.id, type: "PURCHASE", qtyMilli: 10 * KG, createdAt: new Date(now.getTime() - 2 * day) },
      { ingredientId: ing.id, type: "PRODUCTION", qtyMilli: -9 * KG, createdAt: new Date(now.getTime() - 40 * day) },
    ]);
    const s = await suggestMinimum(ing.id, now);
    expect(s).toMatchObject({ consumedMilli: 3 * KG, windowDays: 30, coverDays: 7, suggestedMilli: 700_000 });
    expect(s.explanation).toMatch(/30 dias/);
    await setMinimum(ing.id, s.suggestedMilli, a);
    expect((await getIngredientRow(ing.id)).minMilli).toBe(700_000);
  });
});

describe("lista de insumos", () => {
  it("funcionária vê estoque e situação, sem nenhum valor @spec:AC-047", async () => {
    const a = await admin();
    const ing = await makeIngredient({ minMilli: 2 * KG });
    await purchase(ing.id, KG, 1000, a);
    const [row] = await listIngredients(await staff());
    expect(row).toMatchObject({ name: ing.name, stockMilli: KG, status: "LOW" });
    const keys = Object.keys(row).join(" ");
    expect(keys).not.toMatch(/cost|value|cents|price/i);
    const [adminRow] = await listIngredients(a);
    expect(adminRow).toMatchObject({ stockValueCents: 1000 });
    expect(adminRow.avgCostCentsPerBase).toBeCloseTo(1, 9); // 1 centavo por grama
  });
});
