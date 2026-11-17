import { sql } from "drizzle-orm";
import {
  bigint, boolean, check, doublePrecision, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

export const roleEnum = pgEnum("role", ["ADMIN", "STAFF"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "PRODUCTION", "SALE", "ADJUSTMENT", "CANCEL_RETURN",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DONE", "CANCELED",
]);
export const fulfillmentEnum = pgEnum("fulfillment", ["DELIVERY", "PICKUP"]);
export const paymentMethodEnum = pgEnum("payment_method", ["ON_DELIVERY"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "RECEIVED"]);

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const loginAttempts = pgTable(
  "login_attempts",
  { id: id(), key: text("key").notNull(), createdAt: createdAt() },
  (t) => [index("login_attempts_key_created_idx").on(t.key, t.createdAt)],
);

export const categories = pgTable("categories", {
  id: id(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    unitLabel: text("unit_label").notNull().default("unidade"),
    categoryId: text("category_id").notNull().references(() => categories.id),
    imageKey: text("image_key"),
    active: boolean("active").notNull().default(true),
    stockOnHand: integer("stock_on_hand").notNull().default(0),
    stockReserved: integer("stock_reserved").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "products_stock_check",
      sql`${t.stockOnHand} >= 0 AND ${t.stockReserved} >= 0 AND ${t.stockReserved} <= ${t.stockOnHand}`,
    ),
    check("products_price_check", sql`${t.priceCents} > 0`),
  ],
);

export const neighborhoods = pgTable("neighborhoods", {
  id: id(),
  name: text("name").notNull().unique(),
  feeCents: integer("fee_cents").notNull(),
  active: boolean("active").notNull().default(true),
});

export const orders = pgTable(
  "orders",
  {
    id: id(),
    code: text("code").notNull(),
    status: orderStatusEnum("status").notNull().default("CONFIRMED"),
    fulfillment: fulfillmentEnum("fulfillment").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    addressLine: text("address_line"),
    neighborhoodId: text("neighborhood_id").references(() => neighborhoods.id),
    notes: text("notes"),
    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("ON_DELIVERY"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
    receivedCents: integer("received_cents"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdIp: text("created_ip"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("orders_code_idx").on(t.code), index("orders_created_idx").on(t.createdAt)],
);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  /** Custo do produto pela receita na hora da venda; nulo quando não havia custo completo. */
  unitCostCents: integer("unit_cost_cents"),
  quantity: integer("quantity").notNull(),
});

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    productId: text("product_id").notNull().references(() => products.id),
    type: stockMovementTypeEnum("type").notNull(),
    quantity: integer("quantity").notNull(),
    reason: text("reason"),
    orderId: text("order_id").references(() => orders.id),
    userId: text("user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId, t.createdAt)],
);

export const baseUnitEnum = pgEnum("base_unit", ["g", "ml", "un"]);
export const ingredientMovementTypeEnum = pgEnum("ingredient_movement_type", [
  "PURCHASE", "PRODUCTION", "LOSS", "CONSUMPTION", "COUNT",
]);

const milli = (name: string) => bigint(name, { mode: "number" });

/** Insumo: quantidades em milésimos da unidade base (g, ml ou un). */
export const ingredients = pgTable(
  "ingredients",
  {
    id: id(),
    name: text("name").notNull().unique(),
    baseUnit: baseUnitEnum("base_unit").notNull(),
    packageName: text("package_name"),
    packageSizeMilli: milli("package_size_milli"),
    stockMilli: milli("stock_milli").notNull().default(0),
    minMilli: milli("min_milli").notNull().default(0),
    /** Custo médio ponderado em centavos por 1 unidade base (1 g, 1 ml, 1 un). Nulo até a primeira compra. */
    avgCostCentsPerBase: doublePrecision("avg_cost_cents_per_base"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("ingredients_min_check", sql`${t.minMilli} >= 0`),
    check(
      "ingredients_package_check",
      sql`(${t.packageName} IS NULL AND ${t.packageSizeMilli} IS NULL) OR (${t.packageName} IS NOT NULL AND ${t.packageSizeMilli} > 0)`,
    ),
  ],
);

export const ingredientMovements = pgTable(
  "ingredient_movements",
  {
    id: id(),
    ingredientId: text("ingredient_id").notNull().references(() => ingredients.id),
    type: ingredientMovementTypeEnum("type").notNull(),
    /** Com sinal: positivo entra, negativo sai. */
    qtyMilli: milli("qty_milli").notNull(),
    /** Na compra, o valor pago; nas saídas, o custo estimado pelo custo médio do momento. */
    costCents: integer("cost_cents"),
    reason: text("reason"),
    stockMovementId: text("stock_movement_id").references(() => stockMovements.id),
    userId: text("user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("ingredient_movements_ing_idx").on(t.ingredientId, t.createdAt),
    index("ingredient_movements_created_idx").on(t.createdAt),
  ],
);

export const recipes = pgTable(
  "recipes",
  {
    id: id(),
    productId: text("product_id").notNull().unique().references(() => products.id, { onDelete: "cascade" }),
    /** Quantas unidades do produto uma receita rende. */
    yieldQty: integer("yield_qty").notNull(),
    notes: text("notes").notNull().default(""),
    updatedAt: updatedAt(),
  },
  (t) => [check("recipes_yield_check", sql`${t.yieldQty} > 0`)],
);

export const recipeItems = pgTable(
  "recipe_items",
  {
    id: id(),
    recipeId: text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id").notNull().references(() => ingredients.id),
    qtyMilli: milli("qty_milli").notNull(),
  },
  (t) => [
    uniqueIndex("recipe_items_unique_idx").on(t.recipeId, t.ingredientId),
    check("recipe_items_qty_check", sql`${t.qtyMilli} > 0`),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});
