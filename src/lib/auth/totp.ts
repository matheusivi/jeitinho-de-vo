import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Código de aplicativo autenticador (TOTP, RFC 6238): HMAC-SHA1, passos de 30 s, 6 dígitos.
 * Compatível com Google Authenticator, Authy e Microsoft Authenticator.
 */
const PERIOD = 30;
const DIGITS = 6;
const WINDOW = 1; // aceita o passo anterior e o seguinte (relógio do celular um pouco fora)
export const TOTP_ISSUER = "Jeitinho de Vó";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Segredo base32 inválido.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret(): Buffer {
  return randomBytes(20);
}

function codeForStep(secret: Buffer, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotp(secret: Buffer, nowMs: number): string {
  return codeForStep(secret, Math.floor(nowMs / 1000 / PERIOD));
}

/**
 * Confere o código e devolve o passo usado, ou null. Passos até `lastUsedStep` (inclusive)
 * são recusados, para o mesmo código não servir duas vezes.
 */
export function verifyTotp(secret: Buffer, input: string, nowMs: number, lastUsedStep: number | null = null): number | null {
  const code = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(nowMs / 1000 / PERIOD);
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const step = current + d;
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    if (timingSafeEqual(Buffer.from(codeForStep(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

/** Endereço que o aplicativo lê pelo QR code. */
export function otpauthUri(secret: Buffer, account: string): string {
  const label = `${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${base32Encode(secret)}&issuer=${encodeURIComponent(TOTP_ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;
}
