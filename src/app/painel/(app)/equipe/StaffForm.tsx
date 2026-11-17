"use client";

import { useActionState } from "react";
import { createStaffAction, type TeamState } from "./actions";

export function StaffForm() {
  const [state, action, pending] = useActionState<TeamState, FormData>(createStaffAction, {});
  return (
    <form action={action} className="pn-card pn-grid" key={state.ok}>
      <strong>Nova conta de funcionário</strong>
      <div className="pn-row">
        <div className="pn-field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="st-name">Nome</label>
          <input className="pn-input" id="st-name" name="name" required />
        </div>
        <div className="pn-field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="st-email">E-mail</label>
          <input className="pn-input" id="st-email" name="email" type="email" required />
        </div>
        <div className="pn-field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="st-pass">Senha inicial (mínimo 8)</label>
          <input className="pn-input" id="st-pass" name="password" type="text" minLength={8} required autoComplete="off" />
        </div>
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      {state.ok && <p className="pn-msg ok" role="status">{state.ok}</p>}
      <div><button className="pn-btn" type="submit" disabled={pending}>Criar conta</button></div>
    </form>
  );
}
