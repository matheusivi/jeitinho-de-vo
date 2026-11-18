import ExcelJS from "exceljs";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole, type SessionUser } from "@/lib/auth/types";
import { formatQty } from "@/lib/ingredients/units";
import { TIMEZONE } from "@/lib/store/hours";
import { monthlyReport, productReport, purchasesOfMonth } from "./monthly";

export const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const PCT = '0.0"%"';
const reais = (cents: number | null) => (cents === null ? null : cents / 100);

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7A3B2E" } };
  row.alignment = { vertical: "middle" };
}

function title(ws: ExcelJS.Worksheet, text: string): void {
  ws.getCell("A1").value = text;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);
}

function setMoney(ws: ExcelJS.Worksheet, cols: number[]): void {
  for (const c of cols) ws.getColumn(c).numFmt = BRL;
}

/** Planilha do mês para a dona: dias, produtos, compras e insumos. Sem dados pessoais de cliente. */
export async function buildMonthWorkbook(year: number, month: number, user: SessionUser): Promise<Buffer> {
  assertRole(user, "ADMIN");
  const [report, products, purchases] = await Promise.all([
    monthlyReport(year, month, user),
    productReport(year, month, user),
    purchasesOfMonth(year, month, user),
  ]);
  const label = `${MONTH_NAMES[month - 1]} de ${year}`;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Jeitinho de Vó";
  wb.created = new Date();

  // Dias
  const dias = wb.addWorksheet("Dias", { views: [{ state: "frozen", ySplit: 3 }] });
  title(dias, `Jeitinho de Vó · vendas e caixa de ${label}`);
  styleHeader(dias.addRow([
    "Dia", "Pedidos", "Itens", "Vendido (R$)", "Produtos (R$)", "Taxas de entrega (R$)", "A receber (R$)",
    "Recebido (R$)", "Compras de insumo (R$)", "Saldo do caixa (R$)",
  ]));
  for (const d of report.days) {
    const [y, m, day] = d.date.split("-");
    dias.addRow([
      `${day}/${m}/${y}`, d.orders, d.items, reais(d.soldCents), reais(d.productCents), reais(d.feesCents),
      reais(d.pendingCents), reais(d.receivedCents), reais(d.purchasesCents), reais(d.balanceCents),
    ]);
  }
  const t = report.totals;
  const totalRow = dias.addRow([
    "Total", t.orders, t.items, reais(t.soldCents), reais(t.productCents), reais(t.feesCents), reais(t.pendingCents),
    reais(t.receivedCents), reais(t.purchasesCents), reais(t.balanceCents),
  ]);
  totalRow.font = { bold: true };
  dias.addRow([]);
  const c = report.cmv;
  dias.addRow(["CMV previsto pela receita (%)", c.theoreticalPct]).getCell(2).numFmt = PCT;
  dias.addRow(["CMV real com perdas e ajustes (%)", c.realPct]).getCell(2).numFmt = PCT;
  dias.addRow(["Diferença (pontos)", c.diffPts]);
  dias.addRow(["Perdas no mês (R$)", reais(c.lossCents)]).getCell(2).numFmt = BRL;
  dias.addRow(["  das quais produto pronto descartado (R$)", reais(c.productLossCents)]).getCell(2).numFmt = BRL;
  dias.addRow(["Unidades vendidas sem custo cadastrado", c.itemsWithoutCost]);
  setMoney(dias, [4, 5, 6, 7, 8, 9, 10]);
  dias.getColumn(1).width = 36;
  for (let i = 2; i <= 10; i++) dias.getColumn(i).width = 16;

  // Produtos
  const prod = wb.addWorksheet("Produtos", { views: [{ state: "frozen", ySplit: 3 }] });
  title(prod, `Resultado por produto · ${label}`);
  styleHeader(prod.addRow(["Produto", "Quantidade", "Faturamento (R$)", "Custo (R$)", "Lucro bruto (R$)", "CMV (%)", "Margem bruta (%)", "Observação"]));
  for (const p of products) {
    prod.addRow([
      p.name, p.qty, reais(p.revenueCents), reais(p.costCents), reais(p.grossProfitCents), p.cmvPct, p.marginPct,
      p.costComplete ? "" : "Parte vendida sem custo (sem receita ou insumo sem preço)",
    ]);
  }
  setMoney(prod, [3, 4, 5]);
  prod.getColumn(6).numFmt = PCT;
  prod.getColumn(7).numFmt = PCT;
  prod.getColumn(1).width = 32;
  prod.getColumn(8).width = 52;
  for (let i = 2; i <= 7; i++) prod.getColumn(i).width = 16;

  // Compras
  const comp = wb.addWorksheet("Compras", { views: [{ state: "frozen", ySplit: 3 }] });
  title(comp, `Compras de insumo · ${label}`);
  styleHeader(comp.addRow(["Data", "Insumo", "Quantidade", "Valor pago (R$)", "Lançado por", "Observação"]));
  for (const p of purchases) {
    comp.addRow([
      p.createdAt.toLocaleDateString("pt-BR", { timeZone: TIMEZONE }), p.ingredient, formatQty(p.qtyMilli, p.baseUnit),
      reais(p.costCents), p.userName ?? "", p.note ?? "",
    ]);
  }
  const compTotal = comp.addRow(["Total", "", "", reais(purchases.reduce((n, p) => n + p.costCents, 0))]);
  compTotal.font = { bold: true };
  setMoney(comp, [4]);
  [14, 28, 16, 16, 20, 30].forEach((w, i) => (comp.getColumn(i + 1).width = w));

  // Insumos (situação no momento da exportação)
  const ins = wb.addWorksheet("Insumos", { views: [{ state: "frozen", ySplit: 3 }] });
  title(ins, `Estoque de insumos em ${new Date().toLocaleDateString("pt-BR", { timeZone: TIMEZONE })}`);
  styleHeader(ins.addRow(["Insumo", "Estoque", "Unidade", "Mínimo", "Custo médio (R$ por kg, litro ou unidade)", "Valor em estoque (R$)", "Situação"]));
  const rows = await db.select().from(schema.ingredients).orderBy(asc(schema.ingredients.name));
  for (const r of rows) {
    const big = r.baseUnit !== "un";
    const factor = big ? 1_000_000 : 1000; // kg/litro ou unidade
    const unit = r.baseUnit === "g" ? "kg" : r.baseUnit === "ml" ? "litro" : "unidade";
    const avg = r.avgCostCentsPerBase === null ? null : (r.avgCostCentsPerBase * (big ? 1000 : 1)) / 100;
    const value = r.avgCostCentsPerBase === null || r.stockMilli <= 0 ? null : ((r.stockMilli / 1000) * r.avgCostCentsPerBase) / 100;
    const status = r.stockMilli < 0 ? "Negativo" : r.minMilli > 0 && r.stockMilli <= r.minMilli ? "No mínimo" : "Ok";
    ins.addRow([r.name, r.stockMilli / factor, unit, r.minMilli / factor, avg, value, r.active ? status : "Inativo"]);
  }
  setMoney(ins, [5, 6]);
  ins.getColumn(2).numFmt = "#,##0.###";
  ins.getColumn(4).numFmt = "#,##0.###";
  [30, 12, 10, 12, 22, 20, 12].forEach((w, i) => (ins.getColumn(i + 1).width = w));

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
