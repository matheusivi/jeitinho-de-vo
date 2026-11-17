import { asc, eq, like } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { slugify } from "./slug";

export { slugify };
export type Product = typeof schema.products.$inferSelect;
export type ProductResult = { ok: true; product: Product } | { ok: false; message: string };

const productInput = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto.").max(80),
  description: z.string().trim().max(300, "Descrição muito longa.").default(""),
  priceCents: z.number().int("Preço inválido.").min(1, "O preço precisa ser maior que zero.").max(10_000_00),
  unitLabel: z.string().trim().min(1).max(40).default("unidade"),
  categoryId: z.string().min(1, "Escolha a categoria."),
  active: z.boolean(),
  imageKey: z.string().regex(/^[a-f0-9]{32}$/).optional(),
});
export type ProductInput = z.input<typeof productInput>;

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (await db.select({ slug: schema.products.slug }).from(schema.products).where(like(schema.products.slug, `${base}%`)))
      .map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

async function categoryExists(id: string): Promise<boolean> {
  const [c] = await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.id, id));
  return Boolean(c);
}

export async function createProduct(input: ProductInput): Promise<ProductResult> {
  const parsed = productInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!slugify(parsed.data.name)) return { ok: false, message: "Informe o nome do produto." };
  if (!(await categoryExists(parsed.data.categoryId))) return { ok: false, message: "Escolha a categoria." };
  const [product] = await db
    .insert(schema.products)
    .values({ ...parsed.data, slug: await uniqueSlug(parsed.data.name) })
    .returning();
  return { ok: true, product };
}

/** Atualiza os dados de cadastro. Estoque e slug não mudam por aqui. */
export async function updateProduct(id: string, input: ProductInput): Promise<ProductResult> {
  const parsed = productInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!(await categoryExists(parsed.data.categoryId))) return { ok: false, message: "Escolha a categoria." };
  const { imageKey, ...rest } = parsed.data;
  const [product] = await db
    .update(schema.products)
    .set(imageKey ? { ...rest, imageKey } : rest)
    .where(eq(schema.products.id, id))
    .returning();
  if (!product) return { ok: false, message: "Produto não encontrado." };
  return { ok: true, product };
}

export async function getProduct(id: string): Promise<Product | null> {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id));
  return p ?? null;
}

export function listProductsAdmin() {
  return db
    .select({ product: schema.products, categoryName: schema.categories.name })
    .from(schema.products)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .orderBy(asc(schema.categories.position), asc(schema.products.name));
}
