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

const DEMO: { cat: string; name: string; desc: string; price: number; unit: string; foto?: string; estoque: number }[] = [
  { cat: "Fatias", name: "Fatia mousse de chocolate crocante", desc: "Mousse de chocolate ao leite sobre base de biscoito, com ganache.", price: 1600, unit: "fatia, 180 g", foto: "fatia-mousse", estoque: 6 },
  { cat: "Fatias", name: "Fatia de torta de limão", desc: "Creme de limão azedinho, chantilly e raspas por cima.", price: 1400, unit: "fatia, 160 g", foto: "fatia-limao", estoque: 3 },
  { cat: "Fatias", name: "Fatia de chocolate com brigadeiro", desc: "Massa molhadinha, recheio e cobertura de brigadeiro.", price: 1500, unit: "fatia, 180 g", foto: "fatia-chocolate", estoque: 8 },
  { cat: "Fatias", name: "Brownie recheado de Ninho", desc: "Duas camadas de brownie com creme de leite Ninho.", price: 1300, unit: "unidade", foto: "brownie-ninho", estoque: 0 },
  { cat: "Fatias", name: "Toalha felpuda com chocolate", desc: "Bolo gelado de coco embrulhado, com fios de chocolate.", price: 900, unit: "unidade", foto: "toalha-felpuda", estoque: 12 },
  { cat: "Copos da Felicidade", name: "Copo da Felicidade de morango", desc: "Bolo branco, creme de baunilha, morango e chantilly.", price: 1400, unit: "copo, 250 ml", foto: "copo-morango", estoque: 5 },
  { cat: "Copos da Felicidade", name: "Copo da Felicidade de pudim", desc: "Brownie no fundo, creme de Ninho e um pudim em cima.", price: 1500, unit: "copo, 250 ml", foto: "copo-pudim", estoque: 2 },
];

async function main() {
  const [admin] = await db.select().from(schema.users).where(eq(schema.users.role, "ADMIN"));
  if (!admin) throw new Error("Rode npm run db:seed antes.");
  for (const d of DEMO) {
    const [exists] = await db.select().from(schema.products).where(eq(schema.products.name, d.name));
    if (exists) continue;
    const [cat] = await db.select().from(schema.categories).where(eq(schema.categories.name, d.cat));
    if (!cat) throw new Error(`Categoria ${d.cat} não existe`);
    const imageKey = d.foto
      ? (await processProductImage(await readFile(path.join("scripts/demo-fotos", `${d.foto}.webp`)))).key
      : undefined;
    const r = await createProduct({ name: d.name, description: d.desc, priceCents: d.price, unitLabel: d.unit, categoryId: cat.id, active: true, imageKey });
    if (!r.ok) throw new Error(r.message);
    if (d.estoque > 0) await produce(r.product.id, d.estoque, admin.id);
  }
  console.log("Demonstração pronta.");
}

main().finally(() => pool.end());
