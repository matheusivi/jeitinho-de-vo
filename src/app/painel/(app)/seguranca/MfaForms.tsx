"use client";

import Link from "next/link";
import { useFormAction } from "@/components/useFormAction";
import { confirmAction, disableAction, regenerateAction, type MfaState } from "./actions";

function CodeInput({ id, label = "Código do aplicativo" }: { id: string; label?: string }) {
  return (
    <div className="pn-field" style={{ flex: "0 1 200px" }}>
      <label htmlFor={id}>{label}</label>
      <input
        className="pn-input" id={id} name="code" required inputMode="numeric" autoComplete="one-time-code"
        maxLength={7} placeholder="123456" style={{ fontSize: 20, letterSpacing: 3 }}
      />
    </div>
  );
}

export function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="pn-card pn-grid pn-recovery" role="status">
      <h2 style={{ margin: 0, fontSize: 18 }}>Guarde estes códigos de recuperação</h2>
      <p style={{ margin: 0 }}>
        Se perder o celular, cada código abaixo serve para entrar <strong>uma vez</strong>. Imprima ou anote e guarde num lugar seguro,
        longe do celular. Eles não vão aparecer de novo.
      </p>
      <ol className="pn-codes">
        {codes.map((c) => <li key={c}><code>{c}</code></li>)}
      </ol>
      <div className="pn-row">
        <button className="pn-btn" type="button" onClick={() => window.print()}>Imprimir</button>
        <Link className="pn-btn ghost" href="/painel/pedidos">Já guardei, ir para o painel</Link>
      </div>
    </div>
  );
}

export function ConfirmForm() {
  const [state, onSubmit, pending] = useFormAction<MfaState>(confirmAction, {});
  if (state.codes) return <RecoveryCodes codes={state.codes} />;
  return (
    <form onSubmit={onSubmit} className="pn-grid">
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <CodeInput id="mfa-confirm" />
        <button className="pn-btn" type="submit" disabled={pending}>Ativar</button>
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
    </form>
  );
}

export function RegenerateForm() {
  const [state, onSubmit, pending] = useFormAction<MfaState>(regenerateAction, {});
  if (state.codes) return <RecoveryCodes codes={state.codes} />;
  return (
    <form onSubmit={onSubmit} className="pn-grid">
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <CodeInput id="mfa-regen" />
        <button className="pn-btn ghost" type="submit" disabled={pending}>Gerar novos códigos de recuperação</button>
      </div>
      <p className="pn-muted" style={{ margin: 0 }}>Os códigos antigos param de funcionar.</p>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
    </form>
  );
}

export function DisableForm() {
  const [state, onSubmit, pending] = useFormAction<MfaState>(disableAction, {});
  if (state.ok) return <p className="pn-msg ok" role="status">{state.ok}</p>;
  return (
    <form onSubmit={onSubmit} className="pn-grid">
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <CodeInput id="mfa-off" />
        <button className="pn-btn danger" type="submit" disabled={pending}>Desativar código no celular</button>
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
    </form>
  );
}
