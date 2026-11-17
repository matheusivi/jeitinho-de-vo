"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action}>
      <div>
        <h1 className="pn-h1">Painel da loja</h1>
        <p className="pn-muted">Entre com a conta que a doceria criou para você.</p>
      </div>
      <div className="pn-field">
        <label htmlFor="email">E-mail</label>
        <input className="pn-input" id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="pn-field">
        <label htmlFor="password">Senha</label>
        <input className="pn-input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      <button className="pn-btn" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
