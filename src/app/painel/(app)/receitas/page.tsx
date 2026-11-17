import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { formatBRL } from "@/lib/money";
import { listProductCosts } from "@/lib/ingredients/costing";
import { getCmvTargetBps } from "@/lib/settings";
import { CmvTargetForm } from "./RecipeForm";

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function ReceitasPage() {
  const user = await requireRole("ADMIN");
  const [rows, target] = await Promise.all([listProductCosts(user), getCmvTargetBps()]);
  const targetPct = target / 100;
  const withCost = rows.filter((r) => r.margin);
  const above = withCost.filter((r) => r.margin!.aboveTarget);
  const noRecipe = rows.filter((r) => r.active && !r.hasRecipe);

  return (
    <div className="pn-grid" style={{ gap: 24 }}>
      <div>
        <h1 className="pn-h1">Receitas e custos</h1>
        <p className="pn-sub" style={{ margin: 0 }}>
          A receita de cada produto diz quanto de cada insumo ele leva. Com ela, o sistema baixa o estoque na produção e calcula quanto custa cada unidade.
        </p>
      </div>

      <section className="pn-card pn-grid" aria-label="Como ler o custo">
        <h2 style={{ margin: 0, fontSize: 18 }}>Como ler esta tela</h2>
        <p style={{ margin: 0 }}>
          <strong>CMV</strong> é a parte do preço que paga os insumos. Um bolo de {formatBRL(1200)} que gasta {formatBRL(300)} de insumos tem CMV de 25%:
          sobram 75% (margem bruta) para pagar aluguel, luz, gás, mão de obra e o lucro. No setor de alimentação o CMV costuma ficar entre 20% e 40%.
        </p>
        <p style={{ margin: 0 }}>
          Produto acima da meta aparece marcado. O &ldquo;preço para a meta&rdquo; mostra quanto ele precisaria custar para ficar dentro dela.
          Luz, gás e mão de obra não entram aqui porque não dá para dividir com precisão por produto.
        </p>
        <CmvTargetForm targetPct={targetPct} />
      </section>

      <div className="pn-row" style={{ gap: 12 }}>
        <div className="pn-card" style={{ padding: "12px 18px" }}>
          <span className="pn-muted">Com custo calculado</span>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{withCost.length} de {rows.filter((r) => r.active).length}</div>
        </div>
        <div className="pn-card" style={{ padding: "12px 18px" }}>
          <span className="pn-muted">Acima da meta de {pct(targetPct)}</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: above.length ? "var(--goiaba-escuro)" : undefined }}>{above.length}</div>
        </div>
        <div className="pn-card" style={{ padding: "12px 18px" }}>
          <span className="pn-muted">Ativos sem receita</span>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{noRecipe.length}</div>
        </div>
      </div>

      <section className="pn-card pn-scroll" aria-label="Produtos">
        <table className="pn-table">
          <thead>
            <tr>
              <th>Produto</th><th>Preço</th><th>Custo por unidade</th><th>CMV</th><th>Margem bruta</th><th>Preço para a meta</th><th><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId} style={{ opacity: r.active ? 1 : 0.55 }}>
                <td><strong>{r.name}</strong>{!r.active && <div className="pn-muted">inativo</div>}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(r.priceCents)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {!r.hasRecipe ? <span className="pn-muted">sem receita</span>
                    : r.cost!.complete ? formatBRL(r.cost!.unitCostCents!)
                    : <span className="pn-tag warn">falta preço de {r.cost!.missing.join(", ")}</span>}
                </td>
                <td>
                  {r.margin ? <span className={`pn-tag ${r.margin.aboveTarget ? "warn" : ""}`}>{pct(r.margin.cmvPct)}</span> : "—"}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.margin ? `${pct(r.margin.marginPct)} (${formatBRL(r.margin.grossProfitCents)})` : "—"}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.margin ? (r.margin.aboveTarget ? <strong>{formatBRL(r.margin.priceForTargetCents)}</strong> : <span className="pn-muted">dentro da meta</span>) : "—"}
                </td>
                <td><Link className="pn-btn ghost small" href={`/painel/receitas/${r.productId}`}>{r.hasRecipe ? "Ver receita" : "Criar receita"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="pn-muted" style={{ margin: 0 }}>Cadastre produtos primeiro em Produtos.</p>}
      </section>
    </div>
  );
}
