import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/lib/db";
import { createOrder } from "@/lib/orders/create";
import { claimJobs, enqueue, getJob, markPrinted, stalePending } from "@/lib/printing/jobs";
import { resetDb } from "../setup";
import { makeProduct } from "../helpers";

const NOW = new Date("2026-11-17T12:00:00-04:00");
const ticket = (title: string) => ({ title, lines: [{ quantity: 1, name: "Bolo" }], createdAt: NOW.toISOString() });

beforeEach(resetDb);

describe("fila de comandas", () => {
  it("pedido do site gera comanda sem telefone nem endereço @spec:AC-078", async () => {
    const p = await makeProduct({ name: "Bolo de cenoura", stockOnHand: 3 });
    const [nb] = await db.insert(schema.neighborhoods).values({ name: "Centro", feeCents: 500 }).returning();
    const r = await createOrder(
      {
        customerName: "Maria Souza", customerPhone: "(67) 99999-0000", fulfillment: "DELIVERY",
        addressLine: "Rua das Flores, 123", neighborhoodId: nb.id, notes: "capricha", items: [{ productId: p.id, quantity: 2 }],
      },
      { now: NOW, ip: "1.1.1.1" },
    );
    expect(r.ok).toBe(true);
    const [job] = await db.select().from(schema.printJobs);
    expect(job.kind).toBe("ORDER");
    const t = JSON.parse(job.content);
    expect(t.title).toContain(r.ok ? r.code : "");
    expect(t.subtitle).toMatch(/Entrega/);
    expect(t.lines).toEqual([{ quantity: 2, name: "Bolo de cenoura" }]);
    expect(job.content).not.toMatch(/99999|Flores|123/);
    expect(t.footer).toContain("capricha");
  });

  it("dois computadores buscando ao mesmo tempo não pegam a mesma comanda @spec:AC-079", async () => {
    for (let i = 0; i < 6; i++) await enqueue("TABLE", null, ticket(`MESA ${i}`));
    const [a, b] = await Promise.all([claimJobs("pc-a", 10), claimJobs("pc-b", 10)]);
    const ids = [...a, ...b].map((j) => j.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(await claimJobs("pc-c", 10)).toHaveLength(0);
  });

  it("reimprimir não devolve a comanda para a fila @spec:AC-079", async () => {
    await enqueue("TABLE", null, ticket("MESA 1"));
    const [j] = await claimJobs("pc-a", 5);
    await markPrinted(j.id, "pc-a");
    const again = await getJob(j.id);
    expect(again?.ticket.title).toBe("MESA 1");
    expect(again?.printedAt).toBeInstanceOf(Date);
    expect(await claimJobs("pc-b", 5)).toHaveLength(0);
  });

  it("comanda reservada e não impressa volta depois de 2 minutos @spec:AC-079", async () => {
    await enqueue("TABLE", null, ticket("MESA 1"));
    const t0 = new Date();
    expect(await claimJobs("pc-a", 5, t0)).toHaveLength(1);
    expect(await claimJobs("pc-b", 5, new Date(+t0 + 60_000))).toHaveLength(0);
    expect(await stalePending(new Date(+t0 + 3 * 60_000))).toBe(1);
    expect(await claimJobs("pc-b", 5, new Date(+t0 + 3 * 60_000))).toHaveLength(1);
  });
});
