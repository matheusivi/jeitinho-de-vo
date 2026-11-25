"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBRL, parseBRL } from "@/lib/money";
import { splitEqual } from "@/lib/tables/split";
import type { TableDetail } from "@/lib/tables/tables";
import { addItemsAction, cancelTableAction, payAction, removeItemAction, type MesaResult } from "../actions";

type Json<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] extends (infer U)[] ? Json<U>[] : T[K] };
type Mesa = Json<TableDetail>;
type MenuCat = { name: string; items: { id: string; name: string; priceCents: number; available: number }[] };
type Tender = "CASH" | "PIX" | "CARD";

const TENDERS: [Tender, string][] = [["CASH", "Dinheiro"], ["PIX", "Pix"], ["CARD", "Cartão"]];
const TENDER_LABEL: Record<Tender, string> = { CASH: "Dinheiro", PIX: "Pix", CARD: "Cartão" };
const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Campo_Grande" });
const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function MesaClient({ mesa, menu, isAdmin }: { mesa: Mesa; menu: MenuCat[]; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const run = (fn: () => Promise<MesaResult>, ok?: string, after?: (r: MesaResult) => void) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (r?.error) setMsg({ kind: "err", text: r.error });
      else {
        if (ok) setMsg({ kind: "ok", text: ok });
        after?.(r);
      }
    });

  return (
    <div className="pn-grid" style={{ gap: 20 }}>
      <div className="pn-row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="pn-h1" style={{ margin: 0 }}>Mesa {mesa.number}</h1>
          <p className="pn-muted" style={{ margin: 0 }}>
            Aberta às {hora.format(new Date(mesa.openedAt))}{mesa.openedByName ? ` por ${mesa.openedByName}` : ""}
          </p>
        </div>
        <div className="pn-stat">
          <span className="pn-muted">{mesa.paidCents > 0 ? "Falta pagar" : "Total"}</span>
          <div style={{ fontSize: 26, fontWeight: 700 }} className="pn-num">{formatBRL(mesa.paidCents > 0 ? mesa.remainingCents : mesa.totalCents)}</div>
          {mesa.paidCents > 0 && <span className="pn-muted">de {formatBRL(mesa.totalCents)}</span>}
        </div>
      </div>

      {msg && <p className={`pn-msg ${msg.kind}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</p>}

      <div className="pn-mesa-cols">
        <Launcher menu={menu} pending={pending} onSend={(items, reset) => run(() => addItemsAction(mesa.orderId, items), "Enviado para a cozinha.", reset)} />
        <div className="pn-grid" style={{ alignContent: "start" }}>
          <Bill mesa={mesa} pending={pending} onRemove={(id, reason) => run(() => removeItemAction(id, reason), "Item tirado. A cozinha recebe o aviso.")} />
          {mesa.items.length > 0 && <Checkout mesa={mesa} pending={pending} run={run} />}
          <CancelTable mesa={mesa} isAdmin={isAdmin} pending={pending} onCancel={() => run(() => cancelTableAction(mesa.orderId))} />
        </div>
      </div>
    </div>
  );
}

function Launcher({ menu, pending, onSend }: {
  menu: MenuCat[];
  pending: boolean;
  onSend: (items: { productId: string; quantity: number; note?: string }[], reset: () => void) => void;
}) {
  const [cart, setCart] = useState<{ id: string; name: string; quantity: number; note: string }[]>([]);
  const [filter, setFilter] = useState("");
  const inCart = (id: string) => cart.filter((c) => c.id === id).reduce((n, c) => n + c.quantity, 0);
  const add = (id: string, name: string) =>
    setCart((c) => {
      const i = c.findIndex((x) => x.id === id && !x.note);
      if (i >= 0) return c.map((x, j) => (j === i ? { ...x, quantity: x.quantity + 1 } : x));
      return [...c, { id, name, quantity: 1, note: "" }];
    });
  const q = filter.trim().toLowerCase();

  return (
    <section className="pn-card pn-grid" aria-label="Lançar itens" style={{ alignContent: "start" }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Lançar</h2>
      <input className="pn-input" placeholder="Buscar produto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar produto" />
      <div className="pn-grid" style={{ gap: 12, maxHeight: 420, overflowY: "auto" }}>
        {menu.length === 0 && <p className="pn-muted" style={{ margin: 0 }}>Nada com estoque agora. Lance a produção em Produzi hoje.</p>}
        {menu.map((cat) => {
          const items = cat.items.filter((i) => !q || i.name.toLowerCase().includes(q));
          if (!items.length) return null;
          return (
            <div key={cat.name} className="pn-grid" style={{ gap: 6 }}>
              <strong style={{ fontSize: 14 }}>{cat.name}</strong>
              {items.map((i) => {
                const left = i.available - inCart(i.id);
                return (
                  <button key={i.id} type="button" className="pn-pick" disabled={left <= 0} onClick={() => add(i.id, i.name)}>
                    <span>{i.name}</span>
                    <span className="pn-muted pn-num">{formatBRL(i.priceCents)} · {left} disp.</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div className="pn-grid" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          {cart.map((c, idx) => (
            <div key={idx} className="pn-row" style={{ gap: 8 }}>
              <button type="button" className="pn-btn ghost small" aria-label={`Menos ${c.name}`}
                onClick={() => setCart((all) => all.flatMap((x, j) => (j !== idx ? [x] : x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : [])))}>−</button>
              <strong className="pn-num" style={{ minWidth: 24 }}>{c.quantity}×</strong>
              <span style={{ flex: 1, minWidth: 120 }}>{c.name}</span>
              <input className="pn-input" style={{ height: 36, flex: "1 1 160px" }} placeholder="Obs. para a cozinha" maxLength={120}
                value={c.note} aria-label={`Observação de ${c.name}`}
                onChange={(e) => setCart((all) => all.map((x, j) => (j === idx ? { ...x, note: e.target.value } : x)))} />
            </div>
          ))}
          <button className="pn-btn" disabled={pending}
            onClick={() => onSend(cart.map((c) => ({ productId: c.id, quantity: c.quantity, note: c.note.trim() || undefined })), () => setCart([]))}>
            {pending ? "Enviando..." : "Enviar para a cozinha"}
          </button>
        </div>
      )}
    </section>
  );
}

function Bill({ mesa, pending, onRemove }: { mesa: Mesa; pending: boolean; onRemove: (id: string, reason: string) => void }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  return (
    <section className="pn-card pn-grid" aria-label="Conta da mesa" style={{ gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Conta</h2>
      {mesa.items.length === 0 && <p className="pn-muted" style={{ margin: 0 }}>Nada lançado ainda.</p>}
      {mesa.items.map((i) => (
        <div key={i.id} className="pn-grid" style={{ gap: 4, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
          <div className="pn-row" style={{ justifyContent: "space-between", gap: 8 }}>
            <span><strong>{i.quantity}×</strong> {i.name}{i.paid && <span className="pn-tag" style={{ marginLeft: 8 }}>pago</span>}</span>
            <span className="pn-num">{formatBRL(i.unitPriceCents * i.quantity)}</span>
          </div>
          <span className="pn-muted">
            {i.note ? `${i.note} · ` : ""}{i.addedByName ?? ""}{i.addedAt ? ` às ${hora.format(new Date(i.addedAt))}` : ""}
            {!i.paid && removing !== i.id && (
              <button className="pn-link" style={{ color: "var(--ink-muted)", marginLeft: 8 }} onClick={() => { setRemoving(i.id); setReason(""); }}>tirar</button>
            )}
          </span>
          {removing === i.id && (
            <div className="pn-row" style={{ gap: 8 }}>
              <input className="pn-input" style={{ height: 36, flex: "1 1 180px" }} placeholder="Motivo (obrigatório)" value={reason}
                onChange={(e) => setReason(e.target.value)} aria-label="Motivo para tirar o item" autoFocus />
              <button className="pn-btn danger small" disabled={pending || !reason.trim()} onClick={() => { onRemove(i.id, reason); setRemoving(null); }}>Tirar e devolver</button>
              <button className="pn-btn ghost small" onClick={() => setRemoving(null)}>Voltar</button>
            </div>
          )}
        </div>
      ))}
      {mesa.payments.length > 0 && (
        <div className="pn-grid" style={{ gap: 4 }}>
          <strong style={{ fontSize: 14 }}>Pagamentos</strong>
          {mesa.payments.map((p) => (
            <div key={p.id} className="pn-row" style={{ justifyContent: "space-between", gap: 8 }}>
              <span className="pn-muted">{TENDER_LABEL[p.tender]} · {p.receivedByName}{p.itemNames.length ? ` · ${p.itemNames.join(", ")}` : ""}</span>
              <span className="pn-num">{formatBRL(p.amountCents)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Checkout({ mesa, pending, run }: {
  mesa: Mesa;
  pending: boolean;
  run: (fn: () => Promise<MesaResult>, ok?: string, after?: (r: MesaResult) => void) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"ALL" | "EQUAL" | "ITEMS">("ALL");
  const [tender, setTender] = useState<Tender>("PIX");
  const [people, setPeople] = useState(2);
  const [picked, setPicked] = useState<string[]>([]);
  const [cash, setCash] = useState("");
  const remaining = mesa.remainingCents;
  const parts = mode === "EQUAL" && people >= 1 && people <= 50 ? splitEqual(remaining, people) : [];
  const unpaid = mesa.items.filter((i) => !i.paid);
  const pickedTotal = unpaid.filter((i) => picked.includes(i.id)).reduce((n, i) => n + i.unitPriceCents * i.quantity, 0);
  const due = mode === "ALL" ? remaining : mode === "EQUAL" ? parts[0] ?? 0 : pickedTotal;
  const given = parseBRL(cash);
  const change = tender === "CASH" && given !== null && due > 0 ? given - due : null;
  const done = (r: MesaResult) => {
    setPicked([]);
    setCash("");
    // parte igual paga: divide o que falta entre quem ainda não pagou
    if (mode === "EQUAL") setPeople((p) => Math.max(1, p - 1));
    if (r.closed) setTimeout(() => router.push("/painel/mesas"), 900); };
  const okText = (amount: number) => `Recebido ${formatBRL(amount)}.`;

  const pay = () => {
    if (mode === "ITEMS") return run(() => payAction(mesa.orderId, { tender, itemIds: picked }), okText(pickedTotal), done);
    return run(() => payAction(mesa.orderId, { tender, amount: reais(due) }), okText(due), done);
  };

  return (
    <section className="pn-card pn-grid" aria-label="Fechar conta" style={{ gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Fechar conta</h2>
      <div className="pn-tabs" role="radiogroup" aria-label="Como pagar">
        {([["ALL", "Inteira"], ["EQUAL", "Dividir igual"], ["ITEMS", "Cada um o seu"]] as const).map(([m, label]) => (
          <button key={m} role="radio" aria-checked={mode === m} className={`pn-btn small ${mode === m ? "" : "ghost"}`} onClick={() => setMode(m)}>{label}</button>
        ))}
      </div>

      {mode === "EQUAL" && (
        <div className="pn-row" style={{ gap: 8 }}>
          <label className="pn-row" style={{ gap: 8 }}>
            <span>Pessoas que faltam pagar</span>
            <input className="pn-input" style={{ width: 80, height: 36 }} type="number" min={1} max={50} value={people} onChange={(e) => setPeople(Number(e.target.value))} />
          </label>
          {parts.length > 0 && <span className="pn-muted">{people === 1 ? "Última parte" : `Faltam ${people} partes`}: {[...new Set(parts)].map(formatBRL).join(" ou ")}. Registre uma por vez.</span>}
        </div>
      )}

      {mode === "ITEMS" && (
        <div className="pn-grid" style={{ gap: 6 }}>
          {unpaid.map((i) => (
            <label key={i.id} className="pn-row" style={{ gap: 8 }}>
              <input type="checkbox" checked={picked.includes(i.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, i.id] : p.filter((x) => x !== i.id)))} />
              <span style={{ flex: 1 }}>{i.quantity}× {i.name}</span>
              <span className="pn-num">{formatBRL(i.unitPriceCents * i.quantity)}</span>
            </label>
          ))}
        </div>
      )}

      <div className="pn-tabs" role="radiogroup" aria-label="Forma de pagamento">
        {TENDERS.map(([t, label]) => (
          <button key={t} role="radio" aria-checked={tender === t} className={`pn-btn small ${tender === t ? "" : "ghost"}`} onClick={() => setTender(t)}>{label}</button>
        ))}
      </div>

      {tender === "CASH" && due > 0 && (
        <label className="pn-row" style={{ gap: 8 }}>
          <span>Recebi R$</span>
          <input className="pn-input" style={{ width: 110, height: 36 }} inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder={reais(due)} />
          {change !== null && (change >= 0
            ? <strong>Troco {formatBRL(change)}</strong>
            : <span className="pn-msg err" style={{ padding: "4px 10px" }}>Faltam {formatBRL(-change)}</span>)}
        </label>
      )}

      <button className="pn-btn" disabled={pending || due <= 0 || (change !== null && change < 0)} onClick={pay}>
        {due > 0 ? `Registrar ${formatBRL(due)} em ${TENDER_LABEL[tender].toLowerCase()}` : "Escolha os itens"}
      </button>
    </section>
  );
}

function CancelTable({ mesa, isAdmin, pending, onCancel }: { mesa: Mesa; isAdmin: boolean; pending: boolean; onCancel: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const canCancel = mesa.payments.length === 0 && (mesa.items.length === 0 || isAdmin);
  if (!canCancel) return null;
  return confirm ? (
    <div className="pn-row" style={{ gap: 8 }}>
      <span className="pn-muted">{mesa.items.length ? "Cancelar a mesa e devolver tudo ao estoque?" : "Cancelar esta mesa aberta por engano?"}</span>
      <button className="pn-btn danger small" disabled={pending} onClick={onCancel}>Sim, cancelar</button>
      <button className="pn-btn ghost small" onClick={() => setConfirm(false)}>Não</button>
    </div>
  ) : (
    <button className="pn-btn ghost small" style={{ justifySelf: "start" }} onClick={() => setConfirm(true)}>Cancelar mesa</button>
  );
}
