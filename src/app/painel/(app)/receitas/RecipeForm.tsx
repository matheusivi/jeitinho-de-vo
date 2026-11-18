"use client";

import { useState } from "react";
import { useFormAction } from "@/components/useFormAction";
import { inputUnitsFor, type InputUnit, type UnitInfo } from "@/lib/ingredients/units";
import { saveRecipeAction, setCmvTargetAction, type RecipeState } from "./actions";

export type RecipeIngredientOption = UnitInfo & { id: string; name: string };
type Line = { key: number; ingredientId: string; qty: string; unit: InputUnit | "" };

let seq = 0;
const newLine = (l?: Partial<Line>): Line => ({ key: ++seq, ingredientId: "", qty: "", unit: "", ...l });

/** Mostra a quantidade guardada (milésimos da base) na unidade mais natural para editar. */
function initialQty(milli: number, info: UnitInfo): { qty: string; unit: InputUnit } {
  const v = milli / 1000;
  const txt = (n: number) => String(Math.round(n * 1000) / 1000).replace(".", ",");
  if (info.baseUnit === "un") return { qty: txt(v), unit: "un" };
  if (info.packageSizeMilli && milli % info.packageSizeMilli === 0) return { qty: txt(milli / info.packageSizeMilli), unit: "pkg" };
  if (v >= 1000) return { qty: txt(v / 1000), unit: info.baseUnit === "g" ? "kg" : "l" };
  return { qty: txt(v), unit: info.baseUnit };
}

export function RecipeForm({
  productId, productName, ingredients, initial,
}: {
  productId: string; productName: string; ingredients: RecipeIngredientOption[];
  initial: { yieldQty: number; notes: string; items: { ingredientId: string; qtyMilli: number }[] } | null;
}) {
  const [state, onSubmit, pending] = useFormAction<RecipeState>(saveRecipeAction, {});
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const [lines, setLines] = useState<Line[]>(() =>
    initial && initial.items.length
      ? initial.items.map((it) => {
          const info = byId.get(it.ingredientId);
          return info ? newLine({ ingredientId: it.ingredientId, ...initialQty(it.qtyMilli, info) }) : newLine();
        })
      : [newLine(), newLine(), newLine()],
  );
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const filled = lines.filter((l) => l.ingredientId);

  return (
    <form onSubmit={onSubmit} className="pn-grid">
      <input type="hidden" name="productId" value={productId} />
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <div className="pn-field" style={{ flex: "0 1 200px" }}>
          <label htmlFor="yield">Rende quantas unidades</label>
          <input className="pn-input" id="yield" name="yieldQty" type="number" inputMode="numeric" min={1} step={1} required defaultValue={initial?.yieldQty ?? ""} placeholder="Ex.: 12" />
        </div>
        <p className="pn-muted" style={{ margin: 0, flex: "1 1 260px" }}>
          Quantas unidades de &ldquo;{productName}&rdquo; uma receita completa faz. Se você produzir menos, o sistema baixa só a proporção.
        </p>
      </div>

      <fieldset className="pn-grid" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
        <legend className="pn-label" style={{ marginBottom: 8 }}>Insumos de uma receita completa (inclua embalagem: pote, caixa, fita)</legend>
        {lines.map((l, idx) => {
          const info = byId.get(l.ingredientId);
          const units = info ? inputUnitsFor(info) : [];
          return (
            <div className="pn-row" key={l.key} style={{ alignItems: "flex-end" }}>
              <div className="pn-field" style={{ flex: "2 1 220px" }}>
                <label htmlFor={`ing-${l.key}`}>Insumo {idx + 1}</label>
                <select
                  className="pn-input" id={`ing-${l.key}`} name={l.ingredientId ? "ingredientId" : undefined} value={l.ingredientId}
                  onChange={(e) => {
                    const i = byId.get(e.target.value);
                    update(l.key, { ingredientId: e.target.value, unit: i ? inputUnitsFor(i)[0].value : "" });
                  }}
                >
                  <option value="">Escolha</option>
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="pn-field" style={{ flex: "0 1 110px" }}>
                <label htmlFor={`qty-${l.key}`}>Quantidade</label>
                <input
                  className="pn-input" id={`qty-${l.key}`} name={l.ingredientId ? "qty" : undefined} inputMode="decimal"
                  value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} required={!!l.ingredientId} placeholder="Ex.: 1,5"
                />
              </div>
              <div className="pn-field" style={{ flex: "0 1 120px" }}>
                <label htmlFor={`unit-${l.key}`}>Unidade</label>
                <select
                  className="pn-input" id={`unit-${l.key}`} name={l.ingredientId ? "unit" : undefined} value={l.unit} disabled={!info}
                  onChange={(e) => update(l.key, { unit: e.target.value as InputUnit })}
                >
                  {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <button type="button" className="pn-btn ghost small" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))} aria-label={`Tirar insumo ${idx + 1}`}>
                Tirar
              </button>
            </div>
          );
        })}
        <div><button type="button" className="pn-btn ghost small" onClick={() => setLines((ls) => [...ls, newLine()])}>+ Mais um insumo</button></div>
      </fieldset>

      <div className="pn-field">
        <label htmlFor="notes">Modo de preparo ou observações (opcional)</label>
        <textarea className="pn-input" id="notes" name="notes" maxLength={2000} defaultValue={initial?.notes ?? ""} />
      </div>
      <div className="pn-row">
        <button className="pn-btn" type="submit" disabled={pending || filled.length === 0}>Salvar receita</button>
        {ingredients.length === 0 && <span className="pn-muted">Cadastre os insumos primeiro em Insumos.</span>}
      </div>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      {state.ok && <p className="pn-msg ok" role="status">{state.ok}</p>}
    </form>
  );
}

export function CmvTargetForm({ targetPct }: { targetPct: number }) {
  const [state, onSubmit, pending] = useFormAction<RecipeState>(setCmvTargetAction, {});
  return (
    <form onSubmit={onSubmit} className="pn-row" style={{ alignItems: "flex-end" }}>
      <div className="pn-field" style={{ flex: "0 1 140px" }}>
        <label htmlFor="cmv-target">Meta de CMV (%)</label>
        <input className="pn-input" id="cmv-target" name="pct" inputMode="decimal" defaultValue={String(targetPct).replace(".", ",")} required />
      </div>
      <button className="pn-btn ghost" type="submit" disabled={pending}>Salvar meta</button>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      {state.ok && <p className="pn-msg ok" role="status">{state.ok}</p>}
    </form>
  );
}
