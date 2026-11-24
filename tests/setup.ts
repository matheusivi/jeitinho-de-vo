import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function resetDb(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE ingredient_movements, recipe_items, recipes, ingredients, settings, stock_movements, order_items, orders, products, categories,
    neighborhoods, sessions, login_challenges, recovery_codes, login_attempts, users RESTART IDENTITY CASCADE`);
}
