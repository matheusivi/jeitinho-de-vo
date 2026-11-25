"use client";

import { useActionState, useState, useTransition } from "react";
import { openTableAction, setTableCountAction, type MesaResult } from "./actions";

export function OpenTableButton({ number }: { number: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      className="pn-mesa"
      disabled={pending}
      aria-label={`Mesa ${number}, livre. Abrir`}
      onClick={() => start(async () => {
        const r = await openTableAction(number);
        if (r?.error) setError(r.error);
      })}
    >
      <span className="pn-mesa-n">{number}</span>
      <span className="pn-mesa-info">{pending ? "Abrindo..." : error ?? "Livre · abrir"}</span>
    </button>
  );
}

export function TableCountForm({ current }: { current: number }) {
  const [state, action, pending] = useActionState<MesaResult, FormData>(setTableCountAction, {});
  return (
    <form action={action} className="pn-row">
      <label className="pn-field" style={{ width: 140 }}>
        <span>Mesas no salão</span>
        <input className="pn-input" name="count" type="number" min={1} max={50} defaultValue={current} required />
      </label>
      <button className="pn-btn" disabled={pending} style={{ alignSelf: "flex-end" }}>Salvar</button>
      {state.error && <p className="pn-msg err" role="alert" style={{ flexBasis: "100%" }}>{state.error}</p>}
    </form>
  );
}
