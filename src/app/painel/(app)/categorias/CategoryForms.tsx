"use client";

import { useActionState } from "react";
import { createCategoryAction, updateCategoryAction, type FormState } from "./actions";

export function NewCategoryForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCategoryAction, {});
  return (
    <form action={action} className="pn-card pn-grid" key={state.ok}>
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <div className="pn-field" style={{ flex: "1 1 240px" }}>
          <label htmlFor="cat-name">Nova categoria</label>
          <input className="pn-input" id="cat-name" name="name" placeholder="Ex.: Docinhos" required />
        </div>
        <button className="pn-btn" type="submit" disabled={pending}>Adicionar</button>
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      {state.ok && <p className="pn-msg ok" role="status">{state.ok}</p>}
    </form>
  );
}

export function CategoryRow({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCategoryAction, {});
  return (
    <form action={action} className="pn-row" style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
      <input type="hidden" name="id" value={id} />
      <input className="pn-input" name="name" defaultValue={name} aria-label="Nome da categoria" style={{ flex: "1 1 220px" }} />
      <label className="pn-row" style={{ gap: 8 }}>
        <input type="checkbox" name="active" defaultChecked={active} /> Aparece na loja
      </label>
      <button className="pn-btn ghost small" type="submit" disabled={pending}>Salvar</button>
      {state.error && <span className="pn-msg err" role="alert">{state.error}</span>}
      {state.ok && <span className="pn-muted" role="status">{state.ok}</span>}
    </form>
  );
}
