"use client";

import { useActionState } from "react";
import { saveNeighborhoodAction, type NbState } from "./actions";

export function NbRow({ id, name, fee, active }: { id?: string; name?: string; fee?: string; active?: boolean }) {
  const [state, action, pending] = useActionState<NbState, FormData>(saveNeighborhoodAction, {});
  const isNew = !id;
  return (
    <form action={action} className="pn-row" style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }} key={isNew ? state.ok : id}>
      {id && <input type="hidden" name="id" value={id} />}
      <input className="pn-input" name="name" defaultValue={name} placeholder={isNew ? "Nome do bairro" : undefined} aria-label="Nome do bairro" required style={{ flex: "2 1 200px" }} />
      <span className="pn-row" style={{ gap: 6, flex: "0 1 140px" }}>
        <span className="pn-muted">R$</span>
        <input className="pn-input" name="fee" defaultValue={fee} placeholder="7,00" inputMode="decimal" aria-label="Taxa de entrega" required />
      </span>
      {!isNew && (
        <label className="pn-row" style={{ gap: 8 }}><input type="checkbox" name="active" defaultChecked={active} /> Entrega ativa</label>
      )}
      <button className={`pn-btn ${isNew ? "" : "ghost"} small`} type="submit" disabled={pending}>{isNew ? "Adicionar" : "Salvar"}</button>
      {state.error && <span className="pn-msg err" role="alert">{state.error}</span>}
      {state.ok && !isNew && <span className="pn-muted" role="status">{state.ok}</span>}
    </form>
  );
}
