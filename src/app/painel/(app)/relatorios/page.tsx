import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { formatBRL } from "@/lib/money";
import { monthlyReport, productReport, yearReport } from "@/lib/reports/monthly";
import { MONTH_NAMES } from "@/lib/reports/excel";
import { TIMEZONE } from "@/lib/store/hours";
import { BarChart } from "@/components/painel/BarChart";

type Search = { mes?: string; aba?: string };
const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const brlShort = (cents: number) =>
  cents >= 100_000 ? `R$ ${(cents / 100_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatBRL(cents).replace(",00", "");

function currentMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return { year: Number(parts.find((p) => p.type === "year")!.value), month: Number(parts.find((p) => p.type === "month")!.value) };
}

function parseMonth(v: string | undefined): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (year >= 2025 && year <= 2100 && month >= 1 && month <= 12) return { year, month };
  }
  return currentMonth();
}

const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const shift = (y: number, m: number, d: number) => {
  const t = y * 12 + (m - 1) + d;
  return { year: Math.floor(t / 12), month: (t % 12) + 1 };
};

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireRole("ADMIN");
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.mes);
  const aba = sp.aba === "produtos" || sp.aba === "ano" ? sp.aba : "mes";
  const mesKey = key(year, month);
  const prev = shift(year, month, -1);
  const next = shift(year, month, 1);
  const label = `${MONTH_NAMES[month - 1]} de ${year}`;
  const tab = (a: string) => `/painel/relatorios?mes=${mesKey}&aba=${a}`;

  const r = await monthlyReport(year, month, user);
  const t = r.totals;

  return (
    <div className="pn-grid" style={{ gap: 24 }}>
      <div className="pn-row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="pn-h1">Relatórios</h1>
          <p className="pn-sub" style={{ margin: 0 }}>Vendas, caixa e custo. A venda conta no dia do pedido; o dinheiro, no dia em que foi recebido.</p>
        </div>
        <a className="pn-btn" href={`/painel/relatorios/exportar?mes=${mesKey}`}>Baixar Excel de {label}</a>
      </div>

      <div className="pn-row" style={{ justifyContent: "space-between" }}>
        <div className="pn-row" style={{ gap: 8 }}>
          <Link className="pn-btn ghost small" href={`/painel/relatorios?mes=${key(prev.year, prev.month)}&aba=${aba}`} aria-label="Mês anterior">←</Link>
          <strong style={{ fontSize: 18, textTransform: "capitalize", minWidth: 170, textAlign: "center" }}>{aba === "ano" ? year : label}</strong>
          <Link className="pn-btn ghost small" href={`/painel/relatorios?mes=${key(next.year, next.month)}&aba=${aba}`} aria-label="Próximo mês">→</Link>
        </div>
        <nav className="pn-tabs" aria-label="Visão">
          <Link href={tab("mes")} aria-current={aba === "mes" ? "page" : undefined}>Mês por dia</Link>
          <Link href={tab("produtos")} aria-current={aba === "produtos" ? "page" : undefined}>Por produto</Link>
          <Link href={tab("ano")} aria-current={aba === "ano" ? "page" : undefined}>Ano</Link>
        </nav>
      </div>

      {aba !== "ano" && (
        <div className="pn-row" style={{ gap: 12 }}>
          <div className="pn-stat"><span className="pn-muted">Vendido</span><strong>{formatBRL(t.soldCents)}</strong><span className="pn-muted">{t.orders} pedidos</span></div>
          <div className="pn-stat"><span className="pn-muted">Recebido</span><strong>{formatBRL(t.receivedCents)}</strong><span className="pn-muted">a receber {formatBRL(t.pendingCents)}</span></div>
          <div className="pn-stat"><span className="pn-muted">Compras de insumo</span><strong>{formatBRL(t.purchasesCents)}</strong></div>
          <div className="pn-stat">
            <span className="pn-muted">Saldo do caixa</span>
            <strong style={{ color: t.balanceCents < 0 ? "var(--goiaba-escuro)" : undefined }}>{formatBRL(t.balanceCents)}</strong>
            <span className="pn-muted">recebido − compras</span>
          </div>
          <div className="pn-stat">
            <span className="pn-muted">CMV previsto · real</span>
            <strong>{pct(r.cmv.theoreticalPct)} · {pct(r.cmv.realPct)}</strong>
            <span className="pn-muted">perdas {formatBRL(r.cmv.lossCents)}</span>
          </div>
        </div>
      )}

      {aba === "mes" && <MonthView r={r} label={label} />}
      {aba === "produtos" && <ProductsView year={year} month={month} user={user} cmv={r.cmv} />}
      {aba === "ano" && <YearView year={year} user={user} />}
    </div>
  );
}

function MonthView({ r, label }: { r: Awaited<ReturnType<typeof monthlyReport>>; label: string }) {
  const d = r.days;
  const t = r.totals;
  return (
    <>
      <section className="pn-card pn-grid" aria-label="Vendido por dia">
        <h2 style={{ margin: 0, fontSize: 18 }}>Vendido por dia · {label}</h2>
        <BarChart
          title={`Vendido por dia em ${label}`}
          formatValue={brlShort}
          bars={d.map((x, i) => ({
            label: String(i + 1), value: x.soldCents, tick: i === 0 || (i + 1) % 5 === 0,
            tooltip: `${x.date.split("-").reverse().join("/")}: ${formatBRL(x.soldCents)} em ${x.orders} pedido(s)`,
          }))}
        />
      </section>

      <section className="pn-card pn-grid" aria-label="CMV do mês">
        <h2 style={{ margin: 0, fontSize: 18 }}>Custo dos insumos no mês</h2>
        <p style={{ margin: 0 }}>
          <strong>Previsto pela receita: {pct(r.cmv.theoreticalPct)}.</strong> É o que as fichas técnicas dizem que os produtos vendidos deveriam gastar
          ({formatBRL(r.cmv.theoreticalCostCents)} sobre {formatBRL(r.cmv.theoreticalRevenueCents)}).
        </p>
        <p style={{ margin: 0 }}>
          <strong>Real pelas saídas: {pct(r.cmv.realPct)}.</strong> É o que saiu da despensa no mês em produção, perdas, consumo e contagens
          ({formatBRL(r.cmv.realCostCents)} sobre {formatBRL(r.cmv.productRevenueCents)} vendidos em produtos).
        </p>
        {r.cmv.diffPts !== null && (
          <p className={`pn-msg ${r.cmv.diffPts > 2 ? "err" : "ok"}`} style={{ margin: 0 }}>
            {r.cmv.diffPts > 2
              ? `O real está ${r.cmv.diffPts.toLocaleString("pt-BR")} pontos acima do previsto: vale olhar perdas (${formatBRL(r.cmv.lossCents)}) e se as receitas estão sendo seguidas na medida.`
              : "O real está perto do previsto: as receitas estão batendo com o que sai da despensa."}
          </p>
        )}
        {r.cmv.itemsWithoutCost > 0 && (
          <p className="pn-muted" style={{ margin: 0 }}>
            {r.cmv.itemsWithoutCost} unidade(s) vendida(s) sem custo cadastrado ficaram fora do previsto. Cadastre a receita desses produtos em Receitas e custos.
          </p>
        )}
      </section>

      <section className="pn-card pn-scroll" aria-label="Tabela do mês">
        <table className="pn-table">
          <thead>
            <tr>
              <th>Dia</th><th className="pn-num">Pedidos</th><th className="pn-num">Itens</th><th className="pn-num">Vendido</th>
              <th className="pn-num">Taxas</th><th className="pn-num">A receber</th><th className="pn-num">Recebido</th>
              <th className="pn-num">Compras</th><th className="pn-num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {d.map((x) => {
              const empty = !x.orders && !x.receivedCents && !x.purchasesCents;
              return (
                <tr key={x.date} style={{ color: empty ? "var(--ink-muted)" : undefined }}>
                  <td>{x.date.slice(8)}/{x.date.slice(5, 7)}</td>
                  <td className="pn-num">{x.orders}</td>
                  <td className="pn-num">{x.items}</td>
                  <td className="pn-num">{formatBRL(x.soldCents)}</td>
                  <td className="pn-num">{formatBRL(x.feesCents)}</td>
                  <td className="pn-num">{formatBRL(x.pendingCents)}</td>
                  <td className="pn-num">{formatBRL(x.receivedCents)}</td>
                  <td className="pn-num">{formatBRL(x.purchasesCents)}</td>
                  <td className="pn-num" style={{ color: x.balanceCents < 0 ? "var(--goiaba-escuro)" : undefined }}>{formatBRL(x.balanceCents)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td><td className="pn-num">{t.orders}</td><td className="pn-num">{t.items}</td>
              <td className="pn-num">{formatBRL(t.soldCents)}</td><td className="pn-num">{formatBRL(t.feesCents)}</td>
              <td className="pn-num">{formatBRL(t.pendingCents)}</td><td className="pn-num">{formatBRL(t.receivedCents)}</td>
              <td className="pn-num">{formatBRL(t.purchasesCents)}</td>
              <td className="pn-num" style={{ color: t.balanceCents < 0 ? "var(--goiaba-escuro)" : undefined }}>{formatBRL(t.balanceCents)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </>
  );
}

async function ProductsView({ year, month, user, cmv }: { year: number; month: number; user: Parameters<typeof productReport>[2]; cmv: { theoreticalPct: number | null } }) {
  const rows = await productReport(year, month, user);
  const max = Math.max(1, ...rows.map((r) => r.revenueCents));
  return (
    <section className="pn-card pn-scroll" aria-label="Resultado por produto">
      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Resultado por produto</h2>
      <p className="pn-muted" style={{ margin: "0 0 12px" }}>
        Custo pela receita no dia de cada venda. CMV médio do mês: {pct(cmv.theoreticalPct)}.
      </p>
      {rows.length === 0 ? (
        <p className="pn-muted" style={{ margin: 0 }}>Nenhuma venda neste mês.</p>
      ) : (
        <table className="pn-table">
          <thead>
            <tr>
              <th>Produto</th><th className="pn-num">Qtd.</th><th>Faturamento</th><th className="pn-num">Custo</th>
              <th className="pn-num">Lucro bruto</th><th className="pn-num">CMV</th><th className="pn-num">Margem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId}>
                <td><strong>{r.name}</strong>{!r.costComplete && <div className="pn-muted">parte vendida sem custo</div>}</td>
                <td className="pn-num">{r.qty}</td>
                <td style={{ minWidth: 200 }}>
                  <div className="pn-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                    <div style={{ flex: 1 }} aria-hidden><div className="pn-inline-bar" style={{ width: `${(r.revenueCents / max) * 100}%` }} /></div>
                    <span className="pn-num" style={{ minWidth: 90 }}>{formatBRL(r.revenueCents)}</span>
                  </div>
                </td>
                <td className="pn-num">{r.costCents === null ? "—" : formatBRL(r.costCents)}</td>
                <td className="pn-num">{r.grossProfitCents === null ? "—" : formatBRL(r.grossProfitCents)}</td>
                <td className="pn-num">{pct(r.cmvPct)}</td>
                <td className="pn-num">{pct(r.marginPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

async function YearView({ year, user }: { year: number; user: Parameters<typeof yearReport>[1] }) {
  const y = await yearReport(year, user);
  const short = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return (
    <>
      <section className="pn-card pn-grid" aria-label="Vendido por mês">
        <h2 style={{ margin: 0, fontSize: 18 }}>Vendido por mês · {year}</h2>
        <BarChart
          title={`Vendido por mês em ${year}`}
          formatValue={brlShort}
          bars={y.months.map((m) => ({ label: short[m.month - 1], value: m.soldCents, tick: true, tooltip: `${MONTH_NAMES[m.month - 1]}: ${formatBRL(m.soldCents)}` }))}
        />
      </section>
      <section className="pn-card pn-scroll" aria-label="Tabela do ano">
        <table className="pn-table">
          <thead>
            <tr><th>Mês</th><th className="pn-num">Pedidos</th><th className="pn-num">Vendido</th><th className="pn-num">Recebido</th><th className="pn-num">Compras</th><th className="pn-num">Saldo</th><th /></tr>
          </thead>
          <tbody>
            {y.months.map((m) => (
              <tr key={m.month}>
                <td style={{ textTransform: "capitalize" }}>{MONTH_NAMES[m.month - 1]}</td>
                <td className="pn-num">{m.orders}</td>
                <td className="pn-num">{formatBRL(m.soldCents)}</td>
                <td className="pn-num">{formatBRL(m.receivedCents)}</td>
                <td className="pn-num">{formatBRL(m.purchasesCents)}</td>
                <td className="pn-num" style={{ color: m.balanceCents < 0 ? "var(--goiaba-escuro)" : undefined }}>{formatBRL(m.balanceCents)}</td>
                <td><Link className="pn-muted" href={`/painel/relatorios?mes=${key(year, m.month)}&aba=mes`}>ver dias</Link></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td><td className="pn-num">{y.totals.orders}</td><td className="pn-num">{formatBRL(y.totals.soldCents)}</td>
              <td className="pn-num">{formatBRL(y.totals.receivedCents)}</td><td className="pn-num">{formatBRL(y.totals.purchasesCents)}</td>
              <td className="pn-num">{formatBRL(y.totals.balanceCents)}</td><td />
            </tr>
          </tfoot>
        </table>
      </section>
    </>
  );
}
