import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

let n = 0;

export async function makeCategory(name = `Categoria ${++n}`) {
  const [c] = await db.insert(schema.categories).values({ name, slug: `cat-${++n}`, position: n }).returning();
  return c;
}

export async function makeProduct(over: Partial<typeof schema.products.$inferInsert> = {}) {
  const categoryId = over.categoryId ?? (await makeCategory()).id;
  const [p] = await db
    .insert(schema.products)
    .values({ name: `Produto ${++n}`, slug: `produto-${n}`, priceCents: 1000, ...over, categoryId })
    .returning();
  return p;
}

export async function makeUser(role: "ADMIN" | "STAFF" = "ADMIN") {
  const [u] = await db
    .insert(schema.users)
    .values({ name: role, email: `u${++n}@teste.com`, passwordHash: "x", role })
    .returning();
  return u;
}

export async function getProductRow(id: string) {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id));
  return p;
}

export function movementsOf(productId: string) {
  return db.select().from(schema.stockMovements).where(eq(schema.stockMovements.productId, productId));
}
