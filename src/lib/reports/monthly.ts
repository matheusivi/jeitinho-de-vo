import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { assertRole, type SessionUser } from "@/lib/auth/types";
import { TIMEZONE } from "@/lib/store/hours";

/**
 * Relatórios da dona. Regras:
 * - venda conta no dia em que o pedido foi feito; cancelados ficam fora;
 * - mesa só conta depois de fechada (conta no dia em que foi aberta, recebido no dia em que fechou);
 * - dinheiro entra no caixa no dia em que foi recebido;
 * - compras de insumo saem do caixa no dia em que foram lançadas;
 * - dias seguem o fuso da loja (Campo Grande, UTC−4 sem horário de verão).
 */
const TZ_OFFSET_HOURS = 4;

export class ReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportError";
  }
}

function assertPeriod(year: number, month?: number): void {
  if (!Number.isInteger(year) || year < 2025 || year > 2100) throw new ReportError("Ano inválido.");
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) throw new ReportError("Mês inválido.");
}

/** Início do mês às 00:00 no horário da loja. */
function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, TZ_OFFSET_HOURS));
}

const localDate = (col: SQL) => sql`to_char((${col}) AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD')`;
const localMonth = (col: SQL) => sql`extract(month from (${col}) AT TIME ZONE ${TIMEZONE})::int`;

async function rows<T>(q: SQL): Promise<T[]> {
  const r = await db.execute(q);
  return r.rows as T[];
}

const toInt = (v: unknown) => Number(v ?? 0);

export type DayRow = {
  date: string;
  orders: number;
  items: number;
  /** Total dos pedidos do dia (produtos + taxa de entrega). */
  soldCents: number;
  productCents: number;
  feesCents: number;
  byMethod: Record<string, number>;
  /** Do que foi vendido no dia, quanto ainda falta receber. */
  pendingCents: number;
  /** Dinheiro que entrou no dia. */
  receivedCents: number;
  /** Compras de insumo lançadas no dia. */
  purchasesCents: number;
  /** Recebido − compras. */
  balanceCents: number;
};

export type CmvSummary = {
  /** Custo pela receita do que foi vendido (só itens com custo). */
  theoreticalCostCents: number;
  /** Vendas dos itens que tinham custo, base do CMV previsto. */
  theoreticalRevenueCents: number;
  theoreticalPct: number | null;
  /**
   * Custo real: o previsto mais o que saiu fora da receita (perda e consumo de insumo, correções de contagem)
   * e o produto pronto descartado, pelo custo da receita.
   * A produção que ainda está na vitrine não entra, senão um mês de estoque alto pareceria desperdício.
   */
  realCostCents: number;
  /** Perdas do mês: insumo perdido, contagem a menos e produto pronto descartado. */
  lossCents: number;
  /** Parte das perdas que é produto pronto descartado (bolo vencido, quebrado). */
  productLossCents: number;
  /** Vendas de produtos do mês, sem taxa de entrega. */
  productRevenueCents: number;
  realPct: number | null;
  /** Real − previsto, em pontos percentuais: quanto do preço foi embora em perdas e ajustes. */
  diffPts: number | null;
  /** Unidades vendidas sem custo (produto sem receita ou com insumo sem preço). */
  itemsWithoutCost: number;
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

function emptyDay(date: string): DayRow {
  return {
    date, orders: 0, items: 0, soldCents: 0, productCents: 0, feesCents: 0, byMethod: {}, pendingCents: 0,
    receivedCents: 0, purchasesCents: 0, balanceCents: 0,
  };
}

export async function monthlyReport(year: number, month: number, user: SessionUser) {
  assertRole(user, "ADMIN");
  assertPeriod(year, month);
  const start = monthStart(year, month);
  const end = month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    emptyDay(`${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  );
  const byDate = new Map(days.map((d) => [d.date, d]));
  const inMonth = (col: SQL) => sql`${col} >= ${start} AND ${col} < ${end}`;

  const sales = await rows<{ d: string; method: string; orders: string; sold: string; product: string; fees: string; pending: string }>(sql`
    SELECT ${localDate(sql`created_at`)} AS d, payment_method AS method, count(*) AS orders,
      sum(total_cents) AS sold, sum(subtotal_cents) AS product, sum(delivery_fee_cents) AS fees,
      sum(CASE WHEN payment_status = 'PENDING' THEN total_cents ELSE 0 END) AS pending
    FROM orders WHERE status <> 'CANCELED' AND NOT (fulfillment = 'TABLE' AND status <> 'DONE') AND ${inMonth(sql`created_at`)}
    GROUP BY 1, 2`);
  for (const r of sales) {
    const d = byDate.get(r.d);
    if (!d) continue;
    d.orders += toInt(r.orders);
    d.soldCents += toInt(r.sold);
    d.productCents += toInt(r.product);
    d.feesCents += toInt(r.fees);
    d.pendingCents += toInt(r.pending);
    d.byMethod[r.method] = (d.byMethod[r.method] ?? 0) + toInt(r.sold);
  }

  const items = await rows<{ d: string; qty: string }>(sql`
    SELECT ${localDate(sql`o.created_at`)} AS d, sum(i.quantity) AS qty
    FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.status <> 'CANCELED' AND NOT (o.fulfillment = 'TABLE' AND o.status <> 'DONE') AND ${inMonth(sql`o.created_at`)} GROUP BY 1`);
  for (const r of items) {
    const d = byDate.get(r.d);
    if (d) d.items = toInt(r.qty);
  }

  const received = await rows<{ d: string; cents: string }>(sql`
    SELECT ${localDate(sql`received_at`)} AS d, sum(received_cents) AS cents
    FROM orders WHERE status <> 'CANCELED' AND NOT (fulfillment = 'TABLE' AND status <> 'DONE') AND payment_status = 'RECEIVED' AND ${inMonth(sql`received_at`)} GROUP BY 1`);
  for (const r of received) {
    const d = byDate.get(r.d);
    if (d) d.receivedCents = toInt(r.cents);
  }

  const purchases = await rows<{ d: string; cents: string }>(sql`
    SELECT ${localDate(sql`created_at`)} AS d, sum(cost_cents) AS cents
    FROM ingredient_movements WHERE type = 'PURCHASE' AND ${inMonth(sql`created_at`)} GROUP BY 1`);
  for (const r of purchases) {
    const d = byDate.get(r.d);
    if (d) d.purchasesCents = toInt(r.cents);
  }

  for (const d of days) d.balanceCents = d.receivedCents - d.purchasesCents;

  const totals = days.reduce((t, d) => {
    t.orders += d.orders; t.items += d.items; t.soldCents += d.soldCents; t.productCents += d.productCents;
    t.feesCents += d.feesCents; t.pendingCents += d.pendingCents; t.receivedCents += d.receivedCents;
    t.purchasesCents += d.purchasesCents; t.balanceCents += d.balanceCents;
    for (const [k, v] of Object.entries(d.byMethod)) t.byMethod[k] = (t.byMethod[k] ?? 0) + v;
    return t;
  }, emptyDay(`${year}-${String(month).padStart(2, "0")}`));

  const [theo] = await rows<{ cost: string; revenue: string; without: string }>(sql`
    SELECT sum(CASE WHEN i.unit_cost_cents IS NOT NULL THEN i.unit_cost_cents * i.quantity ELSE 0 END) AS cost,
      sum(CASE WHEN i.unit_cost_cents IS NOT NULL THEN i.unit_price_cents * i.quantity ELSE 0 END) AS revenue,
      sum(CASE WHEN i.unit_cost_cents IS NULL THEN i.quantity ELSE 0 END) AS without
    FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.status <> 'CANCELED' AND NOT (o.fulfillment = 'TABLE' AND o.status <> 'DONE') AND ${inMonth(sql`o.created_at`)}`);
  // saídas fora da receita: perda, consumo avulso e correções de contagem (contagem a mais devolve custo)
  const [waste] = await rows<{ cost: string; loss: string }>(sql`
    SELECT coalesce(sum(CASE WHEN qty_milli < 0 THEN cost_cents ELSE -cost_cents END), 0) AS cost,
      coalesce(sum(CASE WHEN type = 'LOSS' OR (type = 'COUNT' AND qty_milli < 0) THEN cost_cents ELSE 0 END), 0) AS loss
    FROM ingredient_movements
    WHERE type IN ('LOSS', 'CONSUMPTION', 'COUNT') AND cost_cents IS NOT NULL AND ${inMonth(sql`created_at`)}`);
  // produto pronto descartado ou corrigido (ajuste de estoque), pelo custo da receita
  const [prodWaste] = await rows<{ cost: string; loss: string }>(sql`
    SELECT coalesce(sum(CASE WHEN quantity < 0 THEN cost_cents ELSE -cost_cents END), 0) AS cost,
      coalesce(sum(CASE WHEN quantity < 0 THEN cost_cents ELSE 0 END), 0) AS loss
    FROM stock_movements
    WHERE type = 'ADJUSTMENT' AND cost_cents IS NOT NULL AND ${inMonth(sql`created_at`)}`);
  const theoreticalPct = pct(toInt(theo.cost), toInt(theo.revenue));
  const realCost = toInt(theo.cost) + toInt(waste.cost) + toInt(prodWaste.cost);
  const realPct = pct(realCost, toInt(theo.revenue));
  const cmv: CmvSummary = {
    theoreticalCostCents: toInt(theo.cost),
    theoreticalRevenueCents: toInt(theo.revenue),
    theoreticalPct,
    realCostCents: realCost,
    lossCents: toInt(waste.loss) + toInt(prodWaste.loss),
    productLossCents: toInt(prodWaste.loss),
    productRevenueCents: totals.productCents,
    realPct,
    diffPts: theoreticalPct !== null && realPct !== null ? Math.round((realPct - theoreticalPct) * 10) / 10 : null,
    itemsWithoutCost: toInt(theo.without),
  };

  return { year, month, days, totals, cmv };
}

export type ProductReportRow = {
  productId: string; name: string; qty: number; revenueCents: number;
  /** Custo pela receita na hora da venda; nulo se alguma unidade foi vendida sem custo. */
  costCents: number | null; costComplete: boolean; knownCostCents: number;
  grossProfitCents: number | null; cmvPct: number | null; marginPct: number | null;
};

export async function productReport(year: number, month: number, user: SessionUser): Promise<ProductReportRow[]> {
  assertRole(user, "ADMIN");
  assertPeriod(year, month);
  const start = monthStart(year, month);
  const end = month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1);
  const r = await rows<{ product_id: string; name: string; qty: string; revenue: string; known: string; without: string }>(sql`
    SELECT i.product_id, max(i.product_name) AS name, sum(i.quantity) AS qty,
      sum(i.unit_price_cents * i.quantity) AS revenue,
      sum(coalesce(i.unit_cost_cents, 0) * i.quantity) AS known,
      sum(CASE WHEN i.unit_cost_cents IS NULL THEN i.quantity ELSE 0 END) AS without
    FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.status <> 'CANCELED' AND NOT (o.fulfillment = 'TABLE' AND o.status <> 'DONE') AND o.created_at >= ${start} AND o.created_at < ${end}
    GROUP BY i.product_id ORDER BY revenue DESC, name ASC`);
  return r.map((x) => {
    const revenue = toInt(x.revenue);
    const complete = toInt(x.without) === 0;
    const cost = complete ? toInt(x.known) : null;
    const cmvPct = cost !== null ? pct(cost, revenue) : null;
    return {
      productId: x.product_id, name: x.name, qty: toInt(x.qty), revenueCents: revenue, costCents: cost,
      costComplete: complete, knownCostCents: toInt(x.known), grossProfitCents: cost !== null ? revenue - cost : null,
      cmvPct, marginPct: cmvPct !== null ? Math.round((100 - cmvPct) * 10) / 10 : null,
    };
  });
}

export type MonthRow = { month: number; soldCents: number; receivedCents: number; purchasesCents: number; balanceCents: number; orders: number };

export async function yearReport(year: number, user: SessionUser) {
  assertRole(user, "ADMIN");
  assertPeriod(year);
  const start = monthStart(year, 1);
  const end = monthStart(year + 1, 1);
  const months: MonthRow[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, soldCents: 0, receivedCents: 0, purchasesCents: 0, balanceCents: 0, orders: 0,
  }));
  const range = (col: SQL) => sql`${col} >= ${start} AND ${col} < ${end}`;
  const sold = await rows<{ m: number; cents: string; orders: string }>(sql`
    SELECT ${localMonth(sql`created_at`)} AS m, sum(total_cents) AS cents, count(*) AS orders
    FROM orders WHERE status <> 'CANCELED' AND NOT (fulfillment = 'TABLE' AND status <> 'DONE') AND ${range(sql`created_at`)} GROUP BY 1`);
  const rec = await rows<{ m: number; cents: string }>(sql`
    SELECT ${localMonth(sql`received_at`)} AS m, sum(received_cents) AS cents
    FROM orders WHERE status <> 'CANCELED' AND NOT (fulfillment = 'TABLE' AND status <> 'DONE') AND payment_status = 'RECEIVED' AND ${range(sql`received_at`)} GROUP BY 1`);
  const buy = await rows<{ m: number; cents: string }>(sql`
    SELECT ${localMonth(sql`created_at`)} AS m, sum(cost_cents) AS cents
    FROM ingredient_movements WHERE type = 'PURCHASE' AND ${range(sql`created_at`)} GROUP BY 1`);
  for (const r of sold) { months[r.m - 1].soldCents = toInt(r.cents); months[r.m - 1].orders = toInt(r.orders); }
  for (const r of rec) months[r.m - 1].receivedCents = toInt(r.cents);
  for (const r of buy) months[r.m - 1].purchasesCents = toInt(r.cents);
  for (const m of months) m.balanceCents = m.receivedCents - m.purchasesCents;
  const totals = months.reduce(
    (t, m) => ({
      soldCents: t.soldCents + m.soldCents, receivedCents: t.receivedCents + m.receivedCents,
      purchasesCents: t.purchasesCents + m.purchasesCents, balanceCents: t.balanceCents + m.balanceCents, orders: t.orders + m.orders,
    }),
    { soldCents: 0, receivedCents: 0, purchasesCents: 0, balanceCents: 0, orders: 0 },
  );
  return { year, months, totals };
}

export type PurchaseRow = { createdAt: Date; ingredient: string; baseUnit: "g" | "ml" | "un"; qtyMilli: number; costCents: number; userName: string | null; note: string | null };

export async function purchasesOfMonth(year: number, month: number, user: SessionUser): Promise<PurchaseRow[]> {
  assertRole(user, "ADMIN");
  assertPeriod(year, month);
  const start = monthStart(year, month);
  const end = month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1);
  const r = await rows<{ created_at: Date; ingredient: string; base_unit: "g" | "ml" | "un"; qty_milli: string; cost_cents: number; user_name: string | null; reason: string | null }>(sql`
    SELECT m.created_at, i.name AS ingredient, i.base_unit, m.qty_milli, m.cost_cents, u.name AS user_name, m.reason
    FROM ingredient_movements m JOIN ingredients i ON i.id = m.ingredient_id LEFT JOIN users u ON u.id = m.user_id
    WHERE m.type = 'PURCHASE' AND m.created_at >= ${start} AND m.created_at < ${end}
    ORDER BY m.created_at`);
  return r.map((x) => ({
    createdAt: new Date(x.created_at), ingredient: x.ingredient, baseUnit: x.base_unit, qtyMilli: toInt(x.qty_milli),
    costCents: toInt(x.cost_cents), userName: x.user_name, note: x.reason,
  }));
}
