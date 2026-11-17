import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { products, categories } = schema;

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  unitLabel: string;
  imageKey: string | null;
  available: number;
};
export type MenuCategory = { id: string; name: string; slug: string; items: MenuItem[] };

const availableSql = sql<number>`${products.stockOnHand} - ${products.stockReserved}`;

/** Cardápio público: só categorias e produtos ativos com estoque disponível. */
export async function getMenu(): Promise<MenuCategory[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      unitLabel: products.unitLabel,
      imageKey: products.imageKey,
      available: availableSql,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.active, true), eq(categories.active, true), gt(availableSql, 0)))
    .orderBy(asc(categories.position), asc(categories.name), asc(products.name));

  const menu: MenuCategory[] = [];
  for (const { categoryId, categoryName, categorySlug, ...item } of rows) {
    let cat = menu.find((c) => c.id === categoryId);
    if (!cat) menu.push((cat = { id: categoryId, name: categoryName, slug: categorySlug, items: [] }));
    cat.items.push(item);
  }
  return menu;
}

/** Preço e disponível atuais dos produtos da sacola (só os que seguem à venda). */
export async function getFreshProducts(ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 30);
  if (unique.length === 0) return [];
  return db
    .select({
      id: products.id,
      name: products.name,
      priceCents: products.priceCents,
      unitLabel: products.unitLabel,
      imageKey: products.imageKey,
      available: availableSql,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(inArray(products.id, unique), eq(products.active, true), eq(categories.active, true)));
}
