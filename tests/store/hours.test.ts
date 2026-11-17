import { describe, expect, it } from "vitest";
import { isOpen, nextOpening, openingLabel } from "@/lib/store/hours";

// America/Campo_Grande é UTC-4 o ano todo. 16/11/2026 é segunda-feira.
const local = (iso: string) => new Date(`${iso}-04:00`);

describe("horário de atendimento (segunda a sábado, 8h às 18h)", () => {
  it.each([
    ["2026-11-16T12:00:00", true], // segunda meio-dia
    ["2026-11-16T07:59:59", false],
    ["2026-11-16T08:00:00", true],
    ["2026-11-21T17:59:00", true], // sábado
    ["2026-11-21T18:00:00", false],
    ["2026-11-22T12:00:00", false], // domingo
  ])("%s aberto? %s", (iso, expected) => expect(isOpen(local(iso))).toBe(expected));

  it("próxima abertura depois de sábado à noite é segunda 8h", () => {
    expect(nextOpening(local("2026-11-21T19:00:00"))).toEqual(local("2026-11-23T08:00:00"));
  });

  it("próxima abertura de madrugada é o mesmo dia 8h", () => {
    expect(nextOpening(local("2026-11-17T03:00:00"))).toEqual(local("2026-11-17T08:00:00"));
  });

  it("próxima abertura depois das 18h é o dia seguinte", () => {
    expect(nextOpening(local("2026-11-17T18:30:00"))).toEqual(local("2026-11-18T08:00:00"));
  });

  it("descreve a abertura em palavras", () => {
    expect(openingLabel(local("2026-11-17T03:00:00"))).toBe("hoje às 8h");
    expect(openingLabel(local("2026-11-17T18:30:00"))).toBe("amanhã às 8h");
    expect(openingLabel(local("2026-11-21T19:00:00"))).toBe("segunda-feira às 8h");
  });
});
