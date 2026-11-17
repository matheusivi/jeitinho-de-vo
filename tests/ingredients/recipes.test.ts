import { beforeEach, describe, expect, it } from "vitest";
import { getRecipe, RecipeError, saveRecipe } from "@/lib/ingredients/recipes";
import { purchase } from "@/lib/ingredients/ingredients";
import { produce } from "@/lib/stock/stock";
import { ForbiddenError } from "@/lib/auth/types";
import { resetDb } from "../setup";
import { getIngredientRow, getProductRow, ingredientMovementsOf, makeIngredient, makeProduct, makeUser, movementsOf } from "../helpers";

const admin = () => makeUser("ADMIN").then((u) => ({ id: u.id, name: u.name, role: "ADMIN" as const }));
const staff = () => makeUser("STAFF").then((u) => ({ id: u.id, name: u.name, role: "STAFF" as const }));
const KG = 1_000_000;

beforeEach(resetDb);

describe("receita", () => {
  it("salva rendimento e insumos e substitui na edição", async () => {
    const a = await admin();
    const p = await makeProduct();
    const farinha = await makeIngredient({ name: "Farinha" });
    const ovo = await makeIngredient({ name: "Ovo", baseUnit: "un" });
    await saveRecipe(p.id, { yieldQty: 10, notes: "forno 180°", items: [{ ingredientId: farinha.id, qtyMilli: KG }, { ingredientId: ovo.id, qtyMilli: 4000 }] }, a);
    await saveRecipe(p.id, { yieldQty: 12, items: [{ ingredientId: farinha.id, qtyMilli: 900_000 }] }, a);
    const r = await getRecipe(p.id);
    expect(r).toMatchObject({ yieldQty: 12, notes: "" });
    expect(r!.items).toEqual([expect.objectContaining({ ingredientId: farinha.id, name: "Farinha", qtyMilli: 900_000, baseUnit: "g" })]);
  });

  it("recusa rendimento zero, insumo repetido e quantidade zero @spec:AC-037", async () => {
    const a = await admin();
    const p = await makeProduct();
    const f = await makeIngredient();
    await expect(saveRecipe(p.id, { yieldQty: 0, items: [{ ingredientId: f.id, qtyMilli: 1000 }] }, a)).rejects.toThrow(/rendimento/i);
    await expect(saveRecipe(p.id, { yieldQty: 1, items: [{ ingredientId: f.id, qtyMilli: 1000 }, { ingredientId: f.id, qtyMilli: 2000 }] }, a)).rejects.toThrow(/repetido/i);
    await expect(saveRecipe(p.id, { yieldQty: 1, items: [{ ingredientId: f.id, qtyMilli: 0 }] }, a)).rejects.toBeInstanceOf(RecipeError);
    await expect(saveRecipe(p.id, { yieldQty: 1, items: [] }, a)).rejects.toThrow(/insumo/i);
    await expect(saveRecipe(p.id, { yieldQty: 1, items: [{ ingredientId: "nao-existe", qtyMilli: 1000 }] }, a)).rejects.toBeInstanceOf(RecipeError);
    await expect(saveRecipe("nao-existe", { yieldQty: 1, items: [{ ingredientId: f.id, qtyMilli: 1000 }] }, a)).rejects.toBeInstanceOf(RecipeError);
    expect(await getRecipe(p.id)).toBeNull();
  });

  it("só a dona edita receita", async () => {
    const p = await makeProduct();
    const f = await makeIngredient();
    await expect(saveRecipe(p.id, { yieldQty: 1, items: [{ ingredientId: f.id, qtyMilli: 1000 }] }, await staff())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("baixa na produção", () => {
  it("baixa na proporção do rendimento, ligada à produção e com custo @spec:AC-038", async () => {
    const a = await admin();
    const s = await staff();
    const p = await makeProduct();
    const farinha = await makeIngredient({ name: "Farinha" });
    await purchase(farinha.id, 5 * KG, 3000, a); // R$ 6,00 o kg
    await saveRecipe(p.id, { yieldQty: 10, items: [{ ingredientId: farinha.id, qtyMilli: KG }] }, a);
    const result = await produce(p.id, 5, s.id);
    expect(result).toEqual({ hasRecipe: true, negatives: [] });
    expect((await getIngredientRow(farinha.id)).stockMilli).toBe(4_500_000);
    expect((await getProductRow(p.id)).stockOnHand).toBe(5);
    const [prodMove] = await movementsOf(p.id);
    const out = (await ingredientMovementsOf(farinha.id)).find((m) => m.type === "PRODUCTION");
    expect(out).toMatchObject({ qtyMilli: -500_000, costCents: 300, stockMovementId: prodMove.id, userId: s.id });
  });

  it("insumo insuficiente fica negativo e o retorno avisa @spec:AC-039", async () => {
    const a = await admin();
    const p = await makeProduct();
    const farinha = await makeIngredient({ name: "Farinha", stockMilli: 200_000 });
    const acucar = await makeIngredient({ name: "Açúcar", stockMilli: 5 * KG });
    await saveRecipe(p.id, { yieldQty: 1, items: [{ ingredientId: farinha.id, qtyMilli: 300_000 }, { ingredientId: acucar.id, qtyMilli: 100_000 }] }, a);
    const result = await produce(p.id, 1, a.id);
    expect(result.negatives).toEqual([{ ingredientId: farinha.id, name: "Farinha", baseUnit: "g", stockMilli: -100_000 }]);
    expect((await getProductRow(p.id)).stockOnHand).toBe(1);
  });

  it("produto sem receita produz e avisa que não baixou insumos @spec:AC-040", async () => {
    const p = await makeProduct();
    const u = await staff();
    const result = await produce(p.id, 3, u.id);
    expect(result).toEqual({ hasRecipe: false, negatives: [] });
    expect((await getProductRow(p.id)).stockOnHand).toBe(3);
  });

  it("arredonda a meia receita sem perder precisão", async () => {
    const a = await admin();
    const p = await makeProduct();
    const ovo = await makeIngredient({ name: "Ovo", baseUnit: "un", stockMilli: 12_000 });
    await saveRecipe(p.id, { yieldQty: 8, items: [{ ingredientId: ovo.id, qtyMilli: 3000 }] }, a);
    await produce(p.id, 4, a.id);
    expect((await getIngredientRow(ovo.id)).stockMilli).toBe(10_500); // saiu 1,5 ovo
  });

  it("se a produção falhar, nenhum insumo sai", async () => {
    const a = await admin();
    const p = await makeProduct();
    const f = await makeIngredient({ stockMilli: KG });
    await saveRecipe(p.id, { yieldQty: 1, items: [{ ingredientId: f.id, qtyMilli: 1000 }] }, a);
    await expect(produce(p.id, 0, a.id)).rejects.toThrow();
    expect((await getIngredientRow(f.id)).stockMilli).toBe(KG);
  });
});
