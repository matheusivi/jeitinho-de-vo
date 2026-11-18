/**
 * Quantidades de insumo são guardadas em milésimos da unidade base (g, ml ou un),
 * como inteiro. Assim 1,5 ovo ou 0,5 g somam sem erro de arredondamento.
 */
export type BaseUnit = "g" | "ml" | "un";
export type InputUnit = "g" | "kg" | "ml" | "l" | "un" | "pkg";

export type UnitInfo = {
  baseUnit: BaseUnit;
  packageName: string | null;
  packageSizeMilli: number | null;
};

export const BASE_UNIT_LABEL: Record<BaseUnit, string> = { g: "gramas", ml: "mililitros", un: "unidades" };

const MAX_INPUT = 1_000_000;

export class UnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitError";
  }
}

/** Lê o que a pessoa digitou ("1,5", "2") e devolve um número positivo. */
export function parseQtyInput(text: string): number {
  const raw = text.trim();
  // com vírgula, o ponto é separador de milhar (1.250,5); sem vírgula, o ponto é decimal (1.5)
  const clean = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d+)?$/.test(clean)) throw new UnitError("Informe uma quantidade válida, por exemplo 1,5.");
  const n = Number(clean);
  if (!(n > 0) || n > MAX_INPUT) throw new UnitError("Informe uma quantidade maior que zero.");
  return n;
}

const FACTOR: Record<Exclude<InputUnit, "pkg">, { base: BaseUnit; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  un: { base: "un", factor: 1 },
};

/** Converte a quantidade digitada na unidade escolhida para milésimos da unidade base. */
export function toMilli(qty: number, unit: InputUnit, info: UnitInfo): number {
  if (!(qty > 0) || !Number.isFinite(qty)) throw new UnitError("Informe uma quantidade maior que zero.");
  if (unit === "pkg") {
    if (!info.packageName || !info.packageSizeMilli) throw new UnitError("Este insumo não tem embalagem cadastrada.");
    return Math.round(qty * info.packageSizeMilli);
  }
  const f = FACTOR[unit];
  if (!f || f.base !== info.baseUnit) throw new UnitError("Unidade não combina com este insumo.");
  return Math.round(qty * f.factor * 1000);
}

function num(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** Mostra a quantidade na unidade mais legível: 1,5 kg em vez de 1500 g. */
export function formatQty(milli: number, base: BaseUnit): string {
  const value = milli / 1000;
  if (base === "un") return `${num(value)} un`;
  const big = base === "g" ? "kg" : "l";
  if (Math.abs(value) >= 1000) return `${num(value / 1000)} ${big}`;
  return `${num(value)} ${base}`;
}

/** Unidades que a pessoa pode escolher ao lançar este insumo. */
export function inputUnitsFor(info: UnitInfo): { value: InputUnit; label: string }[] {
  const list: { value: InputUnit; label: string }[] =
    info.baseUnit === "g"
      ? [{ value: "g", label: "g" }, { value: "kg", label: "kg" }]
      : info.baseUnit === "ml"
        ? [{ value: "ml", label: "ml" }, { value: "l", label: "litro" }]
        : [{ value: "un", label: "unidade" }];
  if (info.packageName && info.packageSizeMilli) list.push({ value: "pkg", label: info.packageName });
  return list;
}

export function isInputUnit(v: string): v is InputUnit {
  return ["g", "kg", "ml", "l", "un", "pkg"].includes(v);
}
