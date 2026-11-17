"use client";

export default function PainelError({ error, reset }: { error: Error; reset: () => void }) {
  const forbidden = error.name === "ForbiddenError" || /permiss/i.test(error.message);
  return (
    <div className="pn-card">
      <h1 className="pn-h1">{forbidden ? "Você não tem acesso a esta área" : "Algo deu errado"}</h1>
      <p className="pn-sub">
        {forbidden ? "Peça para a administradora liberar, se precisar." : "Tente de novo. Se continuar, avise o suporte."}
      </p>
      {!forbidden && <button className="pn-btn" onClick={reset}>Tentar de novo</button>}
    </div>
  );
}
