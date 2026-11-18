/**
 * Dados de demonstração para mostrar a loja funcionando: produtos com foto e estoque.
 * Uso: npm run demo  (não rode em produção)
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, pool, schema } from "../src/lib/db";
import { processProductImage } from "../src/lib/catalog/images";
import { createProduct } from "../src/lib/catalog/products";
import { produce } from "../src/lib/stock/stock";
import { createIngredient, purchase } from "../src/lib/ingredients/ingredients";
import { saveRecipe } from "../src/lib/ingredients/recipes";
import { createOrder } from "../src/lib/orders/create";
import { advanceOrder, markReceived } from "../src/lib/orders/transitions";

const KG = 1_000_000;
/** Insumos de demonstração. Preços ilustrativos, só para a dona ver o cálculo funcionando. */
const INSUMOS: { name: string; base: "g" | "ml" | "un"; pkg?: [string, number]; min: number; compra: [number, number] }[] = [
  { name: "Leite condensado", base: "g", pkg: ["lata", 395_000], min: 4 * 395_000, compra: [12 * 395_000, 9000] },
  { name: "Creme de leite", base: "g", pkg: ["caixa", 200_000], min: 6 * 200_000, compra: [12 * 200_000, 4200] },
  { name: "Chocolate em pó 50%", base: "g", min: 500_000, compra: [2 * KG, 7800] },
  { name: "Farinha de trigo", base: "g", pkg: ["pacote", 5 * KG], min: 5 * KG, compra: [10 * KG, 3200] },
  { name: "Açúcar", base: "g", min: 2 * KG, compra: [5 * KG, 2400] },
  { name: "Ovo", base: "un", min: 24_000, compra: [60_000, 3300] },
  { name: "Manteiga", base: "g", min: 500_000, compra: [2 * KG, 9600] },
  { name: "Limão", base: "un", min: 10_000, compra: [30_000, 1500] },
  { name: "Pote 250 ml com tampa", base: "un", min: 20_000, compra: [100_000, 6500] },
  { name: "Embalagem de fatia", base: "un", min: 20_000, compra: [100_000, 4500] },
];
const RECEITAS: Record<string, { rende: number; itens: [string, number][] }> = {
  "Fatia de chocolate com brigadeiro": {
    rende: 12,
    itens: [["Farinha de trigo", 400_000], ["Açúcar", 300_000], ["Ovo", 4000], ["Chocolate em pó 50%", 250_000], ["Leite condensado", 2 * 395_000], ["Creme de leite", 200_000], ["Manteiga", 100_000], ["Embalagem de fatia", 12_000]],
  },
  "Fatia de torta de limão": {
    rende: 10,
    itens: [["Farinha de trigo", 250_000], ["Manteiga", 150_000], ["Açúcar", 80_000], ["Leite condensado", 2 * 395_000], ["Limão", 6000], ["Creme de leite", 400_000], ["Embalagem de fatia", 10_000]],
  },
  "Copo da Felicidade de morango": {
    rende: 8,
    itens: [["Farinha de trigo", 200_000], ["Açúcar", 200_000], ["Ovo", 3000], ["Leite condensado", 395_000], ["Creme de leite", 400_000], ["Pote 250 ml com tampa", 8000]],
  },
};

const DEMO: { cat: string; name: string; desc: string; price: number; unit: string; foto?: string; estoque: number }[] = [
  { cat: "Fatias", name: "Fatia mousse de chocolate crocante", desc: "Mousse de chocolate ao leite sobre base de biscoito, com ganache.", price: 1600, unit: "fatia, 180 g", foto: "fatia-mousse", estoque: 6 },
  { cat: "Fatias", name: "Fatia de torta de limão", desc: "Creme de limão azedinho, chantilly e raspas por cima.", price: 1400, unit: "fatia, 160 g", foto: "fatia-limao", estoque: 3 },
  { cat: "Fatias", name: "Fatia de chocolate com brigadeiro", desc: "Massa molhadinha, recheio e cobertura de brigadeiro.", price: 1500, unit: "fatia, 180 g", foto: "fatia-chocolate", estoque: 8 },
  { cat: "Fatias", name: "Brownie recheado de Ninho", desc: "Duas camadas de brownie com creme de leite Ninho.", price: 1300, unit: "unidade", foto: "brownie-ninho", estoque: 0 },
  { cat: "Fatias", name: "Toalha felpuda com chocolate", desc: "Bolo gelado de coco embrulhado, com fios de chocolate.", price: 900, unit: "unidade", foto: "toalha-felpuda", estoque: 12 },
  { cat: "Copos da Felicidade", name: "Copo da Felicidade de morango", desc: "Bolo branco, creme de baunilha, morango e chantilly.", price: 1400, unit: "copo, 250 ml", foto: "copo-morango", estoque: 5 },
  { cat: "Copos da Felicidade", name: "Copo da Felicidade de pudim", desc: "Brownie no fundo, creme de Ninho e um pudim em cima.", price: 1500, unit: "copo, 250 ml", foto: "copo-pudim", estoque: 2 },
];

/** `--produtos=3`: cria só os 3 primeiros produtos, com foto e estoque, sem insumos, receitas nem pedidos. */
const ONLY_PRODUCTS = Number(process.argv.find((a) => a.startsWith("--produtos="))?.split("=")[1] ?? 0);

async function main() {
  const [admin] = await db.select().from(schema.users).where(eq(schema.users.role, "ADMIN"));
  if (!admin) throw new Error("Rode npm run db:seed antes.");
  const adminUser = { id: admin.id, name: admin.name, role: "ADMIN" as const };
  for (const i of ONLY_PRODUCTS ? [] : INSUMOS) {
    const [exists] = await db.select().from(schema.ingredients).where(eq(schema.ingredients.name, i.name));
    if (exists) continue;
    const ing = await createIngredient(
      { name: i.name, baseUnit: i.base, packageName: i.pkg?.[0] ?? null, packageSizeMilli: i.pkg?.[1] ?? null, minMilli: i.min },
      adminUser,
    );
    await purchase(ing.id, i.compra[0], i.compra[1], adminUser, "Demonstração");
  }
  const ingredientRows = await db.select().from(schema.ingredients);
  const ingId = (n: string) => ingredientRows.find((r) => r.name === n)!.id;
  for (const d of ONLY_PRODUCTS ? DEMO.slice(0, ONLY_PRODUCTS) : DEMO) {
    const [exists] = await db.select().from(schema.products).where(eq(schema.products.name, d.name));
    if (exists) continue;
    const [cat] = await db.select().from(schema.categories).where(eq(schema.categories.name, d.cat));
    if (!cat) throw new Error(`Categoria ${d.cat} não existe`);
    const imageKey = d.foto
      ? (await processProductImage(await readFile(path.join("scripts/demo-fotos", `${d.foto}.webp`)))).key
      : undefined;
    const r = await createProduct({ name: d.name, description: d.desc, priceCents: d.price, unitLabel: d.unit, categoryId: cat.id, active: true, imageKey });
    if (!r.ok) throw new Error(r.message);
    const rec = ONLY_PRODUCTS ? undefined : RECEITAS[d.name];
    if (rec) {
      await saveRecipe(r.product.id, { yieldQty: rec.rende, items: rec.itens.map(([n, q]) => ({ ingredientId: ingId(n), qtyMilli: q })) }, adminUser);
    }
    if (d.estoque > 0) await produce(r.product.id, d.estoque, admin.id);
  }
  // alguns pedidos de hoje para os relatórios terem o que mostrar
  const [anyOrder] = await db.select({ id: schema.orders.id }).from(schema.orders).limit(1);
  if (!anyOrder && !ONLY_PRODUCTS) {
    const prods = await db.select().from(schema.products);
    const byName = (n: string) => prods.find((p) => p.name === n)!;
    const pedidos: [string, number][][] = [
      [["Fatia de chocolate com brigadeiro", 2], ["Toalha felpuda com chocolate", 1]],
      [["Fatia de torta de limão", 1], ["Copo da Felicidade de morango", 2]],
      [["Fatia mousse de chocolate crocante", 3]],
    ];
    const noon = new Date();
    noon.setHours(12);
    if (noon.getDay() === 0) noon.setDate(noon.getDate() + 1);
    for (const [i, itens] of pedidos.entries()) {
      const r = await createOrder(
        { customerName: "Cliente Demonstração", customerPhone: "(67) 99999-0000", fulfillment: "PICKUP", items: itens.map(([n, q]) => ({ productId: byName(n).id, quantity: q })) },
        { now: noon, ip: `demo-${i}` },
      );
      if (!r.ok) { console.warn("Pedido de demonstração recusado:", r.message); continue; }
      if (i < 2) {
        const [o] = await db.select().from(schema.orders).where(eq(schema.orders.code, r.code));
        for (const to of ["PREPARING", "READY_FOR_PICKUP", "DONE"] as const) await advanceOrder(o.id, to, adminUser);
        await markReceived(o.id, o.totalCents, adminUser);
      }
    }
  }
  console.log("Demonstração pronta.");
}

main().finally(() => pool.end());
