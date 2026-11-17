import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { formatBRL } from "@/lib/money";
import { getIngredient, IngredientError, listMovements, statusOf, suggestMinimum } from "@/lib/ingredients/ingredients";
import { formatQty } from "@/lib/ingredients/units";
import { TIMEZONE } from "@/lib/store/hours";
import { avgLabel, STATUS_LABEL } from "../format";
import { CountForm, EditIngredientForm, MinimumForm } from "../InsumoForms";

const quando = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE });
const TYPE_LABEL: Record<string, string> = {
  PURCHASE: "Compra", PRODUCTION: "Produção", LOSS: "Perda", CONSUMPTION: "Consumo", COUNT: "Contagem",
};

export default async function InsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  const { id } = await params;
  const ing = await getIngredient(id).catch((e) => {
    if (e instanceof IngredientError) notFound();
    throw e;
  });
  const [moves, suggestion] = await Promise.all([listMovements(id, user, 40), admin ? suggestMinimum(id) : null]);
  const st = STATUS_LABEL[statusOf(ing)];
  const option = { id: ing.id, name: ing.name, baseUnit: ing.baseUnit, packageName: ing.packageName, packageSizeMilli: ing.packageSizeMilli, stockMilli: ing.stockMilli };

  return (
    <div className="pn-grid" style={{ gap: 24 }}>
      <div>
        <Link href="/painel/insumos" className="pn-muted">← Insumos</Link>
        <h1 className="pn-h1" style={{ marginTop: 8 }}>{ing.name}</h1>
        <div className="pn-row" style={{ gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatQty(ing.stockMilli, ing.baseUnit)}</span>
          <span className={`pn-tag ${st.cls}`}>{st.text}</span>
          {ing.minMilli > 0 && <span className="pn-muted">mínimo {formatQty(ing.minMilli, ing.baseUnit)}</span>}
          {admin && <span className="pn-muted">custo médio {avgLabel(ing.avgCostCentsPerBase, ing.baseUnit)}</span>}
        </div>
        {ing.stockMilli < 0 && (
          <p className="pn-msg err" style={{ marginTop: 12 }}>
            O estoque está negativo: foi usado mais do que o sistema tinha. Lance a compra que faltou ou corrija pela contagem.
          </p>
        )}
      </div>

      {admin && suggestion && (
        <section className="pn-card pn-grid" aria-label="Estoque mínimo">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Estoque mínimo</h2>
            <p className="pn-muted" style={{ margin: 0 }}>{suggestion.explanation}</p>
          </div>
          <MinimumForm ingredient={option} suggestedMilli={suggestion.suggestedMilli} />
        </section>
      )}

      {admin && (
        <section className="pn-card pn-grid" aria-label="Contagem">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Contei a prateleira</h2>
            <p className="pn-muted" style={{ margin: 0 }}>Informe o que tem de verdade; o sistema ajusta e guarda a diferença.</p>
          </div>
          <CountForm ingredient={option} />
        </section>
      )}

      <section className="pn-card pn-scroll" aria-label="Movimentos">
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Últimos movimentos</h2>
        {moves.length === 0 ? (
          <p className="pn-muted" style={{ margin: 0 }}>Nenhum movimento ainda.</p>
        ) : (
          <table className="pn-table">
            <thead><tr><th>Quando</th><th>Tipo</th><th>Quantidade</th>{admin && <th>Valor</th>}<th>Detalhe</th><th>Quem</th></tr></thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td>{quando.format(m.createdAt)}</td>
                  <td>{TYPE_LABEL[m.type] ?? m.type}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{m.qtyMilli > 0 ? "+" : ""}{formatQty(m.qtyMilli, ing.baseUnit)}</td>
                  {admin && <td style={{ fontVariantNumeric: "tabular-nums" }}>{m.costCents == null ? "—" : formatBRL(m.costCents)}</td>}
                  <td>{m.reason ?? ""}</td>
                  <td>{m.userName ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {admin && (
        <section className="pn-card pn-grid" aria-label="Editar insumo">
          <h2 style={{ margin: 0, fontSize: 18 }}>Editar</h2>
          <EditIngredientForm ingredient={{ id: ing.id, name: ing.name, baseUnit: ing.baseUnit, packageName: ing.packageName, packageSizeMilli: ing.packageSizeMilli, minMilli: ing.minMilli, active: ing.active }} />
        </section>
      )}
    </div>
  );
}
