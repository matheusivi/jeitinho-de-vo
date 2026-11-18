import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { formatBRL } from "@/lib/money";
import { listIngredients, type AdminIngredient } from "@/lib/ingredients/ingredients";
import { formatQty } from "@/lib/ingredients/units";
import { avgLabel, STATUS_LABEL } from "./format";
import { NewIngredientForm, OutflowForm, PurchaseForm, type IngredientOption } from "./InsumoForms";

export default async function InsumosPage() {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  const list = await listIngredients(user);
  const active = list.filter((i) => i.active);
  const options: IngredientOption[] = active.map((i) => ({
    id: i.id, name: i.name, baseUnit: i.baseUnit, packageName: i.packageName, packageSizeMilli: i.packageSizeMilli, stockMilli: i.stockMilli,
  }));
  const totalValue = admin ? (list as AdminIngredient[]).reduce((n, i) => n + (i.active ? (i.stockValueCents ?? 0) : 0), 0) : 0;

  return (
    <div className="pn-grid" style={{ gap: 24 }}>
      <div className="pn-row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="pn-h1">Insumos</h1>
          <p className="pn-sub" style={{ margin: 0 }}>
            O que tem na despensa. A produção baixa sozinha pela receita; aqui você lança {admin ? "compras, " : ""}perdas e consumo.
          </p>
        </div>
        {admin && (
          <div className="pn-card" style={{ padding: "12px 18px" }}>
            <span className="pn-muted">Valor em estoque</span>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatBRL(totalValue)}</div>
          </div>
        )}
      </div>

      {admin && options.length > 0 && (
        <section className="pn-card pn-grid" aria-label="Lançar compra">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Lançar compra</h2>
            <p className="pn-muted" style={{ margin: 0 }}>Quantidade e valor pago. O custo médio do insumo se ajusta sozinho e entra no custo dos produtos.</p>
          </div>
          <PurchaseForm ingredients={options} />
        </section>
      )}

      {options.length > 0 && (
        <section className="pn-card pn-grid" aria-label="Registrar perda ou consumo">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Registrar perda ou consumo</h2>
            <p className="pn-muted" style={{ margin: 0 }}>Para o que saiu sem virar produto. Assim o estoque bate com a prateleira.</p>
          </div>
          <OutflowForm ingredients={options} />
        </section>
      )}

      <section className="pn-card pn-scroll" aria-label="Lista de insumos">
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Estoque</h2>
        {list.length === 0 ? (
          <p className="pn-muted" style={{ margin: 0 }}>
            {admin ? "Nenhum insumo ainda. Cadastre abaixo os ingredientes e embalagens que você compra." : "A administradora ainda não cadastrou insumos."}
          </p>
        ) : (
          <table className="pn-table">
            <thead>
              <tr>
                <th>Insumo</th><th>Estoque</th><th>Mínimo</th><th>Situação</th>
                {admin && <><th>Custo médio</th><th>Valor em estoque</th></>}
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const st = STATUS_LABEL[i.status];
                const a = admin ? (i as AdminIngredient) : null;
                return (
                  <tr key={i.id} style={{ opacity: i.active ? 1 : 0.55 }}>
                    <td>
                      <strong>{i.name}</strong>
                      {i.packageName && i.packageSizeMilli && (
                        <div className="pn-muted">1 {i.packageName} = {formatQty(i.packageSizeMilli, i.baseUnit)}</div>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatQty(i.stockMilli, i.baseUnit)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{i.minMilli > 0 ? formatQty(i.minMilli, i.baseUnit) : "—"}</td>
                    <td>{i.active ? <span className={`pn-tag ${st.cls}`}>{st.text}</span> : <span className="pn-tag off">inativo</span>}</td>
                    {a && (
                      <>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{avgLabel(a.avgCostCentsPerBase, a.baseUnit)}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{a.stockValueCents === null ? "—" : formatBRL(a.stockValueCents)}</td>
                      </>
                    )}
                    <td><Link className="pn-btn ghost small" href={`/painel/insumos/${i.id}`}>Detalhes</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {admin && (
        <section className="pn-card pn-grid" aria-label="Cadastrar insumo">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Cadastrar insumo</h2>
            <p className="pn-muted" style={{ margin: 0 }}>Ingredientes e também embalagens (pote, caixa, fita): tudo o que entra no custo do produto.</p>
          </div>
          <NewIngredientForm />
        </section>
      )}
    </div>
  );
}
