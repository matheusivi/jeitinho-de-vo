"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { ImageError, processProductImage } from "@/lib/catalog/images";
import { createProduct, updateProduct } from "@/lib/catalog/products";
import { parseBRL } from "@/lib/money";

export type ProductFormState = { error?: string };

export async function saveProductAction(_p: ProductFormState, form: FormData): Promise<ProductFormState> {
  await requireRole("ADMIN");
  const id = String(form.get("id") ?? "");
  const priceCents = parseBRL(String(form.get("price") ?? ""));
  if (priceCents === null) return { error: "Preço inválido. Use o formato 12,50." };

  let imageKey: string | undefined;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      imageKey = (await processProductImage(Buffer.from(await photo.arrayBuffer()))).key;
    } catch (e) {
      return { error: e instanceof ImageError ? e.message : "Não foi possível ler a foto." };
    }
  }

  const input = {
    name: String(form.get("name") ?? ""),
    description: String(form.get("description") ?? ""),
    unitLabel: String(form.get("unitLabel") ?? "") || "unidade",
    categoryId: String(form.get("categoryId") ?? ""),
    active: form.get("active") === "on",
    priceCents,
    imageKey,
  };
  const result = id ? await updateProduct(id, input) : await createProduct(input);
  if (!result.ok) return { error: result.message };
  revalidatePath("/painel/produtos");
  revalidatePath("/");
  redirect("/painel/produtos");
}
