import { randomInt } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { unitCostsFor } from "@/lib/ingredients/costing";
import { checkRateLimit, lockKeys, recordAttempt } from "@/lib/auth/rate-limit";
import { isOpen, openingLabel } from "@/lib/store/hours";
import { commitSale, reserve, StockError } from "@/lib/stock/stock";
import { enqueue } from "@/lib/printing/jobs";
import { activeNeighborhood } from "./fees";
import { normalizePhone } from "./phone";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ORDERS_PER_IP = 5;
const ORDER_WINDOW_MINUTES = 10;

const inputSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(50) }))
      .min(1, "A sacola está vazia.")
      .max(30, "Muitos produtos diferentes num pedido só."),
    fulfillment: z.enum(["DELIVERY", "PICKUP"]),
    customerName: z.string().trim().min(2, "Informe seu nome.").max(80),
    customerPhone: z.string().max(30),
    addressLine: z.string().trim().max(200).optional(),
    neighborhoodId: z.string().max(64).optional(),
    notes: z.string().trim().max(300, "A observação passa de 300 caracteres.").optional(),
    /** Total que a cliente viu na tela. Se o servidor calcular outro, o pedido não é criado. */
    expectedTotalCents: z.number().int().min(0).optional(),
  })
  .strip();

export type CreateOrderInput = z.input<typeof inputSchema>;
export type CreateOrderResult =
  | { ok: true; code: string }
  | { ok: false; error: "FECHADO" | "ESGOTADO" | "INVALIDO" | "LIMITE" | "PRECO_MUDOU"; productId?: string; message: string };

const invalid = (message: string): CreateOrderResult => ({ ok: false, error: "INVALIDO", message });

function newCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return c;
}

export async function createOrder(input: CreateOrderInput, ctx: { now: Date; ip: string }): Promise<CreateOrderResult> {
  if (!isOpen(ctx.now)) {
    return { ok: false, error: "FECHADO", message: `Estamos fechados agora. Abrimos ${openingLabel(ctx.now)}.` };
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0].message);
  const data = parsed.data;

  const phone = normalizePhone(data.customerPhone);
  if (!phone) return invalid("Informe um WhatsApp com DDD, por exemplo (67) 99999-0000.");
  if (data.fulfillment === "DELIVERY" && !data.addressLine) return invalid("Informe o endereço de entrega.");

  const rateKey = `order:${ctx.ip}`;

  // junta linhas repetidas do mesmo produto
  const qty = new Map<string, number>();
  for (const it of data.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.quantity);
  if ([...qty.values()].some((q) => q > 50)) return invalid("Quantidade acima do permitido para um produto.");

  try {
    const code = await db.transaction(async (tx) => {
      // O limite por IP é conferido e registrado dentro desta transação, com a chave travada:
      // pedidos simultâneos do mesmo IP passam um de cada vez, e pedido recusado não conta.
      await lockKeys(tx, [rateKey]);
      if (!(await checkRateLimit(rateKey, ORDERS_PER_IP, ORDER_WINDOW_MINUTES, tx))) throw new OrderLimitError();

      const products = (
        await tx
          .select({ product: schema.products })
          .from(schema.products)
          .innerJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
          .where(
            and(
              inArray(schema.products.id, [...qty.keys()]),
              eq(schema.products.active, true),
              eq(schema.categories.active, true),
            ),
          )
      ).map((r) => r.product);
      if (products.length !== qty.size) throw new OrderInputError("Um dos produtos não está mais à venda.");

      let deliveryFeeCents = 0;
      let neighborhoodId: string | null = null;
      let neighborhoodName = "";
      if (data.fulfillment === "DELIVERY") {
        const nb = data.neighborhoodId ? await activeNeighborhood(data.neighborhoodId, tx) : null;
        if (!nb) throw new OrderInputError("Escolha o bairro de entrega.");
        deliveryFeeCents = nb.feeCents;
        neighborhoodId = nb.id;
        neighborhoodName = nb.name;
      }

      await reserve([...qty].map(([productId, quantity]) => ({ productId, quantity })), tx);

      const subtotalCents = products.reduce((n, p) => n + p.priceCents * (qty.get(p.id) ?? 0), 0);
      if (data.expectedTotalCents !== undefined && data.expectedTotalCents !== subtotalCents + deliveryFeeCents) {
        throw new PriceChangedError();
      }
      let order: { id: string; code: string } | undefined;
      for (let attempt = 0; attempt < 5 && !order; attempt++) {
        const candidate = newCode();
        const [taken] = await tx.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.code, candidate));
        if (taken) continue;
        [order] = await tx
          .insert(schema.orders)
          .values({
            code: candidate,
            fulfillment: data.fulfillment,
            customerName: data.customerName,
            customerPhone: phone,
            addressLine: data.fulfillment === "DELIVERY" ? data.addressLine : null,
            neighborhoodId,
            notes: data.notes || null,
            subtotalCents,
            deliveryFeeCents,
            totalCents: subtotalCents + deliveryFeeCents,
            createdIp: ctx.ip,
          })
          .returning({ id: schema.orders.id, code: schema.orders.code });
      }
      if (!order) throw new Error("Não foi possível gerar o código do pedido.");

      // custo pela receita na hora da venda: o relatório do mês não muda quando um insumo encarece
      const costs = await unitCostsFor(products.map((p) => p.id), tx);
      await tx.insert(schema.orderItems).values(
        products.map((p) => ({
          orderId: order.id, productId: p.id, productName: p.name, unitPriceCents: p.priceCents,
          unitCostCents: costs.get(p.id) ?? null, quantity: qty.get(p.id)!,
        })),
      );
      await commitSale(order.id, tx);
      // comanda para a cozinha: sem telefone nem endereço
      const firstName = data.customerName.trim().split(/\s+/)[0];
      await enqueue("ORDER", order.id, {
        title: `SITE · ${order.code}`,
        subtitle: `${data.fulfillment === "DELIVERY" ? `Entrega · ${neighborhoodName}` : "Retirada na loja"} · ${firstName}`,
        lines: products.map((p) => ({ quantity: qty.get(p.id)!, name: p.name })),
        footer: data.notes ? `Obs.: ${data.notes}` : undefined,
        createdAt: new Date().toISOString(),
      }, tx);
      await recordAttempt(rateKey, tx);
      return order.code;
    });
    return { ok: true, code };
  } catch (e) {
    if (e instanceof OrderInputError) return invalid(e.message);
    if (e instanceof OrderLimitError) {
      return { ok: false, error: "LIMITE", message: "Muitos pedidos em sequência. Espere alguns minutos e tente de novo." };
    }
    if (e instanceof PriceChangedError) {
      return { ok: false, error: "PRECO_MUDOU", message: "Um preço ou a taxa de entrega mudou. Confira o novo total antes de pedir." };
    }
    if (e instanceof StockError && e.code === "ESGOTADO") {
      return { ok: false, error: "ESGOTADO", productId: e.productId, message: "Um produto acabou de esgotar. Ajuste a sacola." };
    }
    if (e instanceof StockError) return invalid(e.message);
    throw e;
  }
}

class OrderInputError extends Error {}
class OrderLimitError extends Error {}
class PriceChangedError extends Error {}
