"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth/guard";
import { parseBRL } from "@/lib/money";
import {
  createIngredient, getIngredient, IngredientError, purchase, recordCount, recordOutflow, setMinimum, updateIngredient,
} from "@/lib/ingredients/ingredients";
import { isInputUnit, parseQtyInput, toMilli, UnitError, type BaseUnit } from "@/lib/ingredients/units";

export type InsumoState = { error?: string; ok?: string };

const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

function done(id?: string): void {
  revalidatePath("/painel/insumos");
  if (id) revalidatePath(`/painel/insumos/${id}`);
  revalidatePath("/painel", "layout");
}

async function qtyFromForm(form: FormData, ingredientId: string, qtyKey = "qty", unitKey = "unit"): Promise<number> {
  const ing = await getIngredient(ingredientId);
  const unit = str(form, unitKey);
  if (!isInputUnit(unit)) throw new UnitError("Escolha a unidade.");
  return toMilli(parseQtyInput(str(form, qtyKey)), unit, ing);
}

/** Lê nome, unidade, embalagem e mínimo. Embalagem e mínimo vêm na unidade escolhida (g/kg, ml/l, un). */
function ingredientFromForm(form: FormData) {
  const baseUnit = str(form, "baseUnit") as BaseUnit;
  const packageName = str(form, "packageName") || null;
  const info = { baseUnit, packageName: null, packageSizeMilli: null };
  let packageSizeMilli: number | null = null;
  if (packageName) {
    const u = str(form, "packageUnit");
    if (!isInputUnit(u) || u === "pkg") throw new UnitError("Escolha a unidade do tamanho da embalagem.");
    packageSizeMilli = toMilli(parseQtyInput(str(form, "packageSize")), u, info);
  }
  let minMilli: number | undefined;
  const minText = str(form, "min");
  if (minText && minText !== "0") {
    const u = str(form, "minUnit");
    if (!isInputUnit(u) || u === "pkg") throw new UnitError("Escolha a unidade do mínimo.");
    minMilli = toMilli(parseQtyInput(minText), u, info);
  } else if (minText === "0") {
    minMilli = 0;
  }
  return { name: str(form, "name"), baseUnit, packageName, packageSizeMilli, minMilli };
}

async function run(fn: () => Promise<string>, id?: string): Promise<InsumoState> {
  try {
    const ok = await fn();
    done(id);
    return { ok };
  } catch (e) {
    if (e instanceof IngredientError || e instanceof UnitError) return { error: e.message };
    throw e;
  }
}

export async function createIngredientAction(_p: InsumoState, form: FormData): Promise<InsumoState> {
  const user = await requireRole("ADMIN");
  return run(async () => {
    const ing = await createIngredient(ingredientFromForm(form), user);
    return `${ing.name} cadastrado.`;
  });
}

export async function updateIngredientAction(_p: InsumoState, form: FormData): Promise<InsumoState> {
  const user = await requireRole("ADMIN");
  const id = str(form, "id");
  return run(async () => {
    await updateIngredient(id, { ...ingredientFromForm(form), active: form.get("active") === "on" }, user);
    return "Alterações salvas.";
  }, id);
}

export async function purchaseAction(_p: InsumoState, form: FormData): Promise<InsumoState> {
  const user = await requireRole("ADMIN");
  const id = str(form, "ingredientId");
  return run(async () => {
    const qty = await qtyFromForm(form, id);
    const paid = parseBRL(str(form, "paid"));
    if (paid === null || paid <= 0) throw new IngredientError("Informe o valor pago, por exemplo 32,90.");
    await purchase(id, qty, paid, user, str(form, "note"));
    return "Compra lançada. Estoque e custo atualizados.";
  }, id);
}

export async function outflowAction(_p: InsumoState, form: FormData): Promise<InsumoState> {
  const user = await requireUser();
  const id = str(form, "ingredientId");
  const type = str(form, "type") === "CONSUMPTION" ? "CONSUMPTION" : "LOSS";
  return run(async () => {
    await recordOutflow(id, await qtyFromForm(form, id), type, str(form, "reason"), user);
    return type === "LOSS" ? "Perda registrada." : "Consumo registrado.";
  }, id);
}

export async function countAction(_p: InsumoState, form: FormData): Promise<InsumoState> {
  const user = await requireRole("ADMIN");
  const id = str(form, "ingredientId");
  return run(async () => {
    const ing = await getIngredient(id);
    const text = str(form, "qty");
    const unit = str(form, "unit");
    const counted = text === "0" ? 0 : isInputUnit(unit) ? toMilli(parseQtyInput(text), unit, ing) : NaN;
    if (Number.isNaN(counted)) throw new UnitError("Escolha a unidade.");
    await recordCount(id, counted, user);
    return "Estoque corrigido pela contagem.";
  }, id);
}

export async function setMinimumAction(_p: InsumoState, form: FormData): Promise<InsumoState> {
  const user = await requireRole("ADMIN");
  const id = str(form, "ingredientId");
  return run(async () => {
    const ing = await getIngredient(id);
    const text = str(form, "qty");
    const unit = str(form, "unit");
    let min: number;
    if (form.get("suggested")) min = Number(form.get("suggested"));
    else if (text === "0") min = 0;
    else if (isInputUnit(unit)) min = toMilli(parseQtyInput(text), unit, ing);
    else throw new UnitError("Escolha a unidade.");
    await setMinimum(id, min, user);
    return "Mínimo salvo.";
  }, id);
}
