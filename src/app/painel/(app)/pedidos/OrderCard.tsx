"use client";

import { useState, useTransition } from "react";
import { formatBRL } from "@/lib/money";
import type { PanelOrder } from "@/lib/orders/views";
import { advanceAction, cancelAction, receivedAction } from "./actions";

const NEXT_LABEL: Record<string, Record<string, [string, string] | undefined>> = {
  DELIVERY: { CONFIRMED: ["PREPARING", "Começar preparo"], PREPARING: ["OUT_FOR_DELIVERY", "Saiu para entrega"], OUT_FOR_DELIVERY: ["DONE", "Entregue"] },
  PICKUP: { CONFIRMED: ["PREPARING", "Começar preparo"], PREPARING: ["READY_FOR_PICKUP", "Pronto para retirada"], READY_FOR_PICKUP: ["DONE", "Retirado"] },
};

const TZ = "America/Campo_Grande";
const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const diaHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
const quando = (d: Date) => (dia.format(d) === dia.format(new Date()) ? hora.format(d) : `de ${diaHora.format(d)}`);

export function OrderCard({ order, waLink }: { order: PanelOrder; waLink: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const isAdmin = "totalCents" in order;
  const [amount, setAmount] = useState(isAdmin ? (order.totalCents / 100).toFixed(2).replace(".", ",") : "");
  const next = NEXT_LABEL[order.fulfillment][order.status];
  const closed = order.status === "DONE" || order.status === "CANCELED";
  const showWa = order.status === "OUT_FOR_DELIVERY" || order.status === "READY_FOR_PICKUP";

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      setConfirmCancel(false);
    });

  return (
    <article className="pn-card pn-grid" style={{ gap: 12, opacity: order.status === "CANCELED" ? 0.6 : 1 }} aria-label={`Pedido ${order.code}`}>
      <div className="pn-row" style={{ justifyContent: "space-between" }}>
        <div>
          <strong style={{ fontSize: 20, letterSpacing: ".06em" }}>{order.code}</strong>
          <span className="pn-muted"> · {quando(new Date(order.createdAt))}</span>
        </div>
        <span className="pn-tag" style={{ background: order.fulfillment === "DELIVERY" ? "#e0f6f9" : "var(--surface)" }}>
          {order.fulfillment === "DELIVERY" ? `Entrega · ${order.neighborhoodName ?? ""}` : "Retirada na loja"}
        </span>
      </div>

      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16 }}>
        {order.items.map((i) => <li key={i.name}><strong>{i.quantity}×</strong> {i.name}</li>)}
      </ul>

      {order.notes && <p className="pn-msg ok" style={{ fontWeight: 500 }}>Obs.: {order.notes}</p>}

      <div className="pn-muted" style={{ fontSize: 15 }}>
        {order.customerName} · {order.customerPhone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3")}
        {order.fulfillment === "DELIVERY" && order.addressLine && <><br />{order.addressLine}</>}
      </div>

      {isAdmin && (
        <div className="pn-row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            Total <strong>{formatBRL(order.totalCents)}</strong>
            {order.deliveryFeeCents > 0 && <span className="pn-muted"> (entrega {formatBRL(order.deliveryFeeCents)})</span>}
          </span>
          {order.paymentStatus === "RECEIVED" ? (
            <span className="pn-tag">Recebido {formatBRL(order.receivedCents ?? 0)}</span>
          ) : order.status !== "CANCELED" ? (
            <span className="pn-row" style={{ gap: 8 }}>
              <label className="pn-muted" htmlFor={`rec-${order.id}`}>Recebido R$</label>
              <input id={`rec-${order.id}`} className="pn-input" style={{ width: 100, height: 36 }} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button className="pn-btn ghost small" disabled={pending} onClick={() => act(() => receivedAction(order.id, amount))}>Registrar</button>
            </span>
          ) : null}
        </div>
      )}

      {error && <p className="pn-msg err" role="alert">{error}</p>}

      {!closed && (
        <div className="pn-row">
          {next && (
            <button className="pn-btn" disabled={pending} onClick={() => act(() => advanceAction(order.id, next[0]))}>{next[1]}</button>
          )}
          {showWa && (
            <a className="pn-btn ghost" href={waLink} target="_blank" rel="noreferrer">Avisar no WhatsApp</a>
          )}
          {confirmCancel ? (
            <span className="pn-row" style={{ gap: 8 }}>
              <span className="pn-muted">Cancelar e devolver ao estoque?</span>
              <button className="pn-btn danger small" disabled={pending} onClick={() => act(() => cancelAction(order.id))}>Sim, cancelar</button>
              <button className="pn-btn ghost small" onClick={() => setConfirmCancel(false)}>Não</button>
            </span>
          ) : (
            <button className="pn-btn ghost small" style={{ marginLeft: "auto" }} onClick={() => setConfirmCancel(true)}>Cancelar pedido</button>
          )}
        </div>
      )}
    </article>
  );
}
