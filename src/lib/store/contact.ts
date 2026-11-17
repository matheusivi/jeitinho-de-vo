export const INSTAGRAM_URL = "https://www.instagram.com/jeitinhodevodoces/";

/** Número de WhatsApp só com dígitos e DDI (ex.: 5567999990000), ou null se ainda não configurado. */
export function whatsappNumber(): string | null {
  const digits = (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function whatsappUrl(text?: string): string | null {
  const n = whatsappNumber();
  if (!n) return null;
  return text ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/${n}`;
}

export function facebookUrl(): string | null {
  return process.env.NEXT_PUBLIC_FACEBOOK?.trim() || null;
}
