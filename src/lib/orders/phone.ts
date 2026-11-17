/** Deixa só os dígitos do telefone brasileiro (DDD + número). null se não tiver 10 ou 11 dígitos. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
}
