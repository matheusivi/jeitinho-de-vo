import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { db, schema } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { analyzeMargin, costRecipe } from "@/lib/ingredients/costing";
import { getRecipe } from "@/lib/ingredients/recipes";
import { formatQty } from "@/lib/ingredients/units";
import { getCmvTargetBps } from "@/lib/settings";
import { deleteRecipeAction } from "../actions";
import { RecipeForm } from "../RecipeForm";

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function ReceitaPage({ params }: { params: Promise<{ productId: string }> }) {
  await requireRole("ADMIN");
  const { productId } = await params;
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!product) notFound();
  const [recipe, ingredients, target] = await Promise.all([
    getRecipe(productId),
    db.select().from(schema.ingredients).where(eq(schema.ingredients.active, true)).orderBy(asc(schema.ingredients.name)),
    getCmvTargetBps(),
  ]);
  // insumos inativos que já estão na receita continuam escolhíveis para não sumirem da edição
  const options = [
    ...ingredients,
    ...(recipe?.items.filter((i) => !i.active).map((i) => ({ id: i.ingredientId, name: `${i.name} (inativo)`, baseUnit: i.baseUnit, packageName: i.packageName, packageSizeMilli: i.packageSizeMilli })) ?? []),
  ].map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit, packageName: i.packageName, packageSizeMilli: i.packageSizeMilli }));
  const cost = recipe ? costRecipe(recipe) : null;
  // "790 g (2 latas)": mostra também em embalagens quando a conta fecha ou passa de uma
  const pkgOf = new Map(
    (recipe?.items ?? []).flatMap((i) => {
      if (!i.packageName || !i.packageSizeMilli || i.qtyMilli < i.packageSizeMilli) return [];
      const n = Math.round((i.qtyMilli / i.packageSizeMilli) * 10) / 10;
      return [[i.ingredientId, `${n.toLocaleString("pt-BR")} ${i.packageName}${n === 1 ? "" : "s"}`]];
    }),
  );
  const margin = cost ? analyzeMargin(product.priceCents, cost.unitCostCents, target) : null;

  return (
    <div className="pn-grid" style={{ gap: 24 }}>
      <div>
        <Link href="/painel/receitas" className="pn-muted">← Receitas e custos</Link>
        <h1 className="pn-h1" style={{ marginTop: 8 }}>{product.name}</h1>
        <p className="pn-sub" style={{ margin: 0 }}>Preço de venda {formatBRL(product.priceCents)} por {product.unitLabel}.</p>
      </div>

      {cost && (
        <section className="pn-card pn-grid" aria-label="Custo do produto">
          <h2 style={{ margin: 0, fontSize: 18 }}>Quanto custa</h2>
          {!cost.complete && (
            <p className="pn-msg err" style={{ margin: 0 }}>
              Falta o preço de {cost.missing.join(", ")}. Lance uma compra desse insumo para o custo ficar completo.
              Sem ele, o custo conhecido é {formatBRL(cost.knownCostCents)} por receita.
            </p>
          )}
          <div className="pn-row" style={{ gap: 12, alignItems: "stretch" }}>
            <Metric label="Custo por unidade" value={cost.unitCostCents === null ? "incompleto" : formatBRL(cost.unitCostCents)} />
            <Metric label={`Custo da receita (rende ${cost.yieldQty})`} value={cost.batchCostCents === null ? "incompleto" : formatBRL(cost.batchCostCents)} />
            {margin && (
              <>
                <Metric label="CMV" value={pct(margin.cmvPct)} warn={margin.aboveTarget} hint={`meta ${pct(target / 100)}`} />
                <Metric label="Margem bruta por unidade" value={`${formatBRL(margin.grossProfitCents)} (${pct(margin.marginPct)})`} />
                <Metric label="Markup" value={`${margin.markup.toLocaleString("pt-BR")}×`} hint="preço ÷ custo" />
              </>
            )}
          </div>
          {margin?.aboveTarget && (
            <p className="pn-msg err" style={{ margin: 0 }}>
              Acima da meta: os insumos levam {pct(margin.cmvPct)} do preço. Para ficar em {pct(target / 100)}, o preço precisaria ser {formatBRL(margin.priceForTargetCents)},
              ou a receita precisaria ficar mais barata.
            </p>
          )}

          <div className="pn-scroll">
            <table className="pn-table">
              <thead><tr><th>Insumo</th><th>Quantidade na receita</th><th>Custo na receita</th><th>Peso no custo</th></tr></thead>
              <tbody>
                {cost.lines.map((l) => (
                  <tr key={l.ingredientId}>
                    <td>{l.name}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(l.qtyMilli, l.baseUnit)}
                      {pkgOf.get(l.ingredientId) && <span className="pn-muted"> ({pkgOf.get(l.ingredientId)})</span>}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{l.lineCostCents === null ? <span className="pn-tag warn">sem preço</span> : formatBRL(l.lineCostCents)}</td>
                    <td style={{ minWidth: 180 }}>
                      {l.lineCostCents !== null && (
                        <div className="pn-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                          <div aria-hidden style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--line)" }}>
                            <div style={{ width: `${Math.min(100, l.sharePct)}%`, height: "100%", borderRadius: 4, background: "var(--cyan-deep)" }} />
                          </div>
                          <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "right" }}>{pct(l.sharePct)}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pn-muted" style={{ margin: 0 }}>
            O custo usa o custo médio das compras de cada insumo e se atualiza a cada compra nova. Os pedidos guardam o custo do dia da venda.
          </p>
        </section>
      )}

      <section className="pn-card pn-grid" aria-label="Receita">
        <h2 style={{ margin: 0, fontSize: 18 }}>{recipe ? "Editar receita" : "Criar receita"}</h2>
        <RecipeForm
          productId={product.id} productName={product.name} ingredients={options}
          initial={recipe ? { yieldQty: recipe.yieldQty, notes: recipe.notes, items: recipe.items.map((i) => ({ ingredientId: i.ingredientId, qtyMilli: i.qtyMilli })) } : null}
        />
        {recipe && (
          <form action={deleteRecipeAction}>
            <input type="hidden" name="productId" value={product.id} />
            <button className="pn-btn danger small" type="submit">Apagar receita</button>
          </form>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div style={{ padding: "10px 16px", border: "1.5px solid var(--line)", borderRadius: 12, minWidth: 150 }}>
      <div className="pn-muted">{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: warn ? "var(--goiaba-escuro)" : undefined }}>{value}</div>
      {hint && <div className="pn-muted" style={{ fontSize: 12 }}>{hint}</div>}
    </div>
  );
}
