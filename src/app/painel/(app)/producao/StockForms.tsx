"use client";

import { useActionState } from "react";
import { adjustAction, produceAction, type StockState } from "./actions";

export function ProduceRow({ id, name, unitLabel, available }: { id: string; name: string; unitLabel: string; available: number }) {
  const [state, action, pending] = useActionState<StockState, FormData>(produceAction, {});
  return (
    <form action={action} className="pn-row" style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }} key={state.ok ? `${id}-${available}` : id}>
      <input type="hidden" name="productId" value={id} />
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <strong>{name}</strong>
        <div className="pn-muted">{unitLabel}</div>
      </div>
      <span className={`pn-tag ${available === 0 ? "warn" : ""}`} style={{ minWidth: 92, textAlign: "center" }}>
        {available === 0 ? "sem estoque" : `${available} na loja`}
      </span>
      <input
        className="pn-input" name="quantity" type="number" inputMode="numeric" min={1} step={1} required
        placeholder="Qtd." aria-label={`Quantidade produzida de ${name}`} style={{ width: 96 }}
      />
      <button className="pn-btn" type="submit" disabled={pending}>Lançar</button>
      <span style={{ flex: "0 0 150px", fontSize: 14, fontWeight: 600 }} role="status">
        {state.error && <span style={{ color: "var(--goiaba-escuro)" }}>{state.error}</span>}
        {state.ok && <span style={{ color: "var(--cyan-deep)" }}>{state.ok}</span>}
      </span>
    </form>
  );
}

export function AdjustForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<StockState, FormData>(adjustAction, {});
  return (
    <form action={action} className="pn-grid" key={state.ok}>
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <div className="pn-field" style={{ flex: "2 1 220px" }}>
          <label htmlFor="adj-product">Produto</label>
          <select className="pn-input" id="adj-product" name="productId" required defaultValue="">
            <option value="" disabled>Escolha</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="pn-field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="adj-dir">O que aconteceu</label>
          <select className="pn-input" id="adj-dir" name="direction" defaultValue="remove">
            <option value="remove">Saiu do estoque</option>
            <option value="add">Entrou no estoque</option>
          </select>
        </div>
        <div className="pn-field" style={{ flex: "0 1 100px" }}>
          <label htmlFor="adj-qty">Quantidade</label>
          <input className="pn-input" id="adj-qty" name="quantity" type="number" inputMode="numeric" min={1} step={1} required />
        </div>
        <div className="pn-field" style={{ flex: "2 1 220px" }}>
          <label htmlFor="adj-reason">Motivo</label>
          <input className="pn-input" id="adj-reason" name="reason" placeholder="Ex.: quebrou, consumo, contagem" required maxLength={120} />
        </div>
        <button className="pn-btn ghost" type="submit" disabled={pending}>Registrar ajuste</button>
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      {state.ok && <p className="pn-msg ok" role="status">{state.ok}</p>}
    </form>
  );
}
