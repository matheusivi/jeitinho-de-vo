import { formatBRL } from "@/lib/money";
import type { StockStatus } from "@/lib/ingredients/ingredients";

export const STATUS_LABEL: Record<StockStatus, { text: string; cls: string }> = {
  NEGATIVE: { text: "negativo", cls: "warn" },
  LOW: { text: "no mínimo", cls: "warn" },
  OK: { text: "ok", cls: "" },
};

/** Custo médio por kg, litro ou unidade, que é como a dona pensa o preço. */
export function avgLabel(avgPerBase: number | null, base: "g" | "ml" | "un"): string {
  if (avgPerBase === null) return "sem compra";
  if (base === "un") return `${formatBRL(Math.round(avgPerBase))} / un`;
  return `${formatBRL(Math.round(avgPerBase * 1000))} / ${base === "g" ? "kg" : "litro"}`;
}

