import { requireRole } from "@/lib/auth/guard";
import { listAllNeighborhoods } from "@/lib/orders/fees";
import { NbRow } from "./NbForms";

const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function BairrosPage() {
  await requireRole("ADMIN");
  const list = await listAllNeighborhoods();
  return (
    <div className="pn-grid">
      <div>
        <h1 className="pn-h1">Bairros e taxas de entrega</h1>
        <p className="pn-sub" style={{ margin: 0 }}>A cliente escolhe o bairro na hora de pedir e a taxa entra no total. Use os mesmos valores do aiqfome, se quiser.</p>
      </div>
      <div className="pn-card">
        <NbRow />
        {list.map((b) => <NbRow key={b.id} id={b.id} name={b.name} fee={reais(b.feeCents)} active={b.active} />)}
      </div>
    </div>
  );
}
