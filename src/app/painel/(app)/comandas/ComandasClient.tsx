"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PrintTicket } from "@/lib/printing/jobs";
import { claimAction, printedAction, recentAction, reprintAction } from "./actions";

type Job = { id: string; kind: string; ticket: PrintTicket; createdAt: string; printedAt: string | null };
const AUTO_KEY = "jdv-comandas-auto";
const DEVICE_KEY = "jdv-comandas-device";
const POLL_MS = 5_000;
const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Campo_Grande" });

function storage(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function deviceId(): string {
  let id = storage(DEVICE_KEY);
  if (!id || !/^[a-z0-9-]{8,64}$/.test(id)) id = storage(DEVICE_KEY, crypto.randomUUID()) ?? crypto.randomUUID();
  return id;
}

// liga e desliga por computador: guardado no navegador deste notebook
const autoListeners = new Set<() => void>();
const subscribeAuto = (fn: () => void) => { autoListeners.add(fn); return () => { autoListeners.delete(fn); }; };
const readAuto = () => storage(AUTO_KEY) === "1";
function writeAuto(v: boolean) { storage(AUTO_KEY, v ? "1" : "0"); autoListeners.forEach((f) => f()); }

/** Espera o React desenhar as comandas antes de chamar a impressão. */
const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export function ComandasClient({ initial }: { initial: Job[] }) {
  const auto = useSyncExternalStore(subscribeAuto, readAuto, () => false);
  const [jobs, setJobs] = useState(initial);
  const [printing, setPrinting] = useState<Job[]>([]);
  const [status, setStatus] = useState<string>("");
  const busy = useRef(false);

  const print = useCallback(async (list: Job[]) => {
    setPrinting(list);
    await nextPaint();
    window.print();
    setPrinting([]);
  }, []);

  const tick = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const dev = deviceId();
      const claimed = await claimAction(dev);
      if (claimed.length) {
        await print(claimed);
        for (const j of claimed) await printedAction(j.id, dev);
        setStatus(`Última impressão às ${hora.format(new Date())}.`);
      }
      setJobs(await recentAction());
    } catch {
      setStatus("Sem conexão com o sistema. Tentando de novo...");
    } finally {
      busy.current = false;
    }
  }, [print]);

  useEffect(() => {
    if (!auto) return;
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, POLL_MS);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [auto, tick]);

  useEffect(() => {
    if (auto) return;
    const t = setInterval(async () => setJobs(await recentAction()), 15_000);
    return () => clearInterval(t);
  }, [auto]);

  const toggle = () => {
    const v = !auto;
    writeAuto(v);
    setStatus(v ? "Impressão automática ligada neste computador." : "Impressão automática desligada neste computador.");
  };

  const reprint = async (id: string) => {
    const j = await reprintAction(id);
    if (j) await print([j]);
  };

  return (
    <div className="pn-grid" style={{ gap: 20 }}>
      <div className="pn-noprint pn-grid" style={{ gap: 20 }}>
        <div className="pn-row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 className="pn-h1">Comandas</h1>
            <p className="pn-sub" style={{ margin: 0 }}>Deixe esta página aberta no notebook do balcão. Cada comanda sai uma vez só.</p>
          </div>
          <button className={`pn-btn ${auto ? "" : "ghost"}`} role="switch" aria-checked={auto} onClick={toggle}>
            {auto ? "Impressão automática: ligada" : "Ligar impressão automática"}
          </button>
        </div>
        {!auto && (
          <p className="pn-msg err" role="status">
            A impressão automática está desligada neste computador. Ligue só no notebook que fica com a impressora.
          </p>
        )}
        {status && <p className="pn-muted" role="status" style={{ margin: 0 }}>{status}</p>}

        <section className="pn-card pn-scroll" aria-label="Últimas comandas">
          <table className="pn-table">
            <thead><tr><th>Hora</th><th>Comanda</th><th>Itens</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {jobs.length === 0 && <tr><td colSpan={5} className="pn-muted">Nenhuma comanda ainda.</td></tr>}
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="pn-num">{hora.format(new Date(j.createdAt))}</td>
                  <td><strong>{j.ticket.title}</strong><br /><span className="pn-muted">{j.ticket.subtitle}</span></td>
                  <td>{j.ticket.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}</td>
                  <td>{j.printedAt ? <span className="pn-tag">impressa</span> : <span className="pn-tag" style={{ background: "#fbe9eb" }}>na fila</span>}</td>
                  <td><button className="pn-btn ghost small" onClick={() => reprint(j.id)}>Reimprimir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="pn-print" aria-hidden="true">
        {printing.map((j) => (
          <div key={j.id} className="pn-ticket">
            <div className="pn-ticket-title">{j.ticket.title}</div>
            {j.ticket.subtitle && <div>{j.ticket.subtitle}</div>}
            <div>{hora.format(new Date(j.createdAt))}</div>
            {j.ticket.details && (<><hr />{j.ticket.details.map((d, i) => <div key={i} className="pn-ticket-detail">{d}</div>)}</>)}
            <hr />
            {j.ticket.lines.map((l, i) => (
              <div key={i} className="pn-ticket-line">
                <strong>{l.quantity}×</strong> {l.name}
                {l.note && <div className="pn-ticket-note">→ {l.note}</div>}
              </div>
            ))}
            {j.ticket.footer && (<><hr />{j.ticket.footer.split(" · ").map((f, i) => <div key={i}>{f}</div>)}</>)}
          </div>
        ))}
      </div>
    </div>
  );
}
