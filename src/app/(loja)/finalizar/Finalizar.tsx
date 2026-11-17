"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useBag } from "@/components/loja/BagProvider";
import { formatBRL } from "@/lib/money";
import type { Neighborhood } from "@/lib/orders/fees";
import { placeOrderAction } from "../actions";

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function Finalizar({ bairros, open, opening }: { bairros: Neighborhood[]; open: boolean; opening: string }) {
  const bag = useBag();
  const router = useRouter();
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [bairroId, setBairroId] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!bag.ready) return <p className="lj-sub">Carregando…</p>;
  if (bag.lines.length === 0) {
    return (
      <div className="lj-cartao" style={{ maxWidth: 560 }}>
        <h3>Sua sacola está vazia</h3>
        <p>Escolha os doces antes de finalizar.</p>
        <Link className="lj-btn" href="/#cardapio">Ver a fornada de hoje</Link>
      </div>
    );
  }

  const fee = fulfillment === "DELIVERY" ? bairros.find((b) => b.id === bairroId)?.feeCents ?? null : 0;
  const total = bag.subtotalCents + (fee ?? 0);

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const r = await placeOrderAction({
        items: bag.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        fulfillment,
        customerName: String(form.get("name") ?? ""),
        customerPhone: phone,
        addressLine: fulfillment === "DELIVERY" ? String(form.get("address") ?? "") : undefined,
        neighborhoodId: fulfillment === "DELIVERY" ? bairroId : undefined,
        notes: String(form.get("notes") ?? "") || undefined,
      });
      if (r.ok) {
        bag.clear();
        router.push(`/pedido/${r.code}`);
        return;
      }
      if (r.error === "ESGOTADO") {
        setError(`${r.message} Volte à sacola para ver o que mudou.`);
        return;
      }
      setError(r.message);
    });
  }

  return (
    <form action={submit} className="lj-grid2" noValidate={false}>
      <div className="main lj-form">
        <fieldset className="lj-opcoes" aria-label="Como você quer receber">
          <label className="lj-opcao">
            <input type="radio" name="fulfillment" checked={fulfillment === "DELIVERY"} onChange={() => setFulfillment("DELIVERY")} />
            <div><strong>Receber em casa</strong><span>Entrega em Nova Andradina, taxa por bairro.</span></div>
          </label>
          <label className="lj-opcao">
            <input type="radio" name="fulfillment" checked={fulfillment === "PICKUP"} onChange={() => setFulfillment("PICKUP")} />
            <div><strong>Retirar na loja</strong><span>Sem taxa. Avisamos quando estiver pronto.</span></div>
          </label>
        </fieldset>

        <div className="lj-cartao lj-form">
          <div className="lj-campo">
            <label htmlFor="f-name">Seu nome</label>
            <input className="lj-input" id="f-name" name="name" autoComplete="name" required minLength={2} maxLength={80} />
          </div>
          <div className="lj-campo">
            <label htmlFor="f-phone">WhatsApp</label>
            <input
              className="lj-input" id="f-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required
              placeholder="(67) 99999-0000" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))}
            />
          </div>
          {fulfillment === "DELIVERY" && (
            <>
              <div className="lj-campo">
                <label htmlFor="f-bairro">Bairro</label>
                <select className="lj-input" id="f-bairro" name="bairro" required value={bairroId} onChange={(e) => setBairroId(e.target.value)}>
                  <option value="" disabled>Escolha o bairro</option>
                  {bairros.map((b) => <option key={b.id} value={b.id}>{b.name} · {formatBRL(b.feeCents)}</option>)}
                </select>
                {bairros.length === 0 && <p className="lj-erro">Nenhum bairro cadastrado para entrega. Escolha retirar na loja.</p>}
              </div>
              <div className="lj-campo">
                <label htmlFor="f-address">Endereço</label>
                <input className="lj-input" id="f-address" name="address" autoComplete="street-address" required maxLength={200} placeholder="Rua, número e complemento" />
              </div>
            </>
          )}
          <div className="lj-campo">
            <label htmlFor="f-notes">Observação <span style={{ fontWeight: 500, color: "var(--ink-muted)" }}>(opcional)</span></label>
            <textarea className="lj-input" id="f-notes" name="notes" maxLength={300} placeholder="Ex.: tocar a campainha, sem cobertura" />
          </div>
        </div>
      </div>

      <aside className="side lj-cartao">
        <div className="lj-resumo">
          {bag.lines.map((l) => (
            <div key={l.productId} style={{ fontSize: 15 }}><span>{l.quantity}× {l.name}</span><span>{formatBRL(l.priceCents * l.quantity)}</span></div>
          ))}
          <div style={{ borderTop: "1.5px solid var(--line)", paddingTop: 10 }}><span>Subtotal</span><span>{formatBRL(bag.subtotalCents)}</span></div>
          <div><span>Entrega</span><span>{fulfillment === "PICKUP" ? "Grátis" : fee === null ? "escolha o bairro" : formatBRL(fee)}</span></div>
          <div className="total"><span>Total</span><span>{formatBRL(total)}</span></div>
        </div>
        <p style={{ margin: "16px 0", fontSize: 15, color: "var(--ink-muted)" }}>
          <strong style={{ color: "var(--ink)" }}>{fulfillment === "PICKUP" ? "Pagar na retirada" : "Pagar na entrega"}</strong>
          <br />Pix, cartão ou dinheiro na hora de {fulfillment === "PICKUP" ? "retirar" : "receber"}.
        </p>
        {error && <p className="lj-aviso-box" role="alert">{error}</p>}
        {open ? (
          <button className="lj-btn" type="submit" disabled={pending} style={{ width: "100%" }}>
            {pending ? "Enviando pedido…" : "Fazer pedido"}
          </button>
        ) : (
          <p className="lj-aviso-box" style={{ marginBottom: 0 }}>Estamos fechados. Abrimos {opening}.</p>
        )}
        <p style={{ margin: "12px 0 0", textAlign: "center" }}><Link href="/sacola" className="lj-link" style={{ fontSize: 15 }}>Voltar para a sacola</Link></p>
      </aside>
    </form>
  );
}
