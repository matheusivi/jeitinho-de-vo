/**
 * IP real de quem fez a requisição, atrás de UM proxy confiável (Nginx/Caddy).
 * X-Real-IP é definido pelo proxy. No X-Forwarded-For só o ÚLTIMO valor é do proxy:
 * os anteriores vêm do cliente e podem ser inventados.
 */
export function pickClientIp(h: Headers): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts.at(-1) ?? "desconhecido";
}
