import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { listCategories } from "@/lib/catalog/categories";
import { imageUrl } from "@/lib/catalog/images";
import { getProduct } from "@/lib/catalog/products";
import { ProductForm } from "../ProductForm";

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) notFound();
  const categories = (await listCategories()).map((c) => ({ id: c.id, name: c.name }));
  return (
    <div className="pn-grid">
      <h1 className="pn-h1">Editar produto</h1>
      <ProductForm
        categories={categories}
        product={{
          id: p.id, name: p.name, description: p.description, unitLabel: p.unitLabel, categoryId: p.categoryId,
          active: p.active, price: (p.priceCents / 100).toFixed(2).replace(".", ","),
          imageUrl: p.imageKey ? imageUrl(p.imageKey, 480) : null,
        }}
      />
    </div>
  );
}
