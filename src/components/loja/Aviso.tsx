import { isOpen, openingLabel } from "@/lib/store/hours";

export function Aviso() {
  const now = new Date();
  const open = isOpen(now);
  return (
    <div className={`lj-aviso ${open ? "" : "fechado"}`}>
      <div className="wrap">
        {open
          ? "Pedidos de hoje: entrega em Nova Andradina ou retirada na loja. Pague na entrega."
          : `Estamos fechados agora. Abrimos ${openingLabel(now)}. O cardápio fica aqui para você espiar.`}
      </div>
    </div>
  );
}
