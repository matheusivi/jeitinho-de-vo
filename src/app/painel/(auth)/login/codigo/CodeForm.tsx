"use client";

import Link from "next/link";
import { useFormAction } from "@/components/useFormAction";
import { codeAction, type CodeState } from "../actions";

export function CodeForm() {
  const [state, onSubmit, pending] = useFormAction<CodeState>(codeAction, {});
  if (state.expired) {
    return (
      <div className="pn-grid">
        <p className="pn-msg err" role="alert">{state.error}</p>
        <Link className="pn-btn" href="/painel/login">Voltar para o login</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit}>
      <div>
        <h1 className="pn-h1">Código do celular</h1>
        <p className="pn-muted">Abra o aplicativo autenticador e digite o código de 6 números da Jeitinho de Vó.</p>
      </div>
      <div className="pn-field">
        <label htmlFor="code">Código</label>
        <input
          className="pn-input" id="code" name="code" required autoFocus autoComplete="one-time-code"
          inputMode="text" maxLength={14} placeholder="123456" style={{ fontSize: 24, letterSpacing: 4, textAlign: "center" }}
        />
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      <button className="pn-btn" type="submit" disabled={pending}>{pending ? "Conferindo…" : "Entrar"}</button>
      <p className="pn-muted" style={{ fontSize: 14 }}>
        Sem o celular? Digite um dos códigos de recuperação que você imprimiu (cada um vale uma vez).
      </p>
    </form>
  );
}
