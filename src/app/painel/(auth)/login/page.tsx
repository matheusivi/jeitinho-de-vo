import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import "../../painel.css";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Painel Jeitinho de Vó" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/painel/pedidos");
  return (
    <main className="pn-login">
      <LoginForm />
    </main>
  );
}
