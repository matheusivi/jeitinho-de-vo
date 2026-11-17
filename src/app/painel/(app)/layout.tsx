import { requireUser } from "@/lib/auth/guard";
import { NavLink } from "@/components/painel/NavLink";
import { logoutAction } from "../(auth)/login/actions";
import "../painel.css";

export const metadata = { title: "Painel · Jeitinho de Vó", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const admin = user.role === "ADMIN";
  return (
    <div className="pn">
      <header className="pn-top">
        <div className="wrap pn-top-in">
          <span className="pn-brand">Jeitinho de Vó</span>
          <nav className="pn-nav" aria-label="Painel">
            <NavLink href="/painel/pedidos">Pedidos</NavLink>
            <NavLink href="/painel/producao">Produzi hoje</NavLink>
            {admin && <NavLink href="/painel/produtos">Produtos</NavLink>}
            {admin && <NavLink href="/painel/categorias">Categorias</NavLink>}
            {admin && <NavLink href="/painel/bairros">Bairros</NavLink>}
            {admin && <NavLink href="/painel/equipe">Equipe</NavLink>}
          </nav>
          <div className="pn-user">
            <span>{user.name}</span>
            <form action={logoutAction}>
              <button className="pn-link" type="submit">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="wrap pn-main">{children}</main>
    </div>
  );
}
