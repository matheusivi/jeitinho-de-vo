import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { slugify } from "./slug";

export type Category = typeof schema.categories.$inferSelect;
export type CategoryResult = { ok: true; category: Category } | { ok: false; message: string };

const nameSchema = z.string().trim().min(2, "Informe o nome da categoria.").max(60);

async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(eq(sql`lower(${schema.categories.name})`, name.toLowerCase()));
  return rows.some((r) => r.id !== exceptId);
}

export async function createCategory(input: { name: string }): Promise<CategoryResult> {
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const name = parsed.data;
  const slug = slugify(name);
  if (!slug) return { ok: false, message: "Informe o nome da categoria." };
  if (await nameTaken(name)) return { ok: false, message: "Já existe uma categoria com este nome." };
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.categories.position}), -1)::int + 1` })
    .from(schema.categories);
  const [category] = await db.insert(schema.categories).values({ name, slug, position: next }).returning();
  return { ok: true, category };
}

export async function updateCategory(
  id: string,
  input: { name: string; active: boolean },
): Promise<CategoryResult> {
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (await nameTaken(parsed.data, id)) return { ok: false, message: "Já existe uma categoria com este nome." };
  const [category] = await db
    .update(schema.categories)
    .set({ name: parsed.data, active: input.active })
    .where(eq(schema.categories.id, id))
    .returning();
  if (!category) return { ok: false, message: "Categoria não encontrada." };
  return { ok: true, category };
}

export function listCategories(): Promise<Category[]> {
  return db.select().from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.name));
}
