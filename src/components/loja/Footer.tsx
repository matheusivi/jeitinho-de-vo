import Link from "next/link";
import { facebookUrl, INSTAGRAM_URL, whatsappNumber, whatsappUrl } from "@/lib/store/contact";

function formatPhone(n: string): string {
  const d = n.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d;
}

export function Footer() {
  const wa = whatsappUrl();
  const num = whatsappNumber();
  const fb = facebookUrl();
  return (
    <footer className="lj-rodape">
      <div className="wrap cols">
        <div style={{ flex: "1 1 260px", maxWidth: 340 }}>
          <p className="marca">Jeitinho de Vó</p>
          <p style={{ marginTop: 10 }}>Doceria artesanal. Bolo de receita de família, feito no dia.</p>
        </div>
        <div style={{ flex: "0 1 220px" }}>
          <h3>Horário</h3>
          <p>Segunda a sábado, das 8h às 18h<br />Domingo fechado</p>
        </div>
        <div style={{ flex: "0 1 220px" }}>
          <h3>Loja</h3>
          <p>
            Nova Andradina, MS<br />Primeira loja física em breve
            {num && wa && (<><br />WhatsApp: <a href={wa}>{formatPhone(num)}</a></>)}
          </p>
        </div>
        <div style={{ flex: "0 1 200px", display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ marginBottom: 4 }}>Mais</h3>
          <a href={INSTAGRAM_URL}>Instagram @jeitinhodevodoces</a>
          {fb && <a href={fb}>Facebook</a>}
          <Link href="/painel" style={{ color: "var(--cyan)", fontWeight: 600 }}>Área da loja</Link>
        </div>
      </div>
      <div className="wrap base">© {new Date().getFullYear()} Jeitinho de Vó · doceria artesanal</div>
    </footer>
  );
}
