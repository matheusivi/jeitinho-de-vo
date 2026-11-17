import Link from "next/link";

export const metadata = { title: "Sua conta · Jeitinho de Vó" };

export default function ContaPage() {
  return (
    <main className="lj-pagina">
      <div className="wrap" style={{ maxWidth: 640 }}>
        <div className="lj-cartao">
          <h3>Sua conta está chegando</h3>
          <p>
            Em breve você vai poder criar sua conta para guardar endereços, acompanhar pedidos e participar das
            nossas promoções e sorteios. Por enquanto, dá para pedir normalmente sem cadastro.
          </p>
          <Link className="lj-btn" href="/#cardapio">Ver a fornada de hoje</Link>
        </div>
      </div>
    </main>
  );
}
