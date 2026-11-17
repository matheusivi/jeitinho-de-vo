import { requireUser } from "@/lib/auth/guard";
import { listStock, listTodayMovements, TIMEZONE } from "@/lib/stock/views";
import { AdjustForm, ProduceRow } from "./StockForms";

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE });

export default async function ProducaoPage() {
  await requireUser();
  const [stock, history] = await Promise.all([listStock(), listTodayMovements()]);
  const groups = new Map<string, typeof stock>();
  for (const p of stock) groups.set(p.categoryName, [...(groups.get(p.categoryName) ?? []), p]);

  return (
    <div className="pn-grid" style={{ gap: 24 }}>
      <div>
        <h1 className="pn-h1">Produzi hoje</h1>
        <p className="pn-sub" style={{ margin: 0 }}>Digite quanto ficou pronto e toque em Lançar. O produto entra no cardápio na hora.</p>
      </div>

      {stock.length === 0 && (
        <div className="pn-card"><p className="pn-muted" style={{ margin: 0 }}>Nenhum produto ativo. A administradora cadastra os produtos em Produtos.</p></div>
      )}
      {[...groups].map(([category, items]) => (
        <section className="pn-card" key={category} aria-label={category}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{category}</h2>
          {items.map((p) => <ProduceRow key={p.id} id={p.id} name={p.name} unitLabel={p.unitLabel} available={p.available} />)}
        </section>
      ))}

      {stock.length > 0 && (
        <section className="pn-card pn-grid" aria-label="Ajustar estoque">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Ajustar estoque</h2>
            <p className="pn-muted" style={{ margin: 0 }}>Para perda, consumo ou correção de contagem. Venda pelo site já baixa sozinha.</p>
          </div>
          <AdjustForm products={stock.map((p) => ({ id: p.id, name: p.name }))} />
        </section>
      )}

      <section className="pn-card pn-scroll" aria-label="Lançamentos de hoje">
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Lançamentos de hoje</h2>
        {history.length === 0 ? (
          <p className="pn-muted" style={{ margin: 0 }}>Nada lançado hoje ainda.</p>
        ) : (
          <table className="pn-table">
            <thead><tr><th>Hora</th><th>Produto</th><th>Quantidade</th><th>Tipo</th><th>Quem</th></tr></thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.id}>
                  <td>{hora.format(m.createdAt)}</td>
                  <td>{m.productName}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td>{m.type === "PRODUCTION" ? "Produção" : `Ajuste: ${m.reason ?? ""}`}</td>
                  <td>{m.userName ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
