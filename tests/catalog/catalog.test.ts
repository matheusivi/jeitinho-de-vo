import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/lib/db";
import { createCategory, listCategories } from "@/lib/catalog/categories";
import { createProduct, slugify, updateProduct } from "@/lib/catalog/products";
import { resetDb } from "../setup";

beforeEach(resetDb);

const base = { description: "", priceCents: 1400, unitLabel: "fatia", active: true };

describe("slugify", () => {
  it("tira acentos e espaços", () => {
    expect(slugify("Fatia de Torta de Limão")).toBe("fatia-de-torta-de-limao");
  });
});

describe("categorias", () => {
  it("cria com slug e posição no fim", async () => {
    const a = await createCategory({ name: "Fatias" });
    const b = await createCategory({ name: "Bolos recheados" });
    expect(a.ok && b.ok).toBe(true);
    const list = await listCategories();
    expect(list.map((c) => c.slug)).toEqual(["fatias", "bolos-recheados"]);
  });

  it("recusa nome vazio e nome repetido", async () => {
    expect((await createCategory({ name: "  " })).ok).toBe(false);
    await createCategory({ name: "Fatias" });
    expect((await createCategory({ name: "fatias" })).ok).toBe(false);
  });
});

describe("produtos", () => {
  async function cat() {
    const r = await createCategory({ name: "Fatias" });
    if (!r.ok) throw new Error();
    return r.category.id;
  }

  it("cria produto com estoque zerado", async () => {
    const r = await createProduct({ ...base, name: "Torta de limão", categoryId: await cat() });
    expect(r.ok).toBe(true);
    const [p] = await db.select().from(schema.products);
    expect(p).toMatchObject({ slug: "torta-de-limao", priceCents: 1400, stockOnHand: 0, stockReserved: 0 });
  });

  it("dá slugs diferentes para nomes iguais", async () => {
    const categoryId = await cat();
    await createProduct({ ...base, name: "Brownie", categoryId });
    await createProduct({ ...base, name: "Brownie", categoryId });
    const slugs = (await db.select().from(schema.products)).map((p) => p.slug).sort();
    expect(slugs).toEqual(["brownie", "brownie-2"]);
  });

  it.each([0, -100, 12.5])("recusa preço %s", async (priceCents) => {
    const r = await createProduct({ ...base, priceCents, name: "X válido", categoryId: await cat() });
    expect(r.ok).toBe(false);
    expect(await db.select().from(schema.products)).toHaveLength(0);
  });

  it("recusa nome vazio e categoria inexistente", async () => {
    expect((await createProduct({ ...base, name: " ", categoryId: await cat() })).ok).toBe(false);
    expect((await createProduct({ ...base, name: "Bolo", categoryId: "nao-existe" })).ok).toBe(false);
  });

  it("atualiza preço sem mexer no estoque nem no slug", async () => {
    const categoryId = await cat();
    const r = await createProduct({ ...base, name: "Brownie", categoryId });
    if (!r.ok) throw new Error();
    await db.update(schema.products).set({ stockOnHand: 7 });
    const u = await updateProduct(r.product.id, { ...base, name: "Brownie de Ninho", priceCents: 1300, categoryId });
    expect(u.ok).toBe(true);
    const [p] = await db.select().from(schema.products);
    expect(p).toMatchObject({ name: "Brownie de Ninho", slug: "brownie", priceCents: 1300, stockOnHand: 7 });
  });
});
