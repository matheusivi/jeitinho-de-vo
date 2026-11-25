/** Divide o total em partes iguais; os centavos que sobram vão para as primeiras partes. Sem acesso ao banco: roda na tela também. */
export function splitEqual(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1 || parts > 50) throw new RangeError("Divida entre 1 e 50 pessoas.");
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new RangeError("Total inválido.");
  const base = Math.floor(totalCents / parts);
  const extra = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}
