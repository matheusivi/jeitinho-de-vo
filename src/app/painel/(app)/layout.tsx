import Link from "next/link";
import { needsMfaSetup, requireUserForSetup } from "@/lib/auth/guard";
import { lowStockAlerts } from "@/lib/ingredients/ingredients";
import { formatQty } from "@/lib/ingredients/units";
import { NavLink } from "@/components/painel/NavLink";
import { logoutAction } from "../(auth)/login/actions";
import "../painel.css";

export const metadata = { title: "Painel · Jeitinho de Vó", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  // a própria página exige o código; o layout só não pode redirecionar, senão a tela de configuração entra em loop
  const user = await requireUserForSetup();
  const setup = needsMfaSetup(user);
  const admin = user.role === "ADMIN" && !setup;
  const alerts = setup ? [] : await lowStockAlerts();
  return (
    <div className="pn">
      <header className="pn-top">
        <div className="wrap pn-top-in">
          <span className="pn-brand">Jeitinho de Vó</span>
          <nav className="pn-nav" aria-label="Painel">
            {!setup && <NavLink href="/painel/pedidos">Pedidos</NavLink>}
            {!setup && <NavLink href="/painel/producao">Produzi hoje</NavLink>}
            {!setup && <NavLink href="/painel/insumos">Insumos</NavLink>}
            {admin && <NavLink href="/painel/receitas">Receitas e custos</NavLink>}
            {admin && <NavLink href="/painel/relatorios">Relatórios</NavLink>}
            {admin && <NavLink href="/painel/produtos">Produtos</NavLink>}
            {admin && <NavLink href="/painel/categorias">Categorias</NavLink>}
            {admin && <NavLink href="/painel/bairros">Bairros</NavLink>}
            {admin && <NavLink href="/painel/equipe">Equipe</NavLink>}
            <NavLink href="/painel/seguranca">Segurança</NavLink>
          </nav>
          <div className="pn-user">
            <span>{user.name}</span>
            <form action={logoutAction}>
              <button className="pn-link" type="submit">Sair</button>
            </form>
          </div>
        </div>
      </header>
      {alerts.length > 0 && (
        <div className="pn-alert" role="status">
          <div className="wrap pn-row" style={{ gap: 8 }}>
            <strong>{alerts.length === 1 ? "1 insumo precisa de atenção:" : `${alerts.length} insumos precisam de atenção:`}</strong>
            <span>
              {alerts.slice(0, 4).map((a) => `${a.name} (${a.status === "NEGATIVE" ? "negativo" : formatQty(a.stockMilli, a.baseUnit)})`).join(", ")}
              {alerts.length > 4 ? ` e mais ${alerts.length - 4}` : ""}
            </span>
            <Link href="/painel/insumos" className="pn-alert-link">Ver insumos</Link>
          </div>
        </div>
      )}
      <main className="wrap pn-main">{children}</main>
    </div>
  );
}
