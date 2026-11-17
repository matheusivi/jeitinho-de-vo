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
