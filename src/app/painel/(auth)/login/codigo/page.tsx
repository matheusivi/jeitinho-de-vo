import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MFA_COOKIE } from "@/lib/auth/session";
import "../../../painel.css";
import { CodeForm } from "./CodeForm";

export const metadata = { title: "Código · Painel Jeitinho de Vó", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CodigoPage() {
  const store = await cookies();
  if (!store.get(MFA_COOKIE)) redirect("/painel/login");
  return (
    <main className="pn-login">
      <CodeForm />
    </main>
  );
}
