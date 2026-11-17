export type BagLine = {
  productId: string;
  name: string;
  priceCents: number;
  unitLabel: string;
  imageKey: string | null;
  /** Quanto havia disponível quando foi adicionado; o servidor confere de novo no pedido. */
  max: number;
  quantity: number;
};

export const MAX_PER_ITEM = 50;

const clamp = (q: number, max: number) => Math.max(0, Math.min(q, max, MAX_PER_ITEM));

export function addToBag(bag: BagLine[], item: Omit<BagLine, "quantity">): BagLine[] {
  const found = bag.find((l) => l.productId === item.productId);
  if (!found) return clamp(1, item.max) > 0 ? [...bag, { ...item, quantity: 1 }] : bag;
  return bag.map((l) =>
    l.productId === item.productId ? { ...l, ...item, quantity: clamp(l.quantity + 1, item.max) } : l,
  );
}

export function setBagQuantity(bag: BagLine[], productId: string, quantity: number): BagLine[] {
  return bag
    .map((l) => (l.productId === productId ? { ...l, quantity: clamp(Math.floor(quantity), l.max) } : l))
    .filter((l) => l.quantity > 0);
}

export const bagCount = (bag: BagLine[]) => bag.reduce((n, l) => n + l.quantity, 0);
export const bagSubtotal = (bag: BagLine[]) => bag.reduce((n, l) => n + l.quantity * l.priceCents, 0);

function isLine(v: unknown): v is BagLine {
  if (!v || typeof v !== "object") return false;
  const l = v as Record<string, unknown>;
  return (
    typeof l.productId === "string" && typeof l.name === "string" && typeof l.unitLabel === "string" &&
    Number.isInteger(l.priceCents) && Number.isInteger(l.max) && Number.isInteger(l.quantity) &&
    (l.quantity as number) > 0 && (l.imageKey === null || typeof l.imageKey === "string")
  );
}

export function parseBag(raw: string | null): BagLine[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isLine) : [];
  } catch {
    return [];
  }
}

export type FreshProduct = {
  id: string; name: string; priceCents: number; unitLabel: string; imageKey: string | null; available: number;
};

const brl = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100).replace(/ /g, " ");

/** Atualiza a sacola com o que o servidor diz agora e explica em português o que mudou. */
export function reconcileBag(bag: BagLine[], fresh: FreshProduct[]): { lines: BagLine[]; changes: string[] } {
  const byId = new Map(fresh.map((p) => [p.id, p]));
  const changes: string[] = [];
  const lines: BagLine[] = [];
  for (const l of bag) {
    const p = byId.get(l.productId);
    if (!p || p.available <= 0) {
      changes.push(`${l.name} esgotou e saiu da sacola.`);
      continue;
    }
    if (p.priceCents !== l.priceCents) changes.push(`O preço de ${p.name} mudou para ${brl(p.priceCents)}.`);
    const quantity = Math.min(l.quantity, p.available, MAX_PER_ITEM);
    if (quantity < l.quantity) changes.push(`Só restam ${p.available} de ${p.name}. Ajustamos a quantidade.`);
    lines.push({ productId: p.id, name: p.name, priceCents: p.priceCents, unitLabel: p.unitLabel, imageKey: p.imageKey, max: p.available, quantity });
  }
  return { lines, changes };
}
