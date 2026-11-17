import { describe, expect, it } from "vitest";
import { formatBRL } from "@/lib/money";

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(1250)).toBe("R$ 12,50");
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });
});

import { parseBRL } from "@/lib/money";

describe("parseBRL", () => {
  it.each([
    ["12,50", 1250], ["12.50", 1250], ["12", 1200], ["R$ 1.234,56", 123456], [" 9,9 ", 990], ["0,05", 5],
  ])("lê %s", (text, cents) => expect(parseBRL(text)).toBe(cents));
  it.each(["", "abc", "-5", "1,234", "12,5,0"])("recusa %s", (text) => expect(parseBRL(text)).toBeNull());
});
