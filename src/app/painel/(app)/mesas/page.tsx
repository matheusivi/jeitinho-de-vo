import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { formatBRL } from "@/lib/money";
import { stalePending } from "@/lib/printing/jobs";
import { activeTableCount, listTables } from "@/lib/tables/tables";
import { AutoRefresh } from "../pedidos/AutoRefresh";
import { OpenTableButton, TableCountForm } from "./MesasForms";

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Campo_Grande" });

export default async function MesasPage() {
  const user = await requireUser();
  const [tables, stale, count] = await Promise.all([listTables(user), stalePending(), activeTableCount()]);
  const busy = tables.filter((t) => t.orderId).length;

  return (
    <div className="pn-grid" style={{ gap: 24 }}>
      <AutoRefresh />
      <div>
        <h1 className="pn-h1">Mesas</h1>
        <p className="pn-sub" style={{ margin: 0 }}>{busy === 0 ? "Todas livres." : `${busy} ocupada${busy > 1 ? "s" : ""}.`} Toque numa mesa para abrir ou lançar.</p>
      </div>

      {stale > 0 && (
        <p className="pn-msg err" role="alert">
          {stale === 1 ? "1 comanda está" : `${stale} comandas estão`} esperando a impressora há mais de 1 minuto.
          Confira se a página <Link href="/painel/comandas">Comandas</Link> está aberta no notebook do balcão.
        </p>
      )}

      <div className="pn-mesas">
        {tables.map((t) =>
          t.orderId ? (
            <Link key={t.number} href={`/painel/mesas/${t.number}`} className="pn-mesa busy" aria-label={`Mesa ${t.number}, ocupada`}>
              <span className="pn-mesa-n">{t.number}</span>
              <span className="pn-mesa-total">{formatBRL(t.totalCents)}</span>
              <span className="pn-mesa-info">{t.itemCount} {t.itemCount === 1 ? "item" : "itens"} · desde {hora.format(t.openedAt!)}</span>
            </Link>
          ) : (
            <OpenTableButton key={t.number} number={t.number} />
          ),
        )}
      </div>

      {user.role === "ADMIN" && (
        <section className="pn-card pn-grid" aria-label="Número de mesas" style={{ maxWidth: 520 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Número de mesas</h2>
            <p className="pn-muted" style={{ margin: 0 }}>Mesa ocupada só sai depois de fechada.</p>
          </div>
          <TableCountForm current={count} />
        </section>
      )}
    </div>
  );
}
