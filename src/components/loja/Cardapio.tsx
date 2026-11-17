"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/money";
import type { MenuCategory } from "@/lib/store/menu";
import { useBag } from "./BagProvider";

const thumb = (key: string) => `/midia/${key}-480.webp`;

export function Cardapio({ menu, open, opening }: { menu: MenuCategory[]; open: boolean; opening: string }) {
  const [tab, setTab] = useState("todos");
  const bag = useBag();
  const tabs = [{ id: "todos", name: "Todos" }, ...menu.map((c) => ({ id: c.id, name: c.name }))];
  const items = menu.filter((c) => tab === "todos" || c.id === tab).flatMap((c) => c.items);

  return (
    <section id="cardapio" className="lj-cardapio" aria-labelledby="cardapio-titulo">
      <div className="wrap">
        <div className="lj-cardapio-top">
          <div style={{ maxWidth: 560 }}>
            <h2 id="cardapio-titulo" className="lj-h2">A fornada de hoje</h2>
            <p style={{ margin: "12px 0 0", fontSize: 18 }}>
              {open ? "Só aparece o que está pronto agora. Quando acaba, acabou." : `Estamos fechados. Abrimos ${opening}.`}
            </p>
          </div>
          {menu.length > 1 && (
            <div className="lj-abas" role="tablist" aria-label="Filtrar cardápio">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lj-lista">
          {items.length === 0 ? (
            <div className="lj-vazio">
              <strong>A fornada de hoje ainda não saiu.</strong>
              <span>Volte daqui a pouco. Assim que a vó tirar do forno, aparece aqui.</span>
            </div>
          ) : (
            items.map((item) => {
              const inBag = bag.lines.find((l) => l.productId === item.id)?.quantity ?? 0;
              const full = inBag >= item.available;
              return (
                <div className="lj-item" key={item.id}>
                  {item.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="lj-thumb" src={thumb(item.imageKey)} alt={item.name} loading="lazy" width={96} height={96} />
                  ) : (
                    <div className="lj-thumb" aria-hidden="true" />
                  )}
                  <div className="lj-item-txt">
                    <h3>{item.name}</h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <div className={`lj-estoque ${item.available <= 4 ? "pouco" : ""}`}>
                    {item.available <= 4 ? `Restam ${item.available}` : "Pronto hoje"}
                  </div>
                  <div className="lj-preco">
                    <strong>{formatBRL(item.priceCents)}</strong>
                    <span>{item.unitLabel}</span>
                  </div>
                  <button
                    type="button"
                    className={`lj-add ${inBag > 0 ? "tem" : ""}`}
                    disabled={!open || full}
                    onClick={() =>
                      bag.add({
                        productId: item.id, name: item.name, priceCents: item.priceCents,
                        unitLabel: item.unitLabel, imageKey: item.imageKey, max: item.available,
                      })
                    }
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    {inBag > 0 ? `${inBag} na sacola` : "Pôr na sacola"}
                  </button>
                </div>
              );
            })
          )}
          <div className="lj-lista-pe">
            <span>Pague na entrega ou na retirada: Pix, cartão ou dinheiro.</span>
            {bag.count > 0 && <a href="/sacola" style={{ fontWeight: 700 }}>Ver sacola ({bag.count})</a>}
          </div>
        </div>
      </div>
    </section>
  );
}
