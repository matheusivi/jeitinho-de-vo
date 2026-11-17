import { listNeighborhoods } from "@/lib/orders/fees";
import { isOpen, openingLabel } from "@/lib/store/hours";
import { Finalizar } from "./Finalizar";

export const metadata = { title: "Finalizar pedido · Jeitinho de Vó" };

export default async function FinalizarPage() {
  const now = new Date();
  const bairros = await listNeighborhoods();
  return (
    <main className="lj-pagina">
      <div className="wrap">
        <h1 className="lj-h1p">Finalizar pedido</h1>
        <p className="lj-sub">Não precisa de cadastro. Só o necessário para a gente entregar.</p>
        <Finalizar bairros={bairros} open={isOpen(now)} opening={openingLabel(now)} />
      </div>
    </main>
  );
}
