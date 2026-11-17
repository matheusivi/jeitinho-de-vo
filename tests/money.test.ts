import { describe, expect, it } from "vitest";
import { formatBRL } from "@/lib/money";

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(1250)).toBe("R$ 12,50");
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });
});
