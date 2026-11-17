import { requireUser } from "@/lib/auth/guard";
import { formatBRL } from "@/lib/money";
import { listOrdersForPanel, whatsappStatusLink, type PanelOrder } from "@/lib/orders/views";
import { AutoRefresh } from "./AutoRefresh";
import { OrderCard } from "./OrderCard";

const GROUPS: [string, PanelOrder["status"][]][] = [
  ["Novos", ["CONFIRMED"]],
  ["Em preparo", ["PREPARING"]],
  ["Saindo ou aguardando retirada", ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP"]],
  ["Concluídos", ["DONE"]],
  ["Cancelados", ["CANCELED"]],
];

export default async function PedidosPage() {
  const user = await requireUser();
  const orders = await listOrdersForPanel(user, { day: new Date() });
  const aReceber =
    user.role === "ADMIN"
      ? orders.reduce((n, o) => n + ("paymentStatus" in o && o.paymentStatus === "PENDING" && o.status !== "CANCELED" ? o.totalCents : 0), 0)
      : 0;

  return (
    <div className="pn-grid" style={{ gap: 24 }}>
      <AutoRefresh />
      <div className="pn-row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="pn-h1">Pedidos</h1>
          <p className="pn-sub" style={{ margin: 0 }}>Os de hoje e os que ficaram em aberto. A lista se atualiza sozinha.</p>
        </div>
        {user.role === "ADMIN" && (
          <div className="pn-card" style={{ padding: "12px 18px" }}>
            <span className="pn-muted">A receber</span>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatBRL(aReceber)}</div>
          </div>
        )}
      </div>

      {orders.length === 0 && (
        <div className="pn-card"><p className="pn-muted" style={{ margin: 0 }}>Nenhum pedido em aberto. Assim que chegar, aparece aqui.</p></div>
      )}

      {GROUPS.map(([title, statuses]) => {
        const list = orders.filter((o) => statuses.includes(o.status));
        if (list.length === 0) return null;
        return (
          <section key={title} aria-label={title} className="pn-grid">
            <h2 style={{ margin: 0, fontSize: 18 }}>{title} <span className="pn-muted">({list.length})</span></h2>
            <div className="pn-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))" }}>
              {list.map((o) => <OrderCard key={o.id} order={o} waLink={whatsappStatusLink(o)} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
