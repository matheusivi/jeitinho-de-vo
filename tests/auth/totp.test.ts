import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotp, newTotpSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";

// Vetores da RFC 6238 (SHA-1). A RFC usa 8 dígitos; os aplicativos usam os 6 últimos.
const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");
const VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("código do aplicativo (TOTP)", () => {
  it("bate com os vetores da RFC 6238 e aceita o passo vizinho @spec:AC-056", () => {
    for (const [t, code] of VECTORS) expect(generateTotp(RFC_SECRET, t * 1000)).toBe(code);
    const now = 1111111111 * 1000;
    const prev = generateTotp(RFC_SECRET, now - 30_000);
    const next = generateTotp(RFC_SECRET, now + 30_000);
    expect(verifyTotp(RFC_SECRET, prev, now)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, next, now)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now - 90_000), now)).toBeNull();
  });

  it("recusa código mal formado e passo já usado", () => {
    const now = 1234567890 * 1000;
    const code = generateTotp(RFC_SECRET, now);
    const step = verifyTotp(RFC_SECRET, code, now);
    expect(step).toBe(Math.floor(1234567890 / 30));
    expect(verifyTotp(RFC_SECRET, code, now, step)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, ` ${code.slice(0, 3)} ${code.slice(3)} `, now)).toBe(step);
  });

  it("base32 ida e volta e URI para o aplicativo", () => {
    const secret = newTotpSecret();
    expect(secret.length).toBe(20);
    expect(base32Decode(base32Encode(secret)).equals(secret)).toBe(true);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    const uri = otpauthUri(Buffer.from("foobar"), "dona@loja.com");
    expect(uri).toBe("otpauth://totp/Jeitinho%20de%20V%C3%B3:dona%40loja.com?secret=MZXW6YTBOI&issuer=Jeitinho%20de%20V%C3%B3&algorithm=SHA1&digits=6&period=30");
  });
});

describe("cifra do segredo", () => {
  it("cifra com AES-GCM e só decifra intacto @spec:AC-062", () => {
    const enc = encryptSecret("MZXW6YTBOI");
    expect(enc).not.toContain("MZXW6YTBOI");
    expect(enc).not.toBe(encryptSecret("MZXW6YTBOI")); // IV aleatório
    expect(decryptSecret(enc)).toBe("MZXW6YTBOI");
    const parts = enc.split(":");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
});
