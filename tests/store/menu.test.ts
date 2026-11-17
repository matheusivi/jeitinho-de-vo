import { beforeEach, describe, expect, it } from "vitest";
import { getMenu } from "@/lib/store/menu";
import { resetDb } from "../setup";
import { makeCategory, makeProduct } from "../helpers";

beforeEach(resetDb);

describe("cardápio", () => {
  it("mostra só o que tem disponível", async () => {
    const cat = await makeCategory("Fatias");
    const ok = await makeProduct({ categoryId: cat.id, name: "Limão", stockOnHand: 3, stockReserved: 1 });
    await makeProduct({ categoryId: cat.id, name: "Zerado", stockOnHand: 0 });
    await makeProduct({ categoryId: cat.id, name: "Todo reservado", stockOnHand: 2, stockReserved: 2 });
    await makeProduct({ categoryId: cat.id, name: "Desativado", stockOnHand: 5, active: false });

    const menu = await getMenu();
    expect(menu).toHaveLength(1);
    expect(menu[0].name).toBe("Fatias");
    expect(menu[0].items.map((i) => i.name)).toEqual(["Limão"]);
    expect(menu[0].items[0]).toMatchObject({ id: ok.id, available: 2, priceCents: 1000 });
  });

  it("esconde categoria vazia e categoria desativada", async () => {
    await makeCategory("Vazia");
    const off = await makeCategory("Desligada");
    await makeProduct({ categoryId: off.id, stockOnHand: 5 });
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    await db.update(schema.categories).set({ active: false }).where(eq(schema.categories.id, off.id));
    expect(await getMenu()).toEqual([]);
  });

  it("não expõe campos internos de estoque", async () => {
    await makeProduct({ stockOnHand: 3 });
    const [cat] = await getMenu();
    expect(Object.keys(cat.items[0]).sort()).toEqual(
      ["available", "description", "id", "imageKey", "name", "priceCents", "unitLabel"].sort(),
    );
  });
});

import { getFreshProducts } from "@/lib/store/menu";

describe("conferência da sacola", () => {
  it("devolve preço e disponível atuais só de produtos à venda", async () => {
    const a = await makeProduct({ priceCents: 1200, stockOnHand: 4, stockReserved: 1 });
    const off = await makeProduct({ stockOnHand: 4, active: false });
    const fresh = await getFreshProducts([a.id, off.id, "nao-existe"]);
    expect(fresh).toEqual([{ id: a.id, name: a.name, priceCents: 1200, unitLabel: a.unitLabel, imageKey: null, available: 3 }]);
  });

  it("lista vazia não consulta nada", async () => {
    expect(await getFreshProducts([])).toEqual([]);
  });
});
