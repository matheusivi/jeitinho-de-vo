"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, login, MFA_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";
import { verifyChallenge } from "@/lib/auth/mfa";
import { clientIp } from "@/lib/http";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const result = await login(email, password, await clientIp());
  if (!result.ok) {
    return {
      error:
        result.error === "BLOCKED"
          ? "Muitas tentativas. Tente de novo em 15 minutos."
          : "E-mail ou senha incorretos.",
    };
  }
  const store = await cookies();
  if (result.ok === "MFA") {
    // senha certa; a sessão só nasce depois do código do celular
    store.set(MFA_COOKIE, result.challengeToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/painel/login",
      expires: result.expiresAt,
    });
    redirect("/painel/login/codigo");
  }
  setSessionCookie(store, result.token, result.expiresAt);
  redirect("/painel/pedidos");
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;
function setSessionCookie(store: CookieStore, token: string, expiresAt: Date): void {
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export type CodeState = { error?: string; expired?: boolean };

export async function codeAction(_prev: CodeState, form: FormData): Promise<CodeState> {
  const store = await cookies();
  const result = await verifyChallenge(store.get(MFA_COOKIE)?.value, String(form.get("code") ?? ""));
  if (!result.ok) {
    if (result.error === "EXPIRED") {
      store.delete({ name: MFA_COOKIE, path: "/painel/login" });
      return { error: "A tentativa expirou ou teve erros demais. Entre de novo com a senha.", expired: true };
    }
    return { error: "Código incorreto. Use o código que aparece agora no aplicativo, ou um código de recuperação." };
  }
  store.delete({ name: MFA_COOKIE, path: "/painel/login" });
  const session = await createSession(result.userId);
  setSessionCookie(store, session.token, session.expiresAt);
  redirect("/painel/pedidos");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  store.delete(SESSION_COOKIE);
  redirect("/painel/login");
}
