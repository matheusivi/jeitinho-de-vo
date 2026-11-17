import { describe, expect, it } from "vitest";
import { pickClientIp } from "@/lib/ip";

const h = (o: Record<string, string>) => new Headers(o);

describe("IP de quem fez a requisição", () => {
  it("prefere o X-Real-IP que o proxy define", () => {
    expect(pickClientIp(h({ "x-real-ip": "200.1.1.1", "x-forwarded-for": "6.6.6.6, 200.1.1.1" }))).toBe("200.1.1.1");
  });

  it("sem X-Real-IP, usa o último X-Forwarded-For (o que o proxy acrescentou), não o primeiro que o cliente inventou", () => {
    expect(pickClientIp(h({ "x-forwarded-for": "6.6.6.6, 1.2.3.4, 200.1.1.1" }))).toBe("200.1.1.1");
  });

  it("sem cabeçalhos, devolve um valor fixo", () => {
    expect(pickClientIp(h({}))).toBe("desconhecido");
  });
});
