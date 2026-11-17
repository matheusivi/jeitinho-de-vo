"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { addToBag, bagCount, bagSubtotal, parseBag, setBagQuantity, type BagLine } from "@/lib/store/bag";

const KEY = "jdv_sacola";
const EMPTY: BagLine[] = [];

// Loja externa da sacola: uma fonte só, guardada no localStorage quando disponível.
let current: BagLine[] | null = null;
const listeners = new Set<() => void>();

function read(): BagLine[] {
  if (current) return current;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // sem armazenamento: a sacola vive só nesta aba
  }
  current = parseBag(raw);
  return current;
}

function write(next: BagLine[]): void {
  current = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // segue em memória
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const noop = () => () => {};

type BagApi = {
  lines: BagLine[];
  ready: boolean;
  count: number;
  subtotalCents: number;
  add: (item: Omit<BagLine, "quantity">) => void;
  setQuantity: (productId: string, quantity: number) => void;
  replace: (lines: BagLine[]) => void;
  clear: () => void;
};

const BagContext = createContext<BagApi | null>(null);

export function BagProvider({ children }: { children: React.ReactNode }) {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const value = useMemo<BagApi>(
    () => ({
      lines,
      ready,
      count: bagCount(lines),
      subtotalCents: bagSubtotal(lines),
      add: (item) => write(addToBag(read(), item)),
      setQuantity: (id, q) => write(setBagQuantity(read(), id, q)),
      replace: (next) => write(next),
      clear: () => write([]),
    }),
    [lines, ready],
  );
  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag(): BagApi {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag fora do BagProvider");
  return ctx;
}
