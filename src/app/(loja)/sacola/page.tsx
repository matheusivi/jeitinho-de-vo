import { isOpen, openingLabel } from "@/lib/store/hours";
import { Sacola } from "./Sacola";

export const metadata = { title: "Sacola · Jeitinho de Vó" };

export default function SacolaPage() {
  const now = new Date();
  return (
    <main className="lj-pagina">
      <div className="wrap">
        <h1 className="lj-h1p">Sua sacola</h1>
        <p className="lj-sub">Confira os doces antes de finalizar.</p>
        <Sacola open={isOpen(now)} opening={openingLabel(now)} />
      </div>
    </main>
  );
}
