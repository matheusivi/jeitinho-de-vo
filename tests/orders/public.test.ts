import { beforeEach, describe, expect, it } from "vitest";
import { createOrder } from "@/lib/orders/create";
import { getPublicOrder } from "@/lib/orders/public";
import { db, schema } from "@/lib/db";
import { resetDb } from "../setup";
import { makeProduct } from "../helpers";

beforeEach(resetDb);

describe("pedido visto pela cliente", () => {
  it("mostra itens, totais e estado, sem telefone nem endereço", async () => {
    const p = await makeProduct({ name: "Fatia de limão", priceCents: 1400, stockOnHand: 3 });
    const [nb] = await db.insert(schema.neighborhoods).values({ name: "Centro", feeCents: 500 }).returning();
    const r = await createOrder(
      { customerName: "Maria Souza", customerPhone: "67999990000", fulfillment: "DELIVERY", addressLine: "Rua Secreta, 99", neighborhoodId: nb.id, items: [{ productId: p.id, quantity: 2 }] },
      { now: new Date("2026-11-17T12:00:00-04:00"), ip: "1.2.3.4" },
    );
    if (!r.ok) throw new Error(r.message);
    const o = await getPublicOrder(r.code.toLowerCase());
    expect(o).toMatchObject({
      code: r.code, status: "CONFIRMED", fulfillment: "DELIVERY", firstName: "Maria", neighborhoodName: "Centro",
      subtotalCents: 2800, deliveryFeeCents: 500, totalCents: 3300,
      items: [{ name: "Fatia de limão", quantity: 2, unitPriceCents: 1400 }],
    });
    const json = JSON.stringify(o);
    expect(json).not.toContain("99999");
    expect(json).not.toContain("Secreta");
  });

  it("código desconhecido ou malformado devolve null", async () => {
    expect(await getPublicOrder("ZZZZZZ")).toBeNull();
    expect(await getPublicOrder("'; drop")).toBeNull();
  });
});
