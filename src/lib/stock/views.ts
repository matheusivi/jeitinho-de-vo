import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { products, categories, stockMovements, users } = schema;
export const TIMEZONE = "America/Campo_Grande";

/** Produtos ativos com o disponível, para a tela de produção. Sem valores em dinheiro. */
export function listStock() {
  return db
    .select({
      id: products.id,
      name: products.name,
      unitLabel: products.unitLabel,
      categoryName: categories.name,
      available: sql<number>`${products.stockOnHand} - ${products.stockReserved}`,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.active, true))
    .orderBy(asc(categories.position), asc(products.name));
}

/** Movimentos lançados à mão hoje (produção e ajustes), mais recentes primeiro. */
export function listTodayMovements() {
  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      reason: stockMovements.reason,
      createdAt: stockMovements.createdAt,
      productName: products.name,
      userName: users.name,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .where(
      sql`${stockMovements.type} IN ('PRODUCTION', 'ADJUSTMENT') AND ${stockMovements.createdAt} >=
        (date_trunc('day', now() AT TIME ZONE ${TIMEZONE}) AT TIME ZONE ${TIMEZONE})`,
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(100);
}
