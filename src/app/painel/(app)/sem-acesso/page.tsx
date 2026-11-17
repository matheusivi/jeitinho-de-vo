import Link from "next/link";

export default function SemAcessoPage() {
  return (
    <div className="pn-card" style={{ maxWidth: 560 }}>
      <h1 className="pn-h1">Esta área é da administradora</h1>
      <p className="pn-sub">Sua conta cuida de pedidos e produção. Se precisar de algo daqui, peça para a administradora.</p>
      <Link className="pn-btn" href="/painel/pedidos">Ir para os pedidos</Link>
    </div>
  );
}
