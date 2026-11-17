import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { imageUrl } from "@/lib/catalog/images";
import { listProductsAdmin } from "@/lib/catalog/products";
import { formatBRL } from "@/lib/money";

export default async function ProdutosPage() {
  await requireRole("ADMIN");
  const rows = await listProductsAdmin();
  return (
    <div className="pn-grid">
      <div className="pn-row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="pn-h1">Produtos</h1>
          <p className="pn-sub" style={{ margin: 0 }}>O que não tem estoque não aparece na loja. O estoque se lança em Produzi hoje.</p>
        </div>
        <Link className="pn-btn" href="/painel/produtos/novo">Novo produto</Link>
      </div>
      <div className="pn-card pn-scroll">
        {rows.length === 0 ? (
          <p className="pn-muted">Nenhum produto cadastrado. Comece pelo botão Novo produto.</p>
        ) : (
          <table className="pn-table">
            <thead><tr><th></th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Em estoque</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {rows.map(({ product: p, categoryName }) => (
                <tr key={p.id}>
                  <td style={{ width: 64 }}>
                    {p.imageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl(p.imageKey, 480)} alt="" width={48} height={48} style={{ borderRadius: 10, display: "block", objectFit: "cover" }} />
                    ) : <span className="pn-tag off">sem foto</span>}
                  </td>
                  <td><strong>{p.name}</strong><div className="pn-muted">{p.unitLabel}</div></td>
                  <td>{categoryName}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(p.priceCents)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.stockOnHand - p.stockReserved}</td>
                  <td><span className={`pn-tag ${p.active ? "" : "off"}`}>{p.active ? "Ativo" : "Desativado"}</span></td>
                  <td><Link className="pn-btn ghost small" href={`/painel/produtos/${p.id}`}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
