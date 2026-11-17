import { requireRole } from "@/lib/auth/guard";
import { listCategories } from "@/lib/catalog/categories";
import { ProductForm } from "../ProductForm";

export default async function NovoProdutoPage() {
  await requireRole("ADMIN");
  const categories = (await listCategories()).map((c) => ({ id: c.id, name: c.name }));
  return (
    <div className="pn-grid">
      <h1 className="pn-h1">Novo produto</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
