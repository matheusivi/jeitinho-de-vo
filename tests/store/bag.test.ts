import { describe, expect, it } from "vitest";
import { addToBag, bagCount, bagSubtotal, parseBag, setBagQuantity, type BagLine } from "@/lib/store/bag";

const fatia = { productId: "a", name: "Fatia", priceCents: 1400, unitLabel: "fatia", imageKey: null, max: 3 };

describe("sacola", () => {
  it("adiciona e soma quantidade do mesmo produto", () => {
    let bag: BagLine[] = [];
    bag = addToBag(bag, fatia);
    bag = addToBag(bag, fatia);
    expect(bag).toHaveLength(1);
    expect(bag[0].quantity).toBe(2);
    expect(bagCount(bag)).toBe(2);
    expect(bagSubtotal(bag)).toBe(2800);
  });

  it("não passa do disponível", () => {
    let bag: BagLine[] = [];
    for (let i = 0; i < 5; i++) bag = addToBag(bag, fatia);
    expect(bag[0].quantity).toBe(3);
  });

  it("ajusta quantidade dentro dos limites e remove com zero", () => {
    let bag = addToBag([], fatia);
    bag = setBagQuantity(bag, "a", 10);
    expect(bag[0].quantity).toBe(3);
    bag = setBagQuantity(bag, "a", 0);
    expect(bag).toEqual([]);
  });

  it("lê do armazenamento só o que for válido", () => {
    expect(parseBag(null)).toEqual([]);
    expect(parseBag("lixo{")).toEqual([]);
    expect(parseBag(JSON.stringify({ x: 1 }))).toEqual([]);
    const ok = JSON.stringify([{ ...fatia, quantity: 2 }, { productId: 5 }, { ...fatia, productId: "b", quantity: -1 }]);
    expect(parseBag(ok)).toEqual([{ ...fatia, quantity: 2 }]);
  });
});

import { reconcileBag } from "@/lib/store/bag";

describe("conferir sacola com o servidor", () => {
  const linha = (id: string, quantity: number, priceCents = 1000) =>
    ({ productId: id, name: id, priceCents, unitLabel: "un", imageKey: null, max: 10, quantity });

  it("atualiza preço, corta pelo disponível e tira o que esgotou", () => {
    const { lines, changes } = reconcileBag(
      [linha("a", 2, 1000), linha("b", 5), linha("c", 1)],
      [
        { id: "a", name: "a", priceCents: 1200, unitLabel: "un", imageKey: null, available: 9 },
        { id: "b", name: "b", priceCents: 1000, unitLabel: "un", imageKey: null, available: 3 },
      ],
    );
    expect(lines.map((l) => [l.productId, l.quantity, l.priceCents, l.max])).toEqual([["a", 2, 1200, 9], ["b", 3, 1000, 3]]);
    expect(changes).toEqual([
      "O preço de a mudou para R$ 12,00.",
      "Só restam 3 de b. Ajustamos a quantidade.",
      "c esgotou e saiu da sacola.",
    ]);
  });

  it("sem mudança não avisa nada", () => {
    const { changes } = reconcileBag([linha("a", 1)], [{ id: "a", name: "a", priceCents: 1000, unitLabel: "un", imageKey: null, available: 4 }]);
    expect(changes).toEqual([]);
  });
});
