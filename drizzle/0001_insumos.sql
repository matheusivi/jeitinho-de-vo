CREATE TYPE "public"."base_unit" AS ENUM('g', 'ml', 'un');--> statement-breakpoint
CREATE TYPE "public"."ingredient_movement_type" AS ENUM('PURCHASE', 'PRODUCTION', 'LOSS', 'CONSUMPTION', 'COUNT');--> statement-breakpoint
CREATE TABLE "ingredient_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"ingredient_id" text NOT NULL,
	"type" "ingredient_movement_type" NOT NULL,
	"qty_milli" bigint NOT NULL,
	"cost_cents" integer,
	"reason" text,
	"stock_movement_id" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_unit" "base_unit" NOT NULL,
	"package_name" text,
	"package_size_milli" bigint,
	"stock_milli" bigint DEFAULT 0 NOT NULL,
	"min_milli" bigint DEFAULT 0 NOT NULL,
	"avg_cost_cents_per_base" double precision,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name"),
	CONSTRAINT "ingredients_min_check" CHECK ("ingredients"."min_milli" >= 0),
	CONSTRAINT "ingredients_package_check" CHECK (("ingredients"."package_name" IS NULL AND "ingredients"."package_size_milli" IS NULL) OR ("ingredients"."package_name" IS NOT NULL AND "ingredients"."package_size_milli" > 0))
);
--> statement-breakpoint
CREATE TABLE "recipe_items" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"qty_milli" bigint NOT NULL,
	CONSTRAINT "recipe_items_qty_check" CHECK ("recipe_items"."qty_milli" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"yield_qty" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_product_id_unique" UNIQUE("product_id"),
	CONSTRAINT "recipes_yield_check" CHECK ("recipes"."yield_qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "ingredient_movements" ADD CONSTRAINT "ingredient_movements_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_movements" ADD CONSTRAINT "ingredient_movements_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_movements" ADD CONSTRAINT "ingredient_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredient_movements_ing_idx" ON "ingredient_movements" USING btree ("ingredient_id","created_at");--> statement-breakpoint
CREATE INDEX "ingredient_movements_created_idx" ON "ingredient_movements" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_items_unique_idx" ON "recipe_items" USING btree ("recipe_id","ingredient_id");