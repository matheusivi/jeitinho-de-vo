"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useBag } from "@/components/loja/BagProvider";
import { Thumb } from "@/components/loja/Thumb";
import { formatBRL } from "@/lib/money";
import { reconcileBag } from "@/lib/store/bag";
import { refreshBagAction } from "../actions";

export function Sacola({ open, opening }: { open: boolean; opening: string }) {
  const bag = useBag();
  const [changes, setChanges] = useState<string[]>([]);
  const [checking, setChecking] = useState(true);
  const checked = useRef(false);

  useEffect(() => {
    if (!bag.ready || checked.current) return;
    checked.current = true;
    const snapshot = bag.lines;
    if (snapshot.length === 0) {
      Promise.resolve().then(() => setChecking(false));
      return;
    }
    refreshBagAction(snapshot.map((l) => l.productId))
      .then((fresh) => {
        const r = reconcileBag(snapshot, fresh);
        if (r.changes.length) bag.replace(r.lines);
        setChanges(r.changes);
      })
      .catch(() => setChanges(["Não conseguimos conferir o estoque agora. Ele será conferido de novo ao finalizar."]))
      .finally(() => setChecking(false));
  }, [bag]);

  if (!bag.ready) return <p className="lj-sub">Carregando sua sacola…</p>;

  if (bag.lines.length === 0) {
    return (
      <div className="lj-cartao" style={{ maxWidth: 560 }}>
        {changes.length > 0 && <div className="lj-aviso-box">{changes.join(" ")}</div>}
        <h3>Sua sacola está vazia</h3>
        <p>Dá uma olhada no que saiu do forno hoje.</p>
        <Link className="lj-btn" href="/#cardapio">Ver a fornada de hoje</Link>
      </div>
    );
  }

  return (
    <div className="lj-grid2">
      <div className="main">
        {changes.length > 0 && (
          <div className="lj-aviso-box" role="status">
            Atualizamos sua sacola:
            <ul>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
        <div className="lj-cartao" style={{ paddingBlock: 8 }}>
          {bag.lines.map((l) => (
            <div className="lj-linha" key={l.productId}>
              <Thumb imageKey={l.imageKey} alt={l.name} />
              <div className="nome">
                <strong>{l.name}</strong>
                <span>{formatBRL(l.priceCents)} · {l.unitLabel}</span>
              </div>
              <div className="lj-qtd" role="group" aria-label={`Quantidade de ${l.name}`}>
                <button type="button" aria-label="Diminuir" onClick={() => bag.setQuantity(l.productId, l.quantity - 1)}>−</button>
                <output aria-live="polite">{l.quantity}</output>
                <button type="button" aria-label="Aumentar" disabled={l.quantity >= l.max} onClick={() => bag.setQuantity(l.productId, l.quantity + 1)}>+</button>
              </div>
              <div className="valor">{formatBRL(l.priceCents * l.quantity)}</div>
              <button type="button" className="lj-remover" onClick={() => bag.setQuantity(l.productId, 0)}>Remover</button>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16 }}><Link href="/#cardapio" className="lj-link" style={{ fontSize: 16 }}>Continuar escolhendo</Link></p>
      </div>
      <aside className="side lj-cartao">
        <div className="lj-resumo">
          <div><span>Subtotal</span><span>{formatBRL(bag.subtotalCents)}</span></div>
          <div className="lj-muted" style={{ fontSize: 14, color: "var(--ink-muted)" }}><span>Entrega</span><span>calculada no próximo passo</span></div>
        </div>
        {open ? (
          <Link className="lj-btn" href="/finalizar" style={{ width: "100%", marginTop: 20 }} aria-disabled={checking}>
            Continuar
          </Link>
        ) : (
          <p className="lj-aviso-box" style={{ marginTop: 20, marginBottom: 0 }}>Estamos fechados. Abrimos {opening}.</p>
        )}
      </aside>
    </div>
  );
}
