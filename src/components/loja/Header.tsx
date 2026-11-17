import Link from "next/link";
import { BagButton } from "./BagButton";

export function Header() {
  return (
    <header className="lj-head vovos">
      <div className="wrap">
        <Link className="lj-selo" href="/" aria-label="Jeitinho de Vó, início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/loja/selo-transp.webp" alt="Jeitinho de Vó, doceria artesanal" width={88} height={88} />
        </Link>
        <nav className="lj-nav" aria-label="Principal">
          <Link href="/#cardapio">Cardápio</Link>
          <Link href="/#encomendas">Encomendas</Link>
          <Link href="/#contato">Fale conosco</Link>
        </nav>
        <div className="lj-acoes">
          <Link className="lj-entrar" href="/conta">Entrar</Link>
          <BagButton />
        </div>
      </div>
    </header>
  );
}
