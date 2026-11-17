"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destroySession, login, SESSION_COOKIE } from "@/lib/auth/session";
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
  store.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: result.expiresAt,
  });
  redirect("/painel/pedidos");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  store.delete(SESSION_COOKIE);
  redirect("/painel/login");
}
