import { describe, expect, it } from "vitest";
import { formatQty, inputUnitsFor, parseQtyInput, toMilli, UnitError } from "@/lib/ingredients/units";

const lata = { baseUnit: "g" as const, packageName: "lata", packageSizeMilli: 395_000 };

describe("conversão de unidades", () => {
  it("2 latas, 1,5 kg e 300 g viram gramas @spec:AC-029", () => {
    expect(toMilli(2, "pkg", lata)).toBe(790_000);
    expect(toMilli(1.5, "kg", lata)).toBe(1_500_000);
    expect(toMilli(300, "g", lata)).toBe(300_000);
  });

  it("litro vira ml e unidade aceita fração", () => {
    const leite = { baseUnit: "ml" as const, packageName: null, packageSizeMilli: null };
    expect(toMilli(1.25, "l", leite)).toBe(1_250_000);
    expect(toMilli(1.5, "un", { baseUnit: "un" as const, packageName: null, packageSizeMilli: null })).toBe(1_500);
  });

  it("recusa unidade que não combina com o insumo", () => {
    expect(() => toMilli(1, "l", lata)).toThrow(UnitError);
    expect(() => toMilli(1, "pkg", { baseUnit: "g", packageName: null, packageSizeMilli: null })).toThrow(UnitError);
  });

  it("lê número com vírgula e recusa texto, negativo e absurdo", () => {
    expect(parseQtyInput("1,5")).toBe(1.5);
    expect(parseQtyInput(" 2 ")).toBe(2);
    expect(parseQtyInput("1.5")).toBe(1.5);
    expect(parseQtyInput("1.250,5")).toBe(1250.5);
    expect(() => parseQtyInput("abc")).toThrow(UnitError);
    expect(() => parseQtyInput("-1")).toThrow(UnitError);
    expect(() => parseQtyInput("0")).toThrow(UnitError);
    expect(() => parseQtyInput("99999999")).toThrow(UnitError);
  });

  it("formata na unidade mais legível", () => {
    expect(formatQty(1_500_000, "g")).toBe("1,5 kg");
    expect(formatQty(300_000, "g")).toBe("300 g");
    expect(formatQty(-250_000, "ml")).toBe("-250 ml");
    expect(formatQty(2_000_000, "ml")).toBe("2 l");
    expect(formatQty(12_500, "un")).toBe("12,5 un");
  });

  it("oferece as unidades de entrada do insumo", () => {
    expect(inputUnitsFor(lata).map((u) => u.value)).toEqual(["g", "kg", "pkg"]);
  });
});
