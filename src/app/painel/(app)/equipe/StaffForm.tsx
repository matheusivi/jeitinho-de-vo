"use client";

import { useFormAction } from "@/components/useFormAction";
import { createStaffAction, resetMfaAction, setActiveAction, type TeamState } from "./actions";

export function StaffForm() {
  const [state, onSubmit, pending] = useFormAction<TeamState>(createStaffAction, {});
  return (
    <form onSubmit={onSubmit} className="pn-card pn-grid" key={state.ok}>
      <strong>Nova conta</strong>
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
        <div className="pn-field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="st-role">Acesso</label>
          <select className="pn-input" id="st-role" name="role" defaultValue="STAFF">
            <option value="STAFF">Funcionária</option>
            <option value="ADMIN">Administradora (vê tudo)</option>
          </select>
        </div>
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      {state.ok && <p className="pn-msg ok" role="status">{state.ok}</p>}
      <div><button className="pn-btn" type="submit" disabled={pending}>Criar conta</button></div>
    </form>
  );
}

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [state, onSubmit, pending] = useFormAction<TeamState>(setActiveAction, {});
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <button className="pn-btn ghost small" type="submit" disabled={pending}>{active ? "Desativar" : "Reativar"}</button>
      {state.error && <p className="pn-msg err" role="alert" style={{ marginTop: 6 }}>{state.error}</p>}
    </form>
  );
}

export function ResetMfaButton({ id }: { id: string }) {
  const [state, onSubmit, pending] = useFormAction<TeamState>(resetMfaAction, {});
  if (state.ok) return <span className="pn-muted">{state.ok}</span>;
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <button className="pn-btn ghost small" type="submit" disabled={pending}>Zerar código do celular</button>
      {state.error && <p className="pn-msg err" role="alert" style={{ marginTop: 6 }}>{state.error}</p>}
    </form>
  );
}
