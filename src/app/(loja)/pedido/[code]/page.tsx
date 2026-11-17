import Link from "next/link";
import { notFound } from "next/navigation";
import { formatBRL } from "@/lib/money";
import { getPublicOrder } from "@/lib/orders/public";
import { TIMEZONE } from "@/lib/store/hours";

export const metadata = { title: "Seu pedido · Jeitinho de Vó", robots: { index: false } };

const STEPS = {
  DELIVERY: [["CONFIRMED", "Pedido recebido"], ["PREPARING", "Em preparo"], ["OUT_FOR_DELIVERY", "Saiu para entrega"], ["DONE", "Entregue"]],
  PICKUP: [["CONFIRMED", "Pedido recebido"], ["PREPARING", "Em preparo"], ["READY_FOR_PICKUP", "Pronto para retirar"], ["DONE", "Retirado"]],
} as const;

const hora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE });

export default async function PedidoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const o = await getPublicOrder(code);
  if (!o) notFound();
  const steps = STEPS[o.fulfillment];
  const idx = steps.findIndex(([s]) => s === o.status);

  return (
    <main className="lj-pagina">
      <div className="wrap" style={{ maxWidth: 880 }}>
        <h1 className="lj-h1p">{o.status === "CANCELED" ? "Pedido cancelado" : `Obrigado, ${o.firstName}!`}</h1>
        <p className="lj-sub">
          Pedido <strong style={{ color: "var(--ink)", letterSpacing: ".06em" }}>{o.code}</strong> · {hora.format(o.createdAt)}
        </p>
        <div className="lj-grid2">
          <div className="main lj-cartao">
            {o.status === "CANCELED" ? (
              <p style={{ margin: 0 }}>Este pedido foi cancelado. Se tiver alguma dúvida, fale com a gente.</p>
            ) : (
              <ol className="lj-estados" aria-label="Andamento do pedido">
                {steps.map(([s, label], i) => (
                  <li key={s} className={i < idx ? "feito" : i === idx ? "agora" : ""} aria-current={i === idx ? "step" : undefined}>
                    <b aria-hidden="true">{i < idx ? "✓" : i + 1}</b>{label}
                  </li>
                ))}
              </ol>
            )}
            <p style={{ margin: "20px 0 0", fontSize: 15, color: "var(--ink-muted)" }}>
              {o.fulfillment === "DELIVERY"
                ? `Entrega no bairro ${o.neighborhoodName ?? ""}. Pague na entrega: Pix, cartão ou dinheiro.`
                : "Retirada na loja. Pague na retirada: Pix, cartão ou dinheiro."}{" "}
              Atualize esta página para ver o andamento.
            </p>
          </div>
          <aside className="side lj-cartao">
            <div className="lj-resumo">
              {o.items.map((it) => (
                <div key={it.name} style={{ fontSize: 15 }}><span>{it.quantity}× {it.name}</span><span>{formatBRL(it.unitPriceCents * it.quantity)}</span></div>
              ))}
              <div style={{ borderTop: "1.5px solid var(--line)", paddingTop: 10 }}><span>Subtotal</span><span>{formatBRL(o.subtotalCents)}</span></div>
              <div><span>Entrega</span><span>{o.deliveryFeeCents ? formatBRL(o.deliveryFeeCents) : "Grátis"}</span></div>
              <div className="total"><span>Total</span><span>{formatBRL(o.totalCents)}</span></div>
            </div>
          </aside>
        </div>
        <div className="lj-cartao" style={{ marginTop: 32 }}>
          <h3>Ganhe mimos da vó</h3>
          <p>Em breve: crie sua conta e participe de promoções e sorteios.</p>
          <Link className="lj-link" href="/conta" style={{ fontSize: 16 }}>Quero saber</Link>
        </div>
      </div>
    </main>
  );
}
