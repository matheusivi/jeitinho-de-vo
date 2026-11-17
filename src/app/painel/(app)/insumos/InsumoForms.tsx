"use client";

import { useState } from "react";
import { useFormAction } from "@/components/useFormAction";
import { formatQty, inputUnitsFor, type BaseUnit, type UnitInfo } from "@/lib/ingredients/units";
import {
  countAction, createIngredientAction, outflowAction, purchaseAction, setMinimumAction, updateIngredientAction, type InsumoState,
} from "./actions";

export type IngredientOption = UnitInfo & { id: string; name: string; stockMilli: number };

function Messages({ state }: { state: InsumoState }) {
  return (
    <>
      {state.error && <p className="pn-msg err" role="alert">{state.error}</p>}
      {state.ok && <p className="pn-msg ok" role="status">{state.ok}</p>}
    </>
  );
}

function UnitSelect({ info, name = "unit", id, label = "Unidade" }: { info: UnitInfo | null; name?: string; id: string; label?: string }) {
  const units = info ? inputUnitsFor(info) : [];
  return (
    <div className="pn-field" style={{ flex: "0 1 130px" }}>
      <label htmlFor={id}>{label}</label>
      <select className="pn-input" id={id} name={name} required disabled={!info} key={info ? `${info.baseUnit}-${info.packageName}` : "none"}>
        {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
      </select>
    </div>
  );
}

function IngredientSelect({ ingredients, value, onChange, id }: { ingredients: IngredientOption[]; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="pn-field" style={{ flex: "2 1 220px" }}>
      <label htmlFor={id}>Insumo</label>
      <select className="pn-input" id={id} name="ingredientId" required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>Escolha</option>
        {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </div>
  );
}

const pkgHint = (i: IngredientOption | undefined) =>
  i?.packageName && i.packageSizeMilli ? `1 ${i.packageName} = ${formatQty(i.packageSizeMilli, i.baseUnit)}` : null;

export function OutflowForm({ ingredients }: { ingredients: IngredientOption[] }) {
  const [state, onSubmit, pending] = useFormAction<InsumoState>(outflowAction, {});
  const [sel, setSel] = useState("");
  const ing = ingredients.find((i) => i.id === sel);
  return (
    <form onSubmit={onSubmit} className="pn-grid" key={state.ok}>
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <IngredientSelect ingredients={ingredients} value={sel} onChange={setSel} id="out-ing" />
        <div className="pn-field" style={{ flex: "1 1 150px" }}>
          <label htmlFor="out-type">O que foi</label>
          <select className="pn-input" id="out-type" name="type" defaultValue="LOSS">
            <option value="LOSS">Perda (estragou, caiu, venceu)</option>
            <option value="CONSUMPTION">Consumo avulso (teste, uso da casa)</option>
          </select>
        </div>
        <div className="pn-field" style={{ flex: "0 1 110px" }}>
          <label htmlFor="out-qty">Quantidade</label>
          <input className="pn-input" id="out-qty" name="qty" inputMode="decimal" required placeholder="Ex.: 1,5" />
        </div>
        <UnitSelect info={ing ?? null} id="out-unit" />
        <div className="pn-field" style={{ flex: "2 1 200px" }}>
          <label htmlFor="out-reason">Motivo</label>
          <input className="pn-input" id="out-reason" name="reason" required maxLength={200} placeholder="Ex.: venceu, caiu no chão" />
        </div>
        <button className="pn-btn ghost" type="submit" disabled={pending}>Registrar saída</button>
      </div>
      {pkgHint(ing) && <p className="pn-muted" style={{ margin: 0 }}>{pkgHint(ing)}</p>}
      <Messages state={state} />
    </form>
  );
}

export function PurchaseForm({ ingredients }: { ingredients: IngredientOption[] }) {
  const [state, onSubmit, pending] = useFormAction<InsumoState>(purchaseAction, {});
  const [sel, setSel] = useState("");
  const ing = ingredients.find((i) => i.id === sel);
  return (
    <form onSubmit={onSubmit} className="pn-grid" key={state.ok}>
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <IngredientSelect ingredients={ingredients} value={sel} onChange={setSel} id="buy-ing" />
        <div className="pn-field" style={{ flex: "0 1 110px" }}>
          <label htmlFor="buy-qty">Quantidade</label>
          <input className="pn-input" id="buy-qty" name="qty" inputMode="decimal" required placeholder="Ex.: 5" />
        </div>
        <UnitSelect info={ing ?? null} id="buy-unit" />
        <div className="pn-field" style={{ flex: "0 1 140px" }}>
          <label htmlFor="buy-paid">Valor pago (R$)</label>
          <input className="pn-input" id="buy-paid" name="paid" inputMode="decimal" required placeholder="Ex.: 32,90" />
        </div>
        <div className="pn-field" style={{ flex: "2 1 180px" }}>
          <label htmlFor="buy-note">Onde comprou (opcional)</label>
          <input className="pn-input" id="buy-note" name="note" maxLength={120} placeholder="Ex.: Atacadão" />
        </div>
        <button className="pn-btn" type="submit" disabled={pending}>Lançar compra</button>
      </div>
      {pkgHint(ing) && <p className="pn-muted" style={{ margin: 0 }}>{pkgHint(ing)}</p>}
      <Messages state={state} />
    </form>
  );
}

const BASES: { value: BaseUnit; label: string; small: string; big: string | null }[] = [
  { value: "g", label: "Peso (g e kg)", small: "g", big: "kg" },
  { value: "ml", label: "Volume (ml e litro)", small: "ml", big: "l" },
  { value: "un", label: "Unidade (ovo, caixa, pote)", small: "un", big: null },
];

function SizeFields({ base, prefix, label, nameQty, nameUnit, defaultQty }: { base: BaseUnit; prefix: string; label: string; nameQty: string; nameUnit: string; defaultQty?: string }) {
  const b = BASES.find((x) => x.value === base)!;
  return (
    <>
      <div className="pn-field" style={{ flex: "0 1 120px" }}>
        <label htmlFor={`${prefix}-${nameQty}`}>{label}</label>
        <input className="pn-input" id={`${prefix}-${nameQty}`} name={nameQty} inputMode="decimal" defaultValue={defaultQty} placeholder="Ex.: 395" />
      </div>
      <div className="pn-field" style={{ flex: "0 1 100px" }}>
        <label htmlFor={`${prefix}-${nameUnit}`}>em</label>
        <select className="pn-input" id={`${prefix}-${nameUnit}`} name={nameUnit} key={base} defaultValue={b.small}>
          <option value={b.small}>{b.small === "un" ? "unidade" : b.small}</option>
          {b.big && <option value={b.big}>{b.big === "l" ? "litro" : b.big}</option>}
        </select>
      </div>
    </>
  );
}

type EditIngredient = { id: string; name: string; baseUnit: BaseUnit; packageName: string | null; packageSizeMilli: number | null; minMilli: number; active: boolean };

function IngredientFields({ prefix, initial }: { prefix: string; initial?: EditIngredient }) {
  const [base, setBase] = useState<BaseUnit>(initial?.baseUnit ?? "g");
  const [hasPkg, setHasPkg] = useState(!!initial?.packageName);
  const milliToText = (m: number | null) => (m ? String(m / 1000).replace(".", ",") : "");
  return (
    <>
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <div className="pn-field" style={{ flex: "2 1 220px" }}>
          <label htmlFor={`${prefix}-name`}>Nome do insumo</label>
          <input className="pn-input" id={`${prefix}-name`} name="name" required maxLength={80} defaultValue={initial?.name} placeholder="Ex.: Leite condensado" />
        </div>
        <div className="pn-field" style={{ flex: "1 1 200px" }}>
          <label htmlFor={`${prefix}-base`}>Como mede</label>
          <select className="pn-input" id={`${prefix}-base`} name="baseUnit" value={base} onChange={(e) => setBase(e.target.value as BaseUnit)}>
            {BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      </div>
      <label className="pn-row" style={{ gap: 8, fontWeight: 600 }}>
        <input type="checkbox" checked={hasPkg} onChange={(e) => setHasPkg(e.target.checked)} />
        Compro em embalagem fechada (lata, caixa, pacote)
      </label>
      {hasPkg && (
        <div className="pn-row" style={{ alignItems: "flex-end" }}>
          <div className="pn-field" style={{ flex: "1 1 160px" }}>
            <label htmlFor={`${prefix}-pkg`}>Nome da embalagem</label>
            <input className="pn-input" id={`${prefix}-pkg`} name="packageName" required maxLength={30} defaultValue={initial?.packageName ?? ""} placeholder="Ex.: lata" />
          </div>
          <SizeFields base={base} prefix={prefix} label="Quanto tem em uma" nameQty="packageSize" nameUnit="packageUnit" defaultQty={milliToText(initial?.packageSizeMilli ?? null)} />
        </div>
      )}
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <SizeFields base={base} prefix={`${prefix}-min`} label="Estoque mínimo" nameQty="min" nameUnit="minUnit" defaultQty={milliToText(initial?.minMilli ?? null)} />
        <p className="pn-muted" style={{ margin: 0, flex: "1 1 240px" }}>
          Quando o estoque chegar nesse valor, o painel avisa. Depois de algumas semanas de uso, o sistema sugere um mínimo pelo seu consumo.
        </p>
      </div>
    </>
  );
}

export function NewIngredientForm() {
  const [state, onSubmit, pending] = useFormAction<InsumoState>(createIngredientAction, {});
  return (
    <form onSubmit={onSubmit} className="pn-grid" key={state.ok}>
      <IngredientFields prefix="new" />
      <div><button className="pn-btn" type="submit" disabled={pending}>Cadastrar insumo</button></div>
      <Messages state={state} />
    </form>
  );
}

export function EditIngredientForm({ ingredient }: { ingredient: EditIngredient }) {
  const [state, onSubmit, pending] = useFormAction<InsumoState>(updateIngredientAction, {});
  return (
    <form onSubmit={onSubmit} className="pn-grid">
      <input type="hidden" name="id" value={ingredient.id} />
      <IngredientFields prefix="edit" initial={ingredient} />
      <label className="pn-row" style={{ gap: 8, fontWeight: 600 }}>
        <input type="checkbox" name="active" defaultChecked={ingredient.active} /> Insumo em uso
      </label>
      <div><button className="pn-btn" type="submit" disabled={pending}>Salvar alterações</button></div>
      <Messages state={state} />
    </form>
  );
}

export function CountForm({ ingredient }: { ingredient: IngredientOption }) {
  const [state, onSubmit, pending] = useFormAction<InsumoState>(countAction, {});
  return (
    <form onSubmit={onSubmit} className="pn-grid" key={state.ok}>
      <input type="hidden" name="ingredientId" value={ingredient.id} />
      <div className="pn-row" style={{ alignItems: "flex-end" }}>
        <div className="pn-field" style={{ flex: "0 1 140px" }}>
          <label htmlFor="count-qty">Quanto contei</label>
          <input className="pn-input" id="count-qty" name="qty" inputMode="decimal" required placeholder="Ex.: 2,6" />
        </div>
        <UnitSelect info={ingredient} id="count-unit" />
        <button className="pn-btn ghost" type="submit" disabled={pending}>Corrigir estoque</button>
      </div>
      <p className="pn-muted" style={{ margin: 0 }}>
        O sistema tem {formatQty(ingredient.stockMilli, ingredient.baseUnit)}. A diferença fica registrada como contagem.
      </p>
      <Messages state={state} />
    </form>
  );
}

export function MinimumForm({ ingredient, suggestedMilli }: { ingredient: IngredientOption; suggestedMilli: number }) {
  const [state, onSubmit, pending] = useFormAction<InsumoState>(setMinimumAction, {});
  const [useSuggestion, onSuggest, pendingS] = useFormAction<InsumoState>(setMinimumAction, {});
  return (
    <div className="pn-grid">
      {suggestedMilli > 0 && (
        <form onSubmit={onSuggest}>
          <input type="hidden" name="ingredientId" value={ingredient.id} />
          <input type="hidden" name="suggested" value={suggestedMilli} />
          <button className="pn-btn" type="submit" disabled={pendingS}>Usar a sugestão: {formatQty(suggestedMilli, ingredient.baseUnit)}</button>
          <Messages state={useSuggestion} />
        </form>
      )}
      <form onSubmit={onSubmit} className="pn-row" style={{ alignItems: "flex-end" }} key={state.ok}>
        <input type="hidden" name="ingredientId" value={ingredient.id} />
        <div className="pn-field" style={{ flex: "0 1 140px" }}>
          <label htmlFor="min-qty">Ou defina o mínimo</label>
          <input className="pn-input" id="min-qty" name="qty" inputMode="decimal" required placeholder="Ex.: 2" />
        </div>
        <UnitSelect info={ingredient} id="min-unit" />
        <button className="pn-btn ghost" type="submit" disabled={pending}>Salvar mínimo</button>
      </form>
      <Messages state={state} />
    </div>
  );
}
