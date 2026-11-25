import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { getMenu } from "@/lib/store/menu";
import { getTable, listTables } from "@/lib/tables/tables";
import { OpenTableButton } from "../MesasForms";
import { MesaClient } from "./MesaClient";

export default async function MesaPage({ params }: { params: Promise<{ numero: string }> }) {
  const user = await requireUser();
  const number = Number((await params).numero);
  if (!Number.isInteger(number)) notFound();
  const tables = await listTables(user);
  if (!tables.some((t) => t.number === number)) notFound();
  const mesa = await getTable(number, user);

  return (
    <div className="pn-grid" style={{ gap: 20 }}>
      <Link href="/painel/mesas" className="pn-muted">← Todas as mesas</Link>
      {mesa ? (
        <MesaClient
          mesa={JSON.parse(JSON.stringify(mesa))}
          menu={(await getMenu()).map((c) => ({ name: c.name, items: c.items.map(({ id, name, priceCents, available }) => ({ id, name, priceCents, available })) }))}
          isAdmin={user.role === "ADMIN"}
        />
      ) : (
        <div className="pn-card pn-grid" style={{ maxWidth: 360 }}>
          <h1 className="pn-h1" style={{ margin: 0 }}>Mesa {number}</h1>
          <p className="pn-muted" style={{ margin: 0 }}>Está livre.</p>
          <div className="pn-mesas"><OpenTableButton number={number} /></div>
        </div>
      )}
    </div>
  );
}
