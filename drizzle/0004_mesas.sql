CREATE TYPE "public"."print_kind" AS ENUM('TABLE', 'TABLE_REMOVAL', 'ORDER');--> statement-breakpoint
CREATE TYPE "public"."tender" AS ENUM('CASH', 'PIX', 'CARD');--> statement-breakpoint
ALTER TYPE "public"."fulfillment" ADD VALUE 'TABLE';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'IN_STORE';--> statement-breakpoint
CREATE TABLE "dining_tables" (
	"number" integer PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_payment_items" (
	"payment_id" text NOT NULL,
	"order_item_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"tender" "tender" NOT NULL,
	"amount_cents" integer NOT NULL,
	"received_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_payments_amount_pos" CHECK ("order_payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "print_kind" NOT NULL,
	"order_id" text,
	"content" text NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "added_by" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "added_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_number" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "opened_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_payment_items" ADD CONSTRAINT "order_payment_items_payment_id_order_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."order_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payment_items" ADD CONSTRAINT "order_payment_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_payment_items_item_idx" ON "order_payment_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_payments_order_idx" ON "order_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "print_jobs_pending_idx" ON "print_jobs" USING btree ("printed_at","created_at");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_open_table_idx" ON "orders" USING btree ("table_number") WHERE table_number IS NOT NULL AND status = 'CONFIRMED';--> statement-breakpoint
INSERT INTO "dining_tables" ("number") SELECT generate_series(1, 8) ON CONFLICT DO NOTHING;
