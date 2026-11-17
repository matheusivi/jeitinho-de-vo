"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { createCategory, updateCategory } from "@/lib/catalog/categories";

export type FormState = { error?: string; ok?: string };

export async function createCategoryAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireRole("ADMIN");
  const r = await createCategory({ name: String(form.get("name") ?? "") });
  if (!r.ok) return { error: r.message };
  revalidatePath("/painel/categorias");
  return { ok: `Categoria "${r.category.name}" criada.` };
}

export async function updateCategoryAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireRole("ADMIN");
  const r = await updateCategory(String(form.get("id") ?? ""), {
    name: String(form.get("name") ?? ""),
    active: form.get("active") === "on",
  });
  if (!r.ok) return { error: r.message };
  revalidatePath("/painel/categorias");
  return { ok: "Salvo." };
}
