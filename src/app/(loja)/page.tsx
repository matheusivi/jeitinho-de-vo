import { Cardapio } from "@/components/loja/Cardapio";
import { facebookUrl, INSTAGRAM_URL, whatsappUrl } from "@/lib/store/contact";
import { isOpen, openingLabel } from "@/lib/store/hours";
import { getMenu } from "@/lib/store/menu";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const [menu, open] = [await getMenu(), isOpen(now)];
  const opening = openingLabel(now);
  const total = menu.reduce((n, c) => n + c.items.length, 0);
  const wa = whatsappUrl("Olá! Quero encomendar para uma festa.");
  const waContato = whatsappUrl("Olá, Jeitinho de Vó!");
  const fb = facebookUrl();

  return (
    <main>
      <section className="lj-hero" id="topo">
        <div className="wrap">
          <div className="lj-hero-txt">
            <h1 className="lj-h1">Bolo de vó, saído do forno hoje cedo.</h1>
            <p className="lj-lead">
              Doceria artesanal. Receita de caderno de família, feita em fornada pequena. Escolha aqui e
              receba em casa em Nova Andradina, ou retire na loja.
            </p>
            <div className="lj-ctas">
              <a className="lj-btn" href="#cardapio">
                Ver a fornada de hoje
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
              <a className="lj-link" href="#encomendas">Encomendar para festa</a>
            </div>
            <div className="lj-selos">
              <span>Primeira loja em breve</span>
              <span>Delivery em Nova Andradina</span>
            </div>
          </div>
          <div className="lj-foto">
            <div className="lj-foto-in">
              <div className="lj-foto-disco" aria-hidden="true" />
              <div className="lj-foto-sombra" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/loja/bolo-hero.webp" alt="Bolo cremoso de morango com cobertura de caramelo e chantilly" fetchPriority="high" />
              {total > 0 && (
                <div className="lj-pilula">
                  <i aria-hidden="true" />
                  <span><strong style={{ display: "block", fontSize: 15 }}>Na vitrine agora</strong>{total} {total === 1 ? "delícia pronta" : "delícias prontas"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="lj-calda" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loja/calda.webp" alt="" />
      </div>

      <Cardapio menu={menu} open={open} opening={opening} />

      <section id="encomendas" className="lj-secao">
        <div className="wrap lj-duas">
          <div>
            <h2 className="lj-h2">Festa chegando? Encomende com dois dias.</h2>
            <p style={{ margin: "20px 0 0", maxWidth: "32em", fontSize: 18, color: "var(--ink-muted)" }}>
              Bolo de aniversário, kit festa ou café da firma. A gente confirma o valor antes de começar.
            </p>
            <ol className="lj-passos">
              <li><b>1</b><div><strong>Conte a ocasião</strong><p>Data, quantas pessoas e os sabores que você gosta.</p></div></li>
              <li><b>2</b><div><strong>Receba o valor</strong><p>Confirmamos data, preço e sinal. Sem surpresa no dia.</p></div></li>
              <li><b>3</b><div><strong>Busque ou receba</strong><p>Embalado para viagem, com horário marcado.</p></div></li>
            </ol>
          </div>
          <div className="lj-cartao">
            <h3>Kit festa no site, em breve</h3>
            <p>Logo você vai montar o kit aqui, escolhendo o número de convidados. Por enquanto, a encomenda é pelo nosso atendimento.</p>
            <a className="lj-btn" href={wa ?? INSTAGRAM_URL}>{wa ? "Encomendar pelo WhatsApp" : "Falar pelo Instagram"}</a>
          </div>
        </div>
      </section>

      <section className="lj-vo" id="vo">
        <div className="wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/loja/selo-v2.webp" alt="Selo Jeitinho de Vó" width={220} height={220} loading="lazy" />
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <p className="lj-vo-frase">Manteiga de verdade, ovo caipira e nada de massa pronta. Se a vó não colocaria, a gente também não coloca.</p>
            <p style={{ margin: "20px 0 0", fontWeight: 600 }}>Doceria artesanal · Nova Andradina, MS</p>
          </div>
        </div>
      </section>

      <section id="contato" className="lj-secao">
        <div className="wrap">
          <h2 className="lj-h2">Fale conosco</h2>
          <p style={{ margin: "16px 0 28px", fontSize: 18, color: "var(--ink-muted)", maxWidth: "36em" }}>
            Dúvida sobre um sabor, um pedido ou uma encomenda? Chama a gente.
          </p>
          <div className="lj-canais">
            {waContato && <a className="lj-canal" href={waContato}>WhatsApp</a>}
            <a className="lj-canal" href={INSTAGRAM_URL}>Instagram</a>
            {fb && <a className="lj-canal" href={fb}>Facebook</a>}
          </div>
        </div>
      </section>
    </main>
  );
}
