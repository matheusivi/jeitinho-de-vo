import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifra segredos guardados no banco (como o segredo do código no celular) com AES-256-GCM.
 * A chave vem de AUTH_SECRET, que fica só no .env do servidor: um backup do banco sozinho não abre nada.
 */
function key(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET não configurado (mínimo de 32 caracteres). Veja docs/deploy.md.");
  }
  return createHash("sha256").update(s).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

export function decryptSecret(enc: string): string {
  const [v, iv, tag, ct] = enc.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Segredo cifrado em formato inválido.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
