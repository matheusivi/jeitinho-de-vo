import { requireRole } from "@/lib/auth/guard";
import { listCategories } from "@/lib/catalog/categories";
import { CategoryRow, NewCategoryForm } from "./CategoryForms";

export default async function CategoriasPage() {
  await requireRole("ADMIN");
  const cats = await listCategories();
  return (
    <div className="pn-grid">
      <div>
        <h1 className="pn-h1">Categorias</h1>
        <p className="pn-sub">São as abas do cardápio. Crie uma nova sempre que surgir um tipo de produto.</p>
      </div>
      <NewCategoryForm />
      <div className="pn-card">
        {cats.length === 0 && <p className="pn-muted">Nenhuma categoria ainda.</p>}
        {cats.map((c) => <CategoryRow key={c.id} id={c.id} name={c.name} active={c.active} />)}
      </div>
    </div>
  );
}
