export const TIMEZONE = "America/Campo_Grande";
const UTC_OFFSET_HOURS = -4; // Mato Grosso do Sul não tem horário de verão

/** Horário de atendimento por dia da semana (0 = domingo). null = fechado. */
export const BUSINESS_HOURS: Record<number, { open: number; close: number } | null> = {
  0: null,
  1: { open: 8, close: 18 },
  2: { open: 8, close: 18 },
  3: { open: 8, close: 18 },
  4: { open: 8, close: 18 },
  5: { open: 8, close: 18 },
  6: { open: 8, close: 18 },
};

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** Converte o instante para um "relógio de parede" local, lido pelos métodos UTC do Date. */
function toLocal(now: Date): Date {
  return new Date(now.getTime() + UTC_OFFSET_HOURS * 3600_000);
}

function fromLocal(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month, day, hour) - UTC_OFFSET_HOURS * 3600_000);
}

export function isOpen(now: Date): boolean {
  const l = toLocal(now);
  const hours = BUSINESS_HOURS[l.getUTCDay()];
  if (!hours) return false;
  const h = l.getUTCHours() + l.getUTCMinutes() / 60 + l.getUTCSeconds() / 3600;
  return h >= hours.open && h < hours.close;
}

/** Próximo instante em que a loja abre (se já está aberta, devolve a abertura seguinte). */
export function nextOpening(now: Date): Date {
  const l = toLocal(now);
  for (let add = 0; add <= 7; add++) {
    const day = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + add));
    const hours = BUSINESS_HOURS[day.getUTCDay()];
    if (!hours) continue;
    const opening = fromLocal(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours.open);
    if (opening.getTime() > now.getTime()) return opening;
  }
  throw new Error("Nenhum dia de atendimento configurado.");
}

/** "hoje às 8h", "amanhã às 8h" ou "segunda-feira às 8h". */
export function openingLabel(now: Date): string {
  const opening = toLocal(nextOpening(now));
  const today = toLocal(now);
  const dayDiff = Math.round(
    (Date.UTC(opening.getUTCFullYear(), opening.getUTCMonth(), opening.getUTCDate()) -
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000,
  );
  const when = dayDiff === 0 ? "hoje" : dayDiff === 1 ? "amanhã" : WEEKDAYS[opening.getUTCDay()];
  return `${when} às ${opening.getUTCHours()}h`;
}
